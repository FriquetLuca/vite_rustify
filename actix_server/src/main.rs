mod api;
mod config;
mod db;
mod middleware;
mod models;
mod server;
mod session;
mod states;

use crate::config::{env_config, rustls_config};
use crate::db::migrate;
use crate::server::create_app;
use crate::states::BloomFtr;
use actix_web::HttpServer;
use std::sync::Arc;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
  let bloom_filters = Arc::new(std::sync::RwLock::new(BloomFtr::new()));

  env_logger::init();

  println!(
    "Starting server on https://{}:{}/",
    env_config().host_name,
    env_config().host_port
  );

  let pool_data = migrate().await.unwrap();

  {
    let mut filters = bloom_filters.write().unwrap();
    let users = sqlx::query_as::<_, (String, String)>(
      "SELECT username, email FROM users",
    )
    .fetch_all(pool_data.get_ref()) // This returns &Pool<Postgres>, which implements Executor
    .await
    .expect("Nothing should goes wrong querying the users.");
    for (user, email) in users {
      filters.user_filter.set(&user);
      filters.email_filter.set(&email);
    }
  }

  HttpServer::new(move || create_app(pool_data.clone(), bloom_filters.clone()))
    .bind((env_config().host_name.as_str(), env_config().http_host_port))?
    .bind_rustls_0_23(
      (env_config().host_name.as_str(), env_config().host_port),
      rustls_config(),
    )?
    .run()
    .await
}
