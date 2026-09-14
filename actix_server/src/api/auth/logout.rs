use actix_session::Session;
use actix_web::{HttpResponse, Responder, post};

#[post("/logout")]
async fn logout_route(session: Session) -> impl Responder {
  session.purge();
  HttpResponse::NoContent()
}
