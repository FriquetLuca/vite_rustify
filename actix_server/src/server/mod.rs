mod configure_default_services;
mod create_app;
mod error;
#[cfg(feature = "proxy_default_service")]
mod forward;
mod health;
#[cfg(feature = "vite_hmr_proxy")]
mod ws_hmr_proxy;

pub(crate) use create_app::create_app;
pub use error::AppError;
