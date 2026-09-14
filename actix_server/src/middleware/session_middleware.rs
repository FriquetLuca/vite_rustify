use crate::config::env_config;
use actix_session::{
  config::PersistentSession, storage::CookieSessionStore, SessionMiddleware,
};
use actix_web::cookie::{time::Duration, Key};

pub fn session_middleware() -> SessionMiddleware<CookieSessionStore> {
  SessionMiddleware::builder(
    CookieSessionStore::default(),
    env_config()
      .session_secret
      .clone()
      .map(|key| Key::from(key.as_bytes()))
      .unwrap_or(Key::from(&[0; 64])),
  )
  .cookie_secure(true)
  .session_lifecycle(
    PersistentSession::default().session_ttl(Duration::hours(1)),
  )
  .build()
}
