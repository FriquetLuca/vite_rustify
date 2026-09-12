use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};

use crate::models::DataResponse;

#[derive(
  Debug, Clone, derive_more::Display, derive_more::Error, Serialize, Deserialize,
)]
pub enum NoError {}
impl ResponseError for NoError {
  fn error_response(&self) -> HttpResponse {
    DataResponse::<(), NoError> {
      success: false,
      data: None,
      error: None,
    }
    .to_response()
  }
  fn status_code(&self) -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
  }
}
