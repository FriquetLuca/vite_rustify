use actix_session::Session;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{server::AppError, session::UserSession};

pub async fn clear_session(
  session: &Session,
  pool: &PgPool,
) -> Result<(), AppError> {
  if let Some(user_session) =
    session.get::<UserSession>("user_session").ok().flatten()
  {
    if let Ok(session_id) = Uuid::parse_str(&user_session.id) {
      sqlx::query(
                "UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL",
            )
            .bind(session_id)
            .execute(pool)
            .await?;
    }
  }

  session.purge();
  Ok(())
}
