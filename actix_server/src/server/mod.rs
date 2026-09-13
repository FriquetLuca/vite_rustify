mod configure_default_services;
#[cfg(not(feature = "proxy_default_service"))]
mod csr;
mod error;
#[cfg(feature = "proxy_default_service")]
mod forward;
mod is_secure_request;

use crate::config::env_config;
use crate::server::configure_default_services::configure_default_services;
use crate::server::is_secure_request::is_secure_request;
use crate::states::SharedBloom;
use actix_web::body::MessageBody;
use actix_web::dev::{
  Service, ServiceFactory, ServiceRequest, ServiceResponse,
};
use actix_web::http;
use actix_web::middleware::Logger;
use actix_web::web::Data;
use actix_web::{web, App, HttpResponse};
use error::AppError;
use futures_util::future::{self, Either, FutureExt};
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
    .wrap_fn(|sreq, srv| {
      if is_secure_request(&sreq) {
        return Either::Left(srv.call(sreq).map(|res| res));
      }

      let uri = sreq.uri().to_owned();
      let host_only = &env_config().public_host_name;
      let public_port = env_config().public_host_port;

      let url = if public_port == 443 {
        format!("https://{host_only}{uri}")
      } else {
        format!("https://{host_only}:{public_port}{uri}")
      };

      Either::Right(future::ready(Ok(
        sreq.into_response(
          HttpResponse::MovedPermanently()
            .append_header((http::header::LOCATION, url))
            .finish(),
        ),
      )))
    })
    .wrap(Logger::default())
    .wrap(crate::middleware::create_session_middleware())
    .app_data(json_config)
    .app_data(pool_data.clone())
    .app_data(Data::new(bloom_filters.clone()))
    .app_data(Data::new(trusted_proxies))
    .service(crate::api::create_router())
    .configure(configure_default_services)
}
