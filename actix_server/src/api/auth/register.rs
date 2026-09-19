use crate::{server::AppError, states::SharedBloom};
use actix_web::{post, web, HttpResponse, Responder};
use argon2::{Argon2, PasswordHasher};
use password_hash::SaltString;
use rand_core::OsRng;
use regex::Regex;
use serde::Deserialize;
use sqlx::PgPool;
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

#[derive(sqlx::FromRow)]
struct NewUser {
  username: String,
  email: String,
}

#[post("/register")]
pub async fn register_route(
  pool: web::Data<PgPool>,
  filters: web::Data<SharedBloom>,
  req: web::Json<RegisterRequest>,
) -> Result<impl Responder, AppError> {
  req.0.validate().map_err(|_| AppError::BadRequest)?;

  {
    let f = filters.read().map_err(|_| AppError::InternalServerError)?;

    if f.email_filter.check(&req.email) {
      sqlx::query_scalar::<_, i64>(
        "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
      )
      .bind(&req.email)
      .fetch_optional(&**pool)
      .await
      .map_err(|_| AppError::conflict("EMAIL_EXIST"))?;
    }

    if f.user_filter.check(&req.username) {
      sqlx::query_scalar::<_, i64>(
        "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
      )
      .bind(&req.username)
      .fetch_optional(&**pool)
      .await
      .map_err(|_| AppError::conflict("USER_EXIST"))?;
    }
  }

  // Hash password and insert into global users table
  let argon2 = Argon2::default();
  let salt = SaltString::generate(&mut OsRng);

  let hash = argon2
    .hash_password_with_salt(req.password.as_bytes(), salt.as_str().as_bytes())
    .map_err(|_| AppError::InternalServerError)?
    .to_string();

  let user = sqlx::query_as::<_, NewUser>(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING username, email",
  )
    .bind(&req.username)
    .bind(&req.email)
    .bind(&hash)
    .fetch_one(&**pool)
    .await?;

  {
    let mut f = filters.write().map_err(|_| AppError::InternalServerError)?;
    f.user_filter.set(&user.username);
    f.email_filter.set(&user.email);
  }

  Ok(HttpResponse::Created().json(serde_json::json!({
    "username": user.username,
    "email": user.email,
  })))
}
