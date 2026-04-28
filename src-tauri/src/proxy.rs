use std::net::SocketAddr;

use axum::{
    body::Body,
    http::{header, HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use crate::config::Config;
use crate::error::AppError;
use crate::gateway::{chat_completions_handler, health_handler};
use crate::state::AppState;
use crate::upstream::{build_enterprise_auth_headers_inner, headers_to_map};

pub fn create_router(config: Config, client: reqwest::Client) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::HeaderName::from_static("x-api-key"),
            header::HeaderName::from_static("x-api-key"),
            header::HeaderName::from_static("x-llm-base-url"),
            header::HeaderName::from_static("token"),
            header::HeaderName::from_static("api_key"),
            header::HeaderName::from_static("accept"),
            header::HeaderName::from_static("x-request-id"),
        ]);

    let state = AppState { config, client };

    Router::new()
        .route("/health", get(health_handler))
        .route(
            "/enterprise/api/v1/chat/completions",
            post(chat_completions_handler),
        )
        .fallback(fallback_handler)
        .layer(cors)
        .with_state(state)
}

pub fn create_router_untyped(config: Config, client: reqwest::Client) -> Router {
    create_router(config, client)
}

async fn fallback_handler(
    axum::extract::State(state): axum::extract::State<AppState>,
    method: Method,
    uri: axum::http::Uri,
    headers: HeaderMap,
    body: Body,
) -> Result<Response, AppError> {
    let path_and_query = uri.path_and_query().map(|p| p.as_str()).unwrap_or("/");

    if !path_and_query.starts_with("/enterprise") {
        return Ok(StatusCode::NOT_FOUND.into_response());
    }

    let target_url = format!("{}{}", state.config.public_api_target, path_and_query);

    let header_map = headers_to_map(&headers);
    let upstream_headers = build_enterprise_auth_headers_inner(&header_map, &state.config);

    let bytes = axum::body::to_bytes(body, 16 * 1024 * 1024)
        .await
        .map_err(|e| AppError::AxumBody(e.to_string()))?;

    let mut req_builder = state.client.request(method, &target_url).headers(upstream_headers);

    if !bytes.is_empty() {
        req_builder = req_builder.body(bytes.to_vec());
    }

    let upstream = req_builder.send().await.map_err(AppError::Reqwest)?;

    let status = upstream.status();
    let mut builder = Response::builder().status(status);

    for (name, value) in upstream.headers().iter() {
        let name_str = name.as_str();
        let Ok(val) = value.to_str() else { continue };
        builder = builder.header(name_str, val);
    }
    builder = builder.header("Access-Control-Allow-Origin", "*");

    let content_type = upstream
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if content_type.contains("text/event-stream") {
        builder = builder
            .header("Cache-Control", "no-cache, no-transform")
            .header("X-Accel-Buffering", "no");
    }

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);
    Ok(builder.body(body).unwrap())
}

pub async fn start_server(
    config: Config,
    client: reqwest::Client,
    shutdown: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), AppError> {
    let addr = SocketAddr::from(([127, 0, 0, 1], config.proxy_port));
    let router = create_router(config, client);

    let listener = tokio::net::TcpListener::bind(addr).await.map_err(AppError::Io)?;
    log::info!("[api-proxy] listening on http://{}", addr);

    let server = axum::serve(listener, router);

    tokio::select! {
        result = server => {
            result.map_err(AppError::Io)?;
        }
        _ = shutdown => {
            log::info!("[api-proxy] shutting down gracefully");
        }
    }

    Ok(())
}
