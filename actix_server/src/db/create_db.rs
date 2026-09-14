use crate::config::env_config;
use crate::db::DbError;
use sqlx::{postgres::PgPoolOptions, PgPool};

pub async fn create_db(
  max_connections: Option<u32>,
) -> Result<PgPool, DbError> {
  let database_url = format!(
    "postgres://{}:{}@{}:{}/{}",
    env_config().db_user,
    env_config().db_pswd,
    env_config().db_host,
    env_config().db_port,
    env_config().db_database
  );
  let pool = PgPoolOptions::new()
    .max_connections(max_connections.unwrap_or(5))
    .connect(&database_url)
    .await
    .map_err(|err| DbError::Connection(err.to_string()))?;
  Ok(pool)
}
