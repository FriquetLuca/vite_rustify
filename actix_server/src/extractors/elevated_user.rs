use actix_web::{dev::Payload, FromRequest, HttpMessage, HttpRequest};
use futures_util::future::{ready, Ready};

use super::AuthenticatedUser;
use crate::server::AppError;

pub struct ElevatedUser(pub AuthenticatedUser);

impl FromRequest for ElevatedUser {
  type Error = AppError;
  type Future = Ready<Result<Self, Self::Error>>;

  fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
    ready(
      req
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .filter(|u| u.privilege_level == "elevated")
        .map(ElevatedUser)
        .ok_or(AppError::Forbidden),
    )
  }
}
