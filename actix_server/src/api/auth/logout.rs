use actix_session::Session;
use actix_web::{post, Responder};

use crate::models::{DataResponse, NoError};

#[post("/logout")]
async fn logout_route(session: Session) -> impl Responder {
  session.purge();
  DataResponse::<(), NoError> {
    success: true,
    data: None,
    error: None,
  }
}
