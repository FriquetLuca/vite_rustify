#[derive(Clone, Debug, thiserror::Error)]
pub enum DbError {
  #[error("DB Connection Error: {0}")]
  Connection(String),
  #[error("Migration Error for {0}: {1}")]
  Migration(String, String),
  #[error("Query Error: {0}")]
  Query(String),
}
