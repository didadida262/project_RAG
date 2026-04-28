use axum::{
    body::Body,
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("HTTP client error: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Invalid header: {0}")]
    InvalidHeader(String),
    #[error("Multer error: {0}")]
    Multer(String),
    #[error("Axum body error: {0}")]
    AxumBody(String),
    #[error("Document extract error: {0}")]
    DocumentExtract(String),
    #[error("Config error: {0}")]
    Config(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            AppError::Reqwest(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
            AppError::Multer(_) | AppError::AxumBody(_) => (
                StatusCode::BAD_REQUEST,
                format!(
                    "{{\"error\":{{\"code\":\"MULTIPART_ERROR\",\"message\":\"{}\"}}}}",
                    self
                ),
            ),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        Response::builder()
            .status(status)
            .header("Content-Type", "application/json")
            .body(Body::from(msg))
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
    }
}
