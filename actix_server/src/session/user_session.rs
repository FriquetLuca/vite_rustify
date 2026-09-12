use crate::{impl_session_storage, session::SessionError};
use actix_session::Session;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct UserSession {
  pub id: String,
}

impl_session_storage!(UserSession, "user_session");

impl TryFrom<&Session> for UserSession {
  type Error = SessionError;
  fn try_from(session: &Session) -> Result<Self, Self::Error> {
    session
      .get::<UserSession>("user_session")
      .map_err(|_| SessionError::Corrupted)?
      .ok_or_else(|| SessionError::NotLogged)
  }
}
