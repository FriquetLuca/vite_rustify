use sqlx::{migrate::Migrator, PgPool};

use crate::db::DbError;

static MASTER_MIGRATOR: Migrator =
  sqlx::migrate!("./migrations/master");

pub(crate) async fn run_migrations(
  pool: &PgPool,
) -> Result<(), DbError> {
  MASTER_MIGRATOR.run(pool).await.map_err(|err| {
    DbError::Migration("master".into(), err.to_string())
  })
}
