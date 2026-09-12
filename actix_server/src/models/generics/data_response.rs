use actix_web::{http::StatusCode, HttpResponse, Responder, ResponseError};
use serde::Serialize;

#[derive(Serialize)]
pub struct DataResponse<T, E>
where
  T: Serialize,
  E: ResponseError + Serialize,
{
  pub success: bool,
  pub data: Option<T>,
  pub error: Option<E>,
}

impl<T, E> DataResponse<T, E>
where
  T: Serialize,
  E: ResponseError + Serialize,
{
  pub fn to_response(self) -> HttpResponse {
    if self.success {
      HttpResponse::Ok().json(self)
    } else {
      let status = self
        .error
        .as_ref()
        .map(|e| e.status_code())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
      HttpResponse::build(status).json(self)
    }
  }
}

impl<T, E> Responder for DataResponse<T, E>
where
  T: Serialize,
  E: ResponseError + Serialize,
{
  type Body = actix_web::body::BoxBody;

  fn respond_to(
    self,
    _req: &actix_web::HttpRequest,
  ) -> HttpResponse<Self::Body> {
    if self.success {
      HttpResponse::Ok().json(self)
    } else {
      let status = self
        .error
        .as_ref()
        .map(|e| e.status_code())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
      HttpResponse::build(status).json(self)
    }
  }
}
