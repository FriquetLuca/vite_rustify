use actix_session::Session;
use actix_web::{post, HttpResponse, Responder};

#[post("/logout")]
async fn logout_route(session: Session) -> impl Responder {
  session.purge();
  HttpResponse::NoContent()
}
