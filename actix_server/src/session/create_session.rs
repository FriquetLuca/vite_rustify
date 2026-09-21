use crate::{server::AppError, session::UserSession};
use actix_session::Session;
use actix_web::HttpRequest;
use chrono::Utc;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionKind {
  Standard,
  Elevated { ttl: chrono::Duration },
}

fn derive_device_label(req: &HttpRequest) -> Option<String> {
  let ua = req.headers().get("User-Agent")?.to_str().ok()?;
  let parsed = woothee::parser::Parser::new().parse(ua)?;
  Some(format!("{}|{}", parsed.name, parsed.os))
}

pub async fn create_session(
  req: &HttpRequest,
  session: &Session,
  pool: &Pool<Postgres>,
  user_id: Uuid,
  kind: SessionKind,
) -> Result<(), AppError> {
  let privilege_level = match kind {
    SessionKind::Standard => "standard",
    SessionKind::Elevated { .. } => "elevated",
  };

  let device_label = derive_device_label(req);

  let session_id: Uuid = match kind {
    SessionKind::Standard => {
      sqlx::query_scalar(
        "INSERT INTO sessions (user_id, privilege_level, device_label)
                 VALUES ($1, $2, $3)
                 RETURNING id",
      )
      .bind(user_id)
      .bind(privilege_level)
      .bind(device_label)
      .fetch_one(pool)
      .await?
    }
    SessionKind::Elevated { ttl } => {
      let expires_at = Utc::now() + ttl;

      sqlx::query_scalar(
        "INSERT INTO sessions (user_id, privilege_level, device_label, expires_at)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id",
      )
      .bind(user_id)
      .bind(privilege_level)
      .bind(device_label)
      .bind(expires_at)
      .fetch_one(pool)
      .await?
    }
  };

  if let Err(_) = session.insert(
    "user_session",
    UserSession {
      id: session_id.to_string(),
    },
  ) {
    session.clear();
    Err(AppError::Unauthorized)
  } else {
    Ok(())
  }
}
