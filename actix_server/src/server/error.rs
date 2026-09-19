use actix_web::http::header::ContentType;
use actix_web::http::StatusCode;
use actix_web::{HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, derive_more::Display, Serialize, Deserialize)]
pub enum AppError {
  #[display("BAD_REQUEST")]
  BadRequest,
  #[display("UNAUTHORIZED")]
  Unauthorized,
  #[display("FORBIDDEN")]
  Forbidden,
  #[display("INTERNAL_SERVER_ERROR")]
  InternalServerError,
  #[display("PAYLOAD_TOO_LARGE")]
  PayloadTooLarge,
  #[display("{_0}")]
  Conflict(String),
}

impl AppError {
  pub fn conflict(msg: impl Into<String>) -> Self {
    AppError::Conflict(msg.into())
  }
}

impl ResponseError for AppError {
  fn error_response(&self) -> HttpResponse {
    HttpResponse::build(self.status_code())
      .insert_header(ContentType::json())
      .json(self)
  }
  fn status_code(&self) -> StatusCode {
    match self {
      AppError::BadRequest => StatusCode::BAD_REQUEST,
      AppError::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
      AppError::PayloadTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
      AppError::Forbidden => StatusCode::FORBIDDEN,
      AppError::Unauthorized => StatusCode::UNAUTHORIZED,
      AppError::Conflict(_) => StatusCode::CONFLICT,
    }
  }
}

impl From<sqlx::Error> for AppError {
  fn from(_: sqlx::Error) -> Self {
    AppError::InternalServerError
  }
}
