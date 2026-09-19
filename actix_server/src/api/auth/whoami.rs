use actix_web::{get, HttpResponse};

use crate::extractors::AuthenticatedUser;

#[get("/whoami")]
pub async fn whoami_route(user: AuthenticatedUser) -> HttpResponse {
  HttpResponse::Ok().json(serde_json::json!({
      "user_id": user.user_id.to_string(),
  }))
}
