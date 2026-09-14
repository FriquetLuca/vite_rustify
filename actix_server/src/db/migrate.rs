use crate::db::DbError;
use crate::db::{create_db, run_migrations};
use actix_web::web::Data;
use sqlx::{Pool, Postgres};

pub async fn migrate() -> Result<Data<Pool<Postgres>>, DbError> {
  let pool = create_db(None).await?;
  run_migrations(&pool).await?;
  Ok(Data::new(pool.clone()))
}
