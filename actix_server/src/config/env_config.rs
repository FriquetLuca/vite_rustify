use dotenv::dotenv;
use std::str::FromStr;
use std::sync::OnceLock;

use crate::states::TrustedProxies;

pub(crate) struct Config {
  pub(crate) host_name: String,
  pub(crate) host_port: u16,
  pub(crate) http_host_port: u16,
  pub(crate) public_host_name: String,
  pub(crate) public_host_port: u16,
  pub(crate) db_user: String,
  pub(crate) db_pswd: String,
  pub(crate) db_host: String,
  pub(crate) db_port: usize,
  pub(crate) db_database: String,
  pub(crate) session_secret: Option<String>,
  pub(crate) trusted_proxies: TrustedProxies,
  #[cfg(not(feature = "proxy_default_service"))]
  pub(crate) assets_path: String,
  #[cfg(feature = "proxy_default_service")]
  pub(crate) proxy_host: String,
  #[cfg(feature = "proxy_default_service")]
  pub(crate) proxy_port: u16,
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

fn load_config() -> Result<Config, ConfigError> {
  let raw_proxies = std::env::var("TRUSTED_PROXIES").unwrap_or_default();
  let proxy_entries: Vec<&str> = raw_proxies
    .split(',')
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .collect();
  let trusted_proxies = TrustedProxies::from_strs(proxy_entries)
    .expect("TRUSTED_PROXIES contains an invalid IP or CIDR entry");

  #[cfg(test)]
  {
    Ok(Config {
      host_name: std::env::var("HOST")
        .unwrap_or_else(|_| String::from("0.0.0.0")),
      host_port: std::env::var("PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(443),
      http_host_port: std::env::var("HTTP_PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("HTTP_PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(443),
      public_host_name: std::env::var("PUBLIC_HOST")
        .unwrap_or_else(|_| String::from("0.0.0.0")),
      public_host_port: std::env::var("PUBLIC_PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("PUBLIC_PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(443),
      db_user: std::env::var("PG__USER")
        .map_err(|_| ConfigError::Missing("PG__USER".to_string()))?,
      db_pswd: std::env::var("PG__PASSWORD")
        .map_err(|_| ConfigError::Missing("PG__PASSWORD".to_string()))?,
      db_host: std::env::var("PG__HOST")
        .map_err(|_| ConfigError::Missing("PG__HOST".to_string()))?,
      db_port: {
        let port = std::env::var("PG__PORT")
          .map_err(|_| ConfigError::Missing("PG__PORT".to_string()))?;
        usize::from_str(port.as_str())
          .map_err(|_| ConfigError::Parse("PG__PORT".to_string()))?
      },
      db_database: "strategy_test_master".to_string(),
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
      proxy_host: std::env::var("VITE_HOST")
        .unwrap_or_else(|_| String::from("0.0.0.0")),
      #[cfg(feature = "proxy_default_service")]
      proxy_port: std::env::var("VITE_PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("VITE_PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(5173),
      trusted_proxies,
    })
  }
  #[cfg(not(test))]
  {
    Ok(Config {
      host_name: std::env::var("HOST")
        .unwrap_or_else(|_| String::from("0.0.0.0")),
      host_port: std::env::var("PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(443),
      http_host_port: std::env::var("HTTP_PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("HTTP_PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(443),
      public_host_name: std::env::var("PUBLIC_HOST")
        .unwrap_or_else(|_| String::from("0.0.0.0")),
      public_host_port: std::env::var("PUBLIC_PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("PUBLIC_PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(443),
      db_user: std::env::var("PG__USER")
        .map_err(|_| ConfigError::Missing("PG__USER".to_string()))?,
      db_pswd: std::env::var("PG__PASSWORD")
        .map_err(|_| ConfigError::Missing("PG__PASSWORD".to_string()))?,
      db_host: std::env::var("PG__HOST")
        .map_err(|_| ConfigError::Missing("PG__HOST".to_string()))?,
      db_port: {
        let port = std::env::var("PG__PORT")
          .map_err(|_| ConfigError::Missing("PG__PORT".to_string()))?;
        usize::from_str(port.as_str())
          .map_err(|_| ConfigError::Parse("PG__PORT".to_string()))?
      },
      db_database: std::env::var("PG__DBNAME")
        .map_err(|_| ConfigError::Missing("PG__DBNAME".to_string()))?,
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
      proxy_host: std::env::var("VITE_HOST")
        .unwrap_or_else(|_| String::from("0.0.0.0")),
      #[cfg(feature = "proxy_default_service")]
      proxy_port: std::env::var("VITE_PORT")
        .ok()
        .map(|host_port| {
          u16::from_str(host_port.as_str())
            .map_err(|_| ConfigError::Parse("VITE_PORT".to_string()))
        })
        .transpose()?
        .unwrap_or(5173),
      trusted_proxies,
    })
  }
}

pub(crate) fn env_config() -> &'static Config {
  static ENV_CONFIG: OnceLock<Config> = OnceLock::new();
  ENV_CONFIG.get_or_init(|| {
    // Load environment variables from .env file
    dotenv().ok();
    match load_config() {
      Ok(config) => config,
      Err(error) => panic!("{:#?}", error),
    }
  })
}
