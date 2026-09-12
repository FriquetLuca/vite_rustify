mod login;
mod logout;
mod register;

use actix_web::{web, Scope};

pub fn create_router() -> Scope {
  web::scope("/auth")
    .service(register::register_route)
    .service(login::login_route)
    .service(logout::logout_route)
}
