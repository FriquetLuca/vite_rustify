#[cfg(not(feature = "proxy_default_service"))]
use crate::server::csr::{create_csr_route, create_csr_assets};
#[cfg(feature = "proxy_default_service")]
use crate::server::forward::forward;
#[cfg(feature = "proxy_default_service")]
use actix_web::web;
#[cfg(feature = "proxy_default_service")]
use crate::config::env_config;
#[cfg(feature = "proxy_default_service")]
use std::net::ToSocketAddrs as _;
#[cfg(feature = "proxy_default_service")]
use url::Url;
#[cfg(feature = "proxy_default_service")]
use awc::Client;
use actix_web::web::ServiceConfig;

pub fn configure_default_services(cfg: &mut ServiceConfig) {
  #[cfg(feature = "proxy_default_service")]
  {
    let forward_socket_addr = (env_config().proxy_host.clone(), env_config().proxy_port)
        .to_socket_addrs()
        .expect("given forwarding address was not valid")
        .next()
        .expect("given forwarding address was not valid");

    let forward_url = format!("http://{forward_socket_addr}");
    let forward_url = Url::parse(&forward_url).unwrap();

    cfg
      .app_data(web::Data::new(Client::default()))
      .app_data(web::Data::new(forward_url.clone()))
      .default_service(web::to(forward));
  }
  #[cfg(not(feature = "proxy_default_service"))]
  {
    cfg.service(create_csr_assets())
        .default_service(create_csr_route());
  }
}
