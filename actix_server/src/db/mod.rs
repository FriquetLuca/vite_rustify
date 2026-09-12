pub mod errors;
mod migrations;
pub(crate) use migrations::run_migrations;

use crate::config::env_config;
use actix_web::web::Data;
use errors::DbError;
use sqlx::{postgres::PgPoolOptions, PgPool, Pool, Postgres};

pub(crate) async fn create_masterdb_pool(
  max: Option<u32>,
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
    .max_connections(max.unwrap_or(5))
    .connect(&database_url)
    .await
    .map_err(|err| DbError::Connection(err.to_string()))?;
  Ok(pool)
}

pub(crate) async fn migrate() -> Result<Data<Pool<Postgres>>, DbError> {
  let pool = create_masterdb_pool(None).await?;
  run_migrations(&pool).await?;
  Ok(Data::new(pool.clone()))
}
