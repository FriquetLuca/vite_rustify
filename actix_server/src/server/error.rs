use actix_web::http::header::ContentType;
use actix_web::http::StatusCode;
use actix_web::{HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};

#[derive(
  Debug, Clone, derive_more::Display, derive_more::Error, Serialize, Deserialize,
)]
pub enum AppError {
  #[display("BAD_REQUEST")]
  BadRequest,
  #[display("INTERNAL_SERVER_ERROR")]
  InternalServerError,
  #[display("PAYLOAD_TOO_LARGE")]
  PayloadTooLarge,
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
    }
  }
}
