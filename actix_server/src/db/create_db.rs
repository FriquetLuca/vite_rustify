use crate::config::env_config;
use crate::db::DbError;
use sqlx::{postgres::PgPoolOptions, PgPool};

pub async fn create_db(
  max_connections: Option<u32>,
) -> Result<PgPool, DbError> {
  let pool = PgPoolOptions::new()
    .max_connections(max_connections.unwrap_or(5))
    .connect(&env_config().db_url)
    .await
    .map_err(|err| DbError::Connection(err.to_string()))?;
  Ok(pool)
}
