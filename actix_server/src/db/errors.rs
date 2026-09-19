#[derive(Clone, Debug, thiserror::Error)]
pub enum DbError {
  #[error("DB Connection Error: {0}")]
  Connection(String),
  #[error("Migration Error: {0}")]
  Migration(String),
}
