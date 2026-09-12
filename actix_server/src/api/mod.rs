mod auth;

use actix_web::{web, Scope};

pub fn create_router() -> Scope {
  web::scope("/api").service(auth::create_router())
}
