use super::config::ConfigError;
use crate::config::Config;
use crate::states::TrustedProxies;
use std::str::FromStr;

pub fn load_env() -> Result<Config, ConfigError> {
  let raw_proxies = std::env::var("TRUSTED_PROXIES").unwrap_or_default();
  let proxy_entries: Vec<&str> = raw_proxies
    .split(',')
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .collect();
  let trusted_proxies = TrustedProxies::from_strs(proxy_entries)
    .expect("TRUSTED_PROXIES contains an invalid IP or CIDR entry");
  let default_host = "0.0.0.0".to_string();
  let default_host_port = 443;

  Ok(Config {
    host_name: std::env::var("HOST").unwrap_or_else(|_| default_host.clone()),
    host_port: std::env::var("PORT")
      .ok()
      .map(|host_port| {
        u16::from_str(host_port.as_str())
          .map_err(|_| ConfigError::Parse("PORT".to_string()))
      })
      .transpose()?
      .unwrap_or(default_host_port),
    http_host_port: std::env::var("HTTP_PORT")
      .ok()
      .map(|host_port| {
        u16::from_str(host_port.as_str())
          .map_err(|_| ConfigError::Parse("HTTP_PORT".to_string()))
      })
      .transpose()?
      .unwrap_or(default_host_port),
    public_host_name: std::env::var("PUBLIC_HOST")
      .unwrap_or_else(|_| default_host.clone()),
    public_host_port: std::env::var("PUBLIC_PORT")
      .ok()
      .map(|host_port| {
        u16::from_str(host_port.as_str())
          .map_err(|_| ConfigError::Parse("PUBLIC_PORT".to_string()))
      })
      .transpose()?
      .unwrap_or(default_host_port),
    db_url: if cfg!(test) {
      std::env::var("TEST_DATABASE_URL")
        .map_err(|_| ConfigError::Missing("TEST_DATABASE_URL".to_string()))?
    } else {
      std::env::var("DATABASE_URL")
        .map_err(|_| ConfigError::Missing("DATABASE_URL".to_string()))?
    },
    session_secret: match std::env::var("SESSION_SECRET") {
      Ok(key) => Ok(Some(key)),
      Err(err) => match err {
        std::env::VarError::NotPresent => Ok(None),
        std::env::VarError::NotUnicode(_) => Err(ConfigError::Session(
          "SESSION_SECRET not unicode".to_string(),
        )),
      },
    }?,
    #[cfg(not(feature = "proxy_default_service"))]
    assets_path: std::env::var("VITE_BASE_PATH")
      .unwrap_or_else(|_| String::from("/")),
    #[cfg(feature = "proxy_default_service")]
    proxy_host: std::env::var("VITE_HOST").unwrap_or_else(|_| default_host),
    #[cfg(feature = "proxy_default_service")]
    proxy_port: std::env::var("VITE_PORT")
      .ok()
      .map(|host_port| {
        u16::from_str(host_port.as_str())
          .map_err(|_| ConfigError::Parse("VITE_PORT".to_string()))
      })
      .transpose()?
      .unwrap_or(5173),
    #[cfg(feature = "proxy_default_service")]
    proxy_ws_port: std::env::var("VITE_WS_PORT")
      .ok()
      .map(|host_port| {
        u16::from_str(host_port.as_str())
          .map_err(|_| ConfigError::Parse("VITE_WS_PORT".to_string()))
      })
      .transpose()?
      .unwrap_or(24678),
    trusted_proxies,
  })
}
