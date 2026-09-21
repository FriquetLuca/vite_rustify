mod config;
mod load_env;
mod rustls_config;

pub(crate) use config::Config;
use dotenv::dotenv;
use load_env::load_env;
pub use rustls_config::rustls_config;
use std::sync::OnceLock;

pub(crate) fn env_config() -> &'static Config {
  static ENV_CONFIG: OnceLock<Config> = OnceLock::new();
  ENV_CONFIG.get_or_init(|| {
    // Load environment variables from .env file
    dotenv().ok();
    match load_env() {
      Ok(config) => config,
      Err(error) => panic!("{:#?}", error),
    }
  })
}
