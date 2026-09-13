mod configure_default_services;
#[cfg(not(feature = "proxy_default_service"))]
mod csr;
mod error;
#[cfg(feature = "proxy_default_service")]
mod forward;
mod https_redirect;
mod is_secure_request;
#[cfg(feature = "vite_hmr_proxy")]
mod ws_hmr_proxy;

use crate::config::env_config;
use crate::server::configure_default_services::configure_default_services;
use crate::server::https_redirect::HttpsRedirect;
use crate::states::SharedBloom;
use actix_web::body::MessageBody;
use actix_web::dev::{ServiceFactory, ServiceRequest, ServiceResponse};
use actix_web::middleware::Logger;
use actix_web::web::Data;
use actix_web::{web, App, HttpResponse};
use error::AppError;
use sqlx::{Pool, Postgres};

pub(crate) fn create_app(
  pool_data: Data<Pool<Postgres>>,
  bloom_filters: SharedBloom,
) -> App<
  impl ServiceFactory<
    ServiceRequest,
    Response = ServiceResponse<impl MessageBody>,
    Config = (),
    InitError = (),
    Error = actix_web::Error,
  >,
> {
  let json_config =
    web::JsonConfig::default().error_handler(|err, _req| match err {
      actix_web::error::JsonPayloadError::OverflowKnownLength {
        length: _,
        limit: _,
      } => actix_web::error::InternalError::from_response(
        AppError::PayloadTooLarge,
        HttpResponse::BadRequest().finish(),
      )
      .into(),
      actix_web::error::JsonPayloadError::Overflow { limit: _ } => {
        actix_web::error::InternalError::from_response(
          AppError::PayloadTooLarge,
          HttpResponse::BadRequest().finish(),
        )
        .into()
      }
      actix_web::error::JsonPayloadError::Payload(_) => {
        actix_web::error::InternalError::from_response(
          AppError::InternalServerError,
          HttpResponse::BadRequest().finish(),
        )
        .into()
      }
      _ => actix_web::error::InternalError::from_response(
        AppError::BadRequest,
        HttpResponse::BadRequest().finish(),
      )
      .into(),
    });
  let trusted_proxies = env_config().trusted_proxies.clone();
  App::new()
    .wrap(HttpsRedirect::new(
      env_config().public_host_name.clone(),
      env_config().public_host_port,
    ))
    .wrap(Logger::default())
    .wrap(crate::middleware::create_session_middleware())
    .app_data(json_config)
    .app_data(pool_data.clone())
    .app_data(Data::new(bloom_filters.clone()))
    .app_data(Data::new(trusted_proxies))
    .service(crate::api::create_router())
    .configure(configure_default_services)
}
