mod configure_default_services;
mod create_app;
#[cfg(not(feature = "proxy_default_service"))]
mod csr;
mod error;
#[cfg(feature = "proxy_default_service")]
mod forward;
#[cfg(feature = "vite_hmr_proxy")]
mod ws_hmr_proxy;

pub(crate) use create_app::create_app;
pub use error::AppError;
