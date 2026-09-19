use actix_session::SessionExt;
use actix_web::{
  dev::{Service, ServiceRequest, ServiceResponse, Transform},
  Error, HttpMessage,
};
use futures_util::future::{ready, LocalBoxFuture, Ready};
use sqlx::{Pool, Postgres};
use std::rc::Rc;
use uuid::Uuid;

use crate::{extractors::AuthenticatedUser, session::UserSession};

pub struct SessionValidation;

impl<S, B> Transform<S, ServiceRequest> for SessionValidation
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>
    + 'static,
  B: 'static,
{
  type Response = ServiceResponse<B>;
  type Error = Error;
  type InitError = ();
  type Transform = SessionValidationMiddleware<S>;
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ready(Ok(SessionValidationMiddleware {
      service: Rc::new(service),
    }))
  }
}

pub struct SessionValidationMiddleware<S> {
  service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for SessionValidationMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>
    + 'static,
  B: 'static,
{
  type Response = ServiceResponse<B>;
  type Error = Error;
  type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

  actix_web::dev::forward_ready!(service);

  fn call(&self, req: ServiceRequest) -> Self::Future {
    let session = req.get_session();
    let session_id = session
      .get::<UserSession>("user_session")
      .ok()
      .flatten()
      .map(|s| Uuid::parse_str(s.id.as_str()).ok())
      .flatten();

    let pool = req
      .app_data::<actix_web::web::Data<Pool<Postgres>>>()
      .cloned();
    let service = Rc::clone(&self.service);

    Box::pin(async move {
      if let (Some(session_id), Some(pool)) = (session_id, pool) {
        let user: Option<AuthenticatedUser> = sqlx::query_as(
                    "SELECT user_id, privilege_level FROM sessions WHERE id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())",
                )
                    .bind(session_id)
                    .fetch_optional(&**pool)
                    .await
                    .unwrap_or(None);

        if let Some(user) = user {
          req.extensions_mut().insert(user);
        }
      }

      service.call(req).await
    })
  }
}
