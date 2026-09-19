use actix_session::Session;
use actix_web::{post, web, HttpResponse, Responder};
use sqlx::PgPool;

use crate::{server::AppError, session::clear_session};

#[post("/logout")]
async fn logout_route(
  pool: web::Data<PgPool>,
  session: Session,
) -> Result<impl Responder, AppError> {
  clear_session(&session, &**pool).await?;
  Ok(HttpResponse::NoContent())
}
