use crate::db::DbError;
use sqlx::{migrate::Migrator, PgPool};

static MASTER_MIGRATOR: Migrator = sqlx::migrate!();

pub async fn run_migrations(pool: &PgPool) -> Result<(), DbError> {
  MASTER_MIGRATOR
    .run(pool)
    .await
    .map_err(|err| DbError::Migration("master".into(), err.to_string()))
}
