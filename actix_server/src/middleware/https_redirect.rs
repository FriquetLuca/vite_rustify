use crate::states::TrustedProxies;
use actix_web::body::{BoxBody, MessageBody};
use actix_web::web;
use actix_web::{
  dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
  http, Error, HttpResponse,
};
use futures_util::future::LocalBoxFuture;
use std::future::{ready, Ready};

fn is_secure_request(sreq: &ServiceRequest) -> bool {
  if sreq.app_config().secure() {
    return true;
  }

  let from_trusted_proxy = sreq
    .app_data::<web::Data<TrustedProxies>>()
    .map(|proxies| {
      sreq
        .peer_addr()
        .map(|addr| proxies.is_trusted(&addr.ip()))
        .unwrap_or(false)
    })
    .unwrap_or(false);

  if !from_trusted_proxy {
    return false;
  }

  sreq
    .headers()
    .get("X-Forwarded-Proto")
    .and_then(|v| v.to_str().ok())
    .map(|v| v.eq_ignore_ascii_case("https"))
    .unwrap_or(false)
}

pub struct HttpsRedirect {
  public_host_name: String,
  public_host_port: u16,
}

impl HttpsRedirect {
  pub fn new(public_host_name: String, public_host_port: u16) -> Self {
    Self {
      public_host_name,
      public_host_port,
    }
  }
}

impl<S, B> Transform<S, ServiceRequest> for HttpsRedirect
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
  S::Future: 'static,
  B: MessageBody + 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = Error;
  type InitError = ();
  type Transform = HttpsRedirectMiddleware<S>;
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ready(Ok(HttpsRedirectMiddleware {
      service,
      public_host_name: self.public_host_name.clone(),
      public_host_port: self.public_host_port,
    }))
  }
}

pub struct HttpsRedirectMiddleware<S> {
  service: S,
  public_host_name: String,
  public_host_port: u16,
}

impl<S, B> Service<ServiceRequest> for HttpsRedirectMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
  S::Future: 'static,
  B: MessageBody + 'static,
{
  type Response = ServiceResponse<BoxBody>;
  type Error = Error;
  type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

  forward_ready!(service);

  fn call(&self, req: ServiceRequest) -> Self::Future {
    if is_secure_request(&req) {
      let fut = self.service.call(req);
      return Box::pin(async move {
        let res = fut.await?;
        Ok(res.map_into_boxed_body())
      });
    }

    let uri = req.uri().to_owned();
    let host_only = self.public_host_name.clone();
    let public_port = self.public_host_port;

    let url = if public_port == 443 {
      format!("https://{host_only}{uri}")
    } else {
      format!("https://{host_only}:{public_port}{uri}")
    };

    Box::pin(async move {
      Ok(
        req.into_response(
          HttpResponse::MovedPermanently()
            .append_header((http::header::LOCATION, url))
            .finish(),
        ),
      )
    })
  }
}
