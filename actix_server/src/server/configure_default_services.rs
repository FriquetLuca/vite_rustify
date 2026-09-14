#[cfg(feature = "proxy_default_service")]
use crate::config::env_config;
#[cfg(not(feature = "proxy_default_service"))]
use crate::server::csr::{create_csr_assets, create_csr_route};
#[cfg(feature = "proxy_default_service")]
use crate::server::forward::{forward, ForwardUrl};
#[cfg(feature = "vite_hmr_proxy")]
use crate::server::ws_hmr_proxy::configure_hmr_proxy;
#[cfg(feature = "proxy_default_service")]
use actix_web::web;
use actix_web::web::ServiceConfig;
#[cfg(feature = "proxy_default_service")]
use awc::Client;
#[cfg(feature = "proxy_default_service")]
use std::net::ToSocketAddrs as _;
#[cfg(feature = "proxy_default_service")]
use url::Url;

pub fn configure_default_services(cfg: &mut ServiceConfig) {
  #[cfg(feature = "proxy_default_service")]
  {
    let forward_socket_addr =
      (env_config().proxy_host.clone(), env_config().proxy_port)
        .to_socket_addrs()
        .expect("given forwarding address was not valid")
        .next()
        .expect("given forwarding address was not valid");

    let forward_url =
      Url::parse(&format!("http://{forward_socket_addr}")).unwrap();

    cfg
      .app_data(web::Data::new(Client::default()))
      .app_data(web::Data::new(ForwardUrl(forward_url)));

    #[cfg(feature = "vite_hmr_proxy")]
    configure_hmr_proxy(cfg);

    cfg.default_service(web::to(forward));
  }
  #[cfg(not(feature = "proxy_default_service"))]
  {
    cfg
      .service(create_csr_assets())
      .default_service(create_csr_route());
  }
}
