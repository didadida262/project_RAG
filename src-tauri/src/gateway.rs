use axum::{
    body::Body,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    document::{extract_document_text, DocumentExtractError},
    error::AppError,
    upstream::{build_chat_completions_headers, build_llm_upstream_fetch_headers, headers_to_map},
};

const SYSTEM_PREAMBLE: &str = "你是文档分析助手。请严格基于下方「文档正文」回答用户问题；若文档中无依据请明确说明，不要编造。";

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
    target: String,
}

pub async fn health_handler(State(state): State<crate::state::AppState>) -> impl IntoResponse {
    Json(HealthResponse {
        ok: true,
        target: state.config.public_api_target.clone(),
    })
}

#[derive(Serialize)]
struct ErrorBody {
    error: ErrorDetail,
}

#[derive(Serialize)]
struct ErrorDetail {
    code: String,
    message: String,
}

fn app_error(code: &str, message: &str) -> Response {
    Response::builder()
        .status(StatusCode::BAD_REQUEST)
        .header("Content-Type", "application/json")
        .body(Body::from(
            serde_json::to_string(&ErrorBody {
                error: ErrorDetail {
                    code: code.to_string(),
                    message: message.to_string(),
                },
            })
            .unwrap(),
        ))
        .unwrap()
}

fn is_safe_http_origin(s: &str) -> bool {
    let s = s.trim();
    if s.is_empty() {
        return false;
    }
    if let Ok(u) = s.parse::<reqwest::Url>() {
        u.scheme() == "http" || u.scheme() == "https"
    } else {
        false
    }
}

fn resolve_llm_upstream_chat_url(llm_base: &str) -> String {
    let normalized = llm_base.trim().trim_end_matches('/');
    let full = "/llm/v1/chat/completions";
    if normalized.ends_with(full) {
        normalized.to_string()
    } else if normalized.ends_with("/llm/v1") {
        format!("{}/chat/completions", normalized)
    } else {
        format!("{}/llm/v1/chat/completions", normalized)
    }
}

fn build_doc_system_content(text: &str, truncated: bool) -> String {
    let mut parts = vec![
        SYSTEM_PREAMBLE.to_string(),
        "".to_string(),
        "--- 文档正文 ---".to_string(),
        text.to_string(),
        "--- 文档正文结束 ---".to_string(),
    ];
    if truncated {
        parts.push("（正文已截断）".to_string());
    }
    parts.into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n")
}

