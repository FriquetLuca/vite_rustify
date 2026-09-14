use actix_web::{
  http::{header::ContentType, StatusCode},
  HttpResponse, ResponseError,
};
use serde::{Deserialize, Serialize};

#[derive(
  Debug, Clone, derive_more::Display, derive_more::Error, Serialize, Deserialize,
)]
pub enum SessionError {
  #[display("INTERNAL_SERVER_ERROR")]
  InternalServerError,
  #[display("SESSION_CORRUPTED")]
  Corrupted,
  #[display("NO_SESSION")]
  NotLogged,
  #[display("SESSION_NO_TENANT")]
  NoTenant,
}

impl ResponseError for SessionError {
  fn error_response(&self) -> HttpResponse {
    HttpResponse::build(self.status_code())
      .insert_header(ContentType::json())
      .json(self)
  }
  fn status_code(&self) -> StatusCode {
    match self {
      SessionError::Corrupted => StatusCode::UNAUTHORIZED,
      SessionError::NotLogged => StatusCode::UNAUTHORIZED,
      SessionError::NoTenant => StatusCode::BAD_REQUEST,
      SessionError::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
    }
  }
}
