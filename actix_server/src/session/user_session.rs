use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct UserSession {
  pub id: String,
}