async fn forward_streaming_response(upstream: reqwest::Response) -> Result<Response, AppError> {
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

#[derive(Deserialize, Debug)]
struct ChatJsonPayload {
    model: String,
    messages: Vec<Value>,
    #[serde(default)]
    stream: bool,
}

pub async fn chat_completions_handler(
    State(state): State<crate::state::AppState>,
    headers: HeaderMap,
    body: Body,
) -> Result<Response, AppError> {
    let config = &state.config;
    let client = &state.client;
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let llm_base = headers
        .get("x-llm-base-url")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim_end_matches('/');

    if headers.contains_key("x-llm-base-url") && !is_safe_http_origin(llm_base) {
        return Ok(app_error(
            "BAD_LLM_BASE",
            "X-Llm-Base-Url 须为合法 http(s) 地址，例如 https://aiplatform.njsrd.com/llm/v1",
        ));
    }

    let use_external_llm = !llm_base.is_empty();
    let target_url = if use_external_llm {
        resolve_llm_upstream_chat_url(llm_base)
    } else {
        format!("{}{}", config.public_api_target, config.chat_completions_path())
    };

    let header_map = headers_to_map(&headers);

    let upstream_headers = if use_external_llm {
        build_llm_upstream_fetch_headers(&header_map)
    } else {
        build_chat_completions_headers(&header_map, &config)
    };

    let is_multipart = content_type.contains("multipart/form-data");

    let upstream_body_json: Value;

    if is_multipart {
        let bytes = axum::body::to_bytes(body, usize::MAX)
            .await
            .map_err(|e| AppError::AxumBody(e.to_string()))?;

        let boundary = content_type
            .split("boundary=")
            .nth(1)
            .unwrap_or("")
            .trim();

        if boundary.is_empty() {
            return Ok(app_error("BAD_MULTIPART", "缺少 boundary"));
        }

        let mut file_data: Option<(Vec<u8>, Option<String>, Option<String>)> = None;
        let mut model = String::new();
        let mut messages_json = String::new();
        let mut stream_flag = true;

        let stream = futures::stream::once(async move { Ok::<_, multer::Error>(bytes) });
        let mut multipart = multer::Multipart::new(stream, boundary);

        while let Some(field) = multipart.next_field().await.map_err(|e| AppError::Multer(e.to_string()))? {
            let name = field.name().unwrap_or("").to_string();
            let originalname = field.file_name().map(|s| s.to_string());
            let mimetype = field.content_type().map(|s| s.to_string());
            let data = field.bytes().await.map_err(|e| AppError::Multer(e.to_string()))?;
            match name.as_str() {
                "file" => {
                    file_data = Some((data.to_vec(), originalname, mimetype));
                }
                "model" => {
                    model = String::from_utf8_lossy(&data).trim().to_string();
                }
                "messages" => {
                    messages_json = String::from_utf8_lossy(&data).to_string();
                }
                "stream" => {
                    stream_flag = String::from_utf8_lossy(&data).trim().to_lowercase() != "false";
                }
                _ => {}
            }
        }

        if model.is_empty() {
            return Ok(app_error("NO_MODEL", "缺少 model"));
        }
        if model.len() > 2048 || model.contains('\n') || model.contains('\r') || model.contains('\0') {
            return Ok(app_error("INVALID_MODEL", "model 不合法"));
        }

        let messages: Vec<Value> = match serde_json::from_str::<Value>(&messages_json) {
            Ok(v) if v.is_array() => v.as_array().unwrap().clone(),
            _ => return Ok(app_error("BAD_MESSAGES", "messages 须为合法 JSON 数组字符串")),
        };

        let (file_buf, originalname, mimetype) = match file_data {
            Some(v) => v,
            None => return Ok(app_error("NO_FILE", "multipart 须含 file（PDF/DOCX）。文件仅在本机解析；上游 chat/completions 只收 JSON。")),
        };

        let (text, truncated) = match extract_document_text(
            &file_buf,
            originalname.as_deref(),
            mimetype.as_deref(),
            config.document_extract_max_chars,
        ) {
            Ok(v) => v,
            Err(DocumentExtractError::Known { code, message }) => {
                return Ok(app_error(code, &message));
            }
        };

        let doc_system = build_doc_system_content(&text, truncated);
        let mut final_messages = vec![serde_json::json!({
            "role": "system",
            "content": doc_system,
        })];
        final_messages.extend(messages);

        upstream_body_json = serde_json::json!({
            "model": model,
            "messages": final_messages,
            "stream": stream_flag,
        });
    } else {
        let bytes = axum::body::to_bytes(body, config.document_upload_max_bytes as usize)
            .await
            .map_err(|e| AppError::AxumBody(e.to_string()))?;
        upstream_body_json = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        if upstream_body_json.is_null() {
            return Ok(app_error("BAD_JSON", "JSON 请求体无效"));
        }
    }

    let upstream = client
        .post(&target_url)
        .headers(upstream_headers)
        .json(&upstream_body_json)
        .send()
        .await
        .map_err(AppError::Reqwest)?;

    if !upstream.status().is_success() {
        let status = upstream.status();
        let text = upstream.text().await.unwrap_or_default();
        return Ok(Response::builder()
            .status(status)
            .header("Content-Type", "application/json")
            .body(Body::from(text))
            .unwrap());
    }

    forward_streaming_response(upstream).await
}
