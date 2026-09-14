use crate::states::SharedBloom;
use actix_web::{
  http::StatusCode, post, web, HttpResponse, Responder, ResponseError,
};
use argon2::{Argon2, PasswordHasher};
use password_hash::SaltString;
use rand_core::OsRng;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use validator::{Validate, ValidationError};

fn validate_username(username: &str) -> Result<(), ValidationError> {
  let username_regex =
    match Regex::new(r"^[\p{L}\p{N}_-]+(?: [\p{L}\p{N}_-]+)*$") {
      Ok(v) => v,
      Err(_) => return Err(ValidationError::new("INTERNAL_SERVER_ERROR")),
    };

  if !username_regex.is_match(username) {
    return Err(ValidationError::new("INVALID_USERNAME"));
  }

  Ok(())
}

#[derive(Deserialize, Validate)]
struct RegisterRequest {
  #[validate(email)]
  pub email: String,
  #[validate(
    length(min = 3, max = 30),
    custom(function = "validate_username")
  )]
  pub username: String,
  #[validate(length(min = 8, max = 128))]
  pub password: String,
}

#[derive(Debug, Clone, derive_more::Display, derive_more::Error)]
enum RegisterError {
  #[display("INTERNAL_SERVER_ERROR")]
  InternalServerError,
  #[display("USER_EXIST")]
  UserExist,
  #[display("EMAIL_EXIST")]
  EmailExist,
  #[display("BAD_REQUEST")]
  BadRequest,
}

#[derive(sqlx::FromRow)]
struct NewUser {
  id: Uuid,
  username: String,
  email: String,
}

impl ResponseError for RegisterError {
  fn error_response(&self) -> HttpResponse {
    HttpResponse::build(self.status_code()).json(self)
  }
  fn status_code(&self) -> StatusCode {
    match self {
      RegisterError::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
      RegisterError::UserExist => StatusCode::CONFLICT,
      RegisterError::EmailExist => StatusCode::CONFLICT,
      RegisterError::BadRequest => StatusCode::BAD_REQUEST,
    }
  }
}

impl Serialize for RegisterError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}

#[post("/register")]
pub async fn register_route(
  pool: web::Data<PgPool>,
  filters: web::Data<SharedBloom>,
  req: web::Json<RegisterRequest>,
) -> Result<impl Responder, RegisterError> {
  req.0.validate().map_err(|_| RegisterError::BadRequest)?;

  {
    let f = filters
      .read()
      .map_err(|_| RegisterError::InternalServerError)?;

    if f.email_filter.check(&req.email) {
      sqlx::query_scalar::<_, i64>(
        "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
      )
      .bind(&req.email)
      .fetch_optional(&**pool)
      .await
      .map_err(|_| RegisterError::EmailExist)?;
    }

    if f.user_filter.check(&req.username) {
      sqlx::query_scalar::<_, i64>(
        "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
      )
      .bind(&req.username)
      .fetch_optional(&**pool)
      .await
      .map_err(|_| RegisterError::UserExist)?;
    }
  }

  // Hash password and insert into global users table
  let argon2 = Argon2::default();
  let salt = SaltString::generate(&mut OsRng);

  let hash = argon2
    .hash_password_with_salt(req.password.as_bytes(), salt.as_str().as_bytes())
    .map_err(|_| RegisterError::InternalServerError)?
    .to_string();

  let result = sqlx::query_as::<_, NewUser>(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email;",
  )
  .bind(&req.username)
  .bind(&req.email)
  .bind(&hash)
  .fetch_one(&**pool)
  .await;

  let user = result.map_err(|_| RegisterError::InternalServerError)?;

  {
    let mut f = filters
      .write()
      .map_err(|_| RegisterError::InternalServerError)?;
    f.user_filter.set(&user.username);
    f.email_filter.set(&user.email);
  }

  Ok(HttpResponse::Created().json(serde_json::json!({
    "id": user.id.to_string(),
    "username": user.username,
    "email": user.email,
  })))
}
