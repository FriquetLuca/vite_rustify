#[macro_export]
macro_rules! impl_session_storage {
  ($type:ty, $key:expr) => {
    impl $type {
      #[allow(dead_code)]
      pub fn store_session(
        self,
        session: &actix_session::Session,
      ) -> Result<(), SessionError> {
        session
          .insert($key, self)
          .map_err(|_| SessionError::InternalServerError)
      }
      #[allow(dead_code)]
      pub fn remove_session(session: &actix_session::Session) {
        let _ = session.remove($key);
      }
      #[allow(dead_code)]
      pub fn get_session(
        session: &actix_session::Session,
      ) -> Result<Option<Self>, SessionError>
      where
        Self: serde::de::DeserializeOwned,
      {
        session
          .get::<Self>($key)
          .map_err(|_| SessionError::InternalServerError)
      }
    }
  };
}
