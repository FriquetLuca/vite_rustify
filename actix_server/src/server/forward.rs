use std::net::IpAddr;

use crate::states::TrustedProxies;
use actix_web::{dev::PeerAddr, error, web, Error, HttpRequest, HttpResponse};
use awc::Client;
use url::Url;

/// Builds a `Forwarded` header value per RFC 7239.
///
/// If the immediate peer is a trusted proxy, any existing `Forwarded` header
/// on the request is preserved and this hop is appended to it (multi-hop
/// chaining). If the peer is not trusted, a fresh header is started instead,
/// discarding whatever the untrusted caller claimed.
fn build_forwarded_header(
  req: &HttpRequest,
  peer_addr: Option<&PeerAddr>,
  trusted: &TrustedProxies,
) -> String {
  let conn_info = req.connection_info();
  let scheme = conn_info.scheme().to_owned();
  let host = conn_info.host().to_owned();
  drop(conn_info);

  let mut parts = Vec::new();

  if let Some(PeerAddr(addr)) = peer_addr {
    let ip = addr.ip();
    // IPv6 "for" values must be bracketed and quoted: for="[2001:db8::1]"
    let for_val = match ip {
      IpAddr::V6(_) => format!("\"[{}]\"", ip),
      IpAddr::V4(_) => ip.to_string(),
    };
    parts.push(format!("for={for_val}"));
  }

  parts.push(format!("proto={scheme}"));
  // host may contain ':port', which needs quoting as it's not a valid token char
  parts.push(format!("host=\"{host}\""));

  let new_element = parts.join(";");

  let is_trusted = peer_addr
    .map(|PeerAddr(addr)| trusted.is_trusted(&addr.ip()))
    .unwrap_or(false);

  if is_trusted {
    match req.headers().get("forwarded").and_then(|v| v.to_str().ok()) {
      Some(existing) if !existing.is_empty() => {
        format!("{existing}, {new_element}")
      }
      _ => new_element,
    }
  } else {
    new_element
  }
}

/// Builds the `X-Forwarded-For` value for this hop, appending to an existing
/// chain only if the immediate peer is trusted; otherwise starts fresh.
fn build_x_forwarded_for(
  req: &HttpRequest,
  peer_addr: Option<&PeerAddr>,
  trusted: &TrustedProxies,
) -> Option<String> {
  let PeerAddr(addr) = peer_addr?;
  let this_hop = addr.ip().to_string();

  if trusted.is_trusted(&addr.ip()) {
    match req
      .headers()
      .get("x-forwarded-for")
      .and_then(|v| v.to_str().ok())
    {
      Some(existing) if !existing.is_empty() => {
        Some(format!("{existing}, {this_hop}"))
      }
      _ => Some(this_hop),
    }
  } else {
    Some(this_hop)
  }
}

/// Forwards the incoming HTTP request using `awc`.
pub async fn forward(
  req: HttpRequest,
  payload: web::Payload,
  peer_addr: Option<PeerAddr>,
  url: web::Data<Url>,
  client: web::Data<Client>,
  trusted_proxies: web::Data<TrustedProxies>,
) -> Result<HttpResponse, Error> {
  let mut new_url = (**url).clone();
  new_url.set_path(req.uri().path());
  new_url.set_query(req.uri().query());

  let forwarded_req = client
    .request_from(new_url.as_str(), req.head())
    .no_decompress();

  let forwarded_req =
    match build_x_forwarded_for(&req, peer_addr.as_ref(), &trusted_proxies) {
      Some(xff) => forwarded_req.insert_header(("x-forwarded-for", xff)),
      None => forwarded_req,
    };

  let forwarded_req = forwarded_req.insert_header((
    "forwarded",
    build_forwarded_header(&req, peer_addr.as_ref(), &trusted_proxies),
  ));

  let res = forwarded_req
    .send_stream(payload)
    .await
    .map_err(error::ErrorInternalServerError)?;

  let mut client_resp = HttpResponse::build(res.status());
  // Remove `Connection` as per
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Connection#Directives
  for (header_name, header_value) in
    res.headers().iter().filter(|(h, _)| *h != "connection")
  {
    client_resp.insert_header((header_name.clone(), header_value.clone()));
  }

  Ok(client_resp.streaming(res))
}
