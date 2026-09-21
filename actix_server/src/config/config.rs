use crate::states::TrustedProxies;

pub(crate) struct Config {
  pub(crate) host_name: String,
  pub(crate) host_port: u16,
  pub(crate) http_host_port: u16,
  pub(crate) public_host_name: String,
  pub(crate) public_host_port: u16,
  pub(crate) db_url: String,
  pub(crate) session_secret: Option<String>,
  pub(crate) trusted_proxies: TrustedProxies,
  #[cfg(not(feature = "proxy_default_service"))]
  pub(crate) assets_path: String,
  #[cfg(feature = "proxy_default_service")]
  pub(crate) proxy_host: String,
  #[cfg(feature = "proxy_default_service")]
  pub(crate) proxy_port: u16,
  #[cfg(feature = "proxy_default_service")]
  pub(crate) proxy_ws_port: u16,
}

#[derive(Clone, Debug, thiserror::Error)]
pub enum ConfigError {
  #[error("Failed to parse key: {0}")]
  Parse(String),
  #[error("Missing key: {0}")]
  Missing(String),
  #[error("Session key: {0}")]
  Session(String),
}
