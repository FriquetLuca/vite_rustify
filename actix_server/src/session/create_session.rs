use crate::{server::AppError, session::UserSession};
use actix_session::Session;
use chrono::Utc;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionKind {
  Standard,
  Elevated { ttl: chrono::Duration },
}

pub async fn create_session(
  session: &Session,
  pool: &Pool<Postgres>,
  user_id: Uuid,
  kind: SessionKind,
) -> Result<(), AppError> {
  let privilege_level = match kind {
    SessionKind::Standard => "standard",
    SessionKind::Elevated { .. } => "elevated",
  };

  let session_id: Uuid = match kind {
    SessionKind::Standard => {
      sqlx::query_scalar(
        "INSERT INTO sessions (user_id, privilege_level)
                 VALUES ($1, $2)
                 RETURNING id",
      )
      .bind(user_id)
      .bind(privilege_level)
      .fetch_one(pool)
      .await?
    }
    SessionKind::Elevated { ttl } => {
      let expires_at = Utc::now() + ttl;

      sqlx::query_scalar(
        "INSERT INTO sessions (user_id, privilege_level, expires_at)
                 VALUES ($1, $2, $3)
                 RETURNING id",
      )
      .bind(user_id)
      .bind(privilege_level)
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
