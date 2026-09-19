use actix_web::{dev::Payload, FromRequest, HttpMessage, HttpRequest};
use futures_util::future::{ready, Ready};
use sqlx::FromRow;
use uuid::Uuid;

use crate::server::AppError;

#[derive(FromRow, Clone)]
pub struct AuthenticatedUser {
  pub user_id: Uuid,
  pub privilege_level: String,
}

impl FromRequest for AuthenticatedUser {
  type Error = AppError;
  type Future = Ready<Result<Self, Self::Error>>;

  fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
    ready(
      req
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or(AppError::Unauthorized),
    )
  }
}
