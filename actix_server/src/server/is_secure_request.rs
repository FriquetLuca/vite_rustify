use crate::states::TrustedProxies;
use actix_web::dev::ServiceRequest;
use actix_web::web;

pub fn is_secure_request(sreq: &ServiceRequest) -> bool {
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
