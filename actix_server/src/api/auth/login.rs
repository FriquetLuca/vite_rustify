use actix_session::Session;
use actix_web::{post, web, HttpRequest, HttpResponse, Responder};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::server::AppError;
use crate::session::{create_session, SessionKind};
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

#[post("/login")]
pub async fn login_route(
  req: HttpRequest,
  pool: web::Data<PgPool>,
  filters: web::Data<SharedBloom>,
  session: Session,
  login_req: web::Json<LoginRequest>,
) -> Result<impl Responder, AppError> {
  login_req.0.validate().map_err(|_| AppError::BadRequest)?;

  {
    let f = filters.read().map_err(|_| AppError::InternalServerError)?;
    if !f.email_filter.check(&login_req.email) {
      return Err(AppError::Unauthorized);
    }
  }

  let user = sqlx::query_as::<_, UserCell>(
    "SELECT id, username, password_hash FROM users WHERE email = $1",
  )
  .bind(&login_req.email)
  .fetch_one(&**pool)
  .await?;

  let parsed_hash = PasswordHash::new(&user.password_hash)
    .map_err(|_| AppError::InternalServerError)?;

  if Argon2::default()
    .verify_password(login_req.password.as_bytes(), &parsed_hash)
    .is_ok()
  {
    create_session(&req, &session, &**pool, user.id, SessionKind::Standard)
      .await?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "id": user.id.to_string(),
        "username": user.username,
    })))
  } else {
    Err(AppError::Unauthorized)
  }
}
