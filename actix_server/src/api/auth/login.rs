use actix_session::Session;
use actix_web::{
  http::StatusCode, post, web, HttpResponse, Responder, ResponseError,
};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::session::UserSession;
use crate::states::SharedBloom;

#[derive(sqlx::FromRow)]
struct UserCell {
  id: Uuid,
  username: String,
  password_hash: String,
}

#[derive(Deserialize, Validate)]
struct LoginRequest {
  #[validate(email)]
  pub email: String,
  #[validate(length(min = 8, max = 128))]
  pub password: String,
}

#[derive(Debug, Clone, derive_more::Display, derive_more::Error)]
enum LoginError {
  #[display("INTERNAL_SERVER_ERROR")]
  InternalServerError,
  #[display("UNAUTHORIZED")]
  Unauthorized,
  #[display("BAD_REQUEST")]
  BadRequest,
}

impl ResponseError for LoginError {
  fn error_response(&self) -> HttpResponse {
    HttpResponse::build(self.status_code()).json(self)
  }
  fn status_code(&self) -> StatusCode {
    match self {
      LoginError::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
      LoginError::Unauthorized => StatusCode::UNAUTHORIZED,
      LoginError::BadRequest => StatusCode::BAD_REQUEST,
    }
  }
}

impl Serialize for LoginError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}

#[post("/login")]
pub async fn login_route(
  pool: web::Data<PgPool>,
  filters: web::Data<SharedBloom>,
  session: Session,
  req: web::Json<LoginRequest>,
) -> Result<impl Responder, LoginError> {
  req.0.validate().map_err(|_| LoginError::BadRequest)?;

  {
    let f = filters
      .read()
      .map_err(|_| LoginError::InternalServerError)?;
    if !f.email_filter.check(&req.email) {
      return Err(LoginError::Unauthorized);
    }
  }

  let user = sqlx::query_as::<_, UserCell>(
    "SELECT id, username, password_hash FROM users WHERE email = $1",
  )
  .bind(&req.email)
  .fetch_one(&**pool)
  .await
  .map_err(|_| LoginError::InternalServerError)?;

  let parsed_hash = PasswordHash::new(&user.password_hash)
    .map_err(|_| LoginError::InternalServerError)?;

  if Argon2::default()
    .verify_password(req.password.as_bytes(), &parsed_hash)
    .is_ok()
  {
    session.clear();
    let _ = UserSession {
      id: user.id.to_string(),
    }
    .store_session(&session)
    .map_err(|_| LoginError::InternalServerError)?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": user.id.to_string(),
        "username": user.username,
    })))
  } else {
    Err(LoginError::Unauthorized)
  }
}
