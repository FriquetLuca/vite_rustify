use crate::config::env_config;
use actix_files::{Files, NamedFile};
use actix_web::{web, Either, HttpResponse, Route};
use std::path::PathBuf;

fn get_dist_path() -> PathBuf {
  let manifest_dir = env!("CARGO_MANIFEST_DIR");
  // Traverses up or laterally depending on your workspace layout.
  let path = std::path::Path::new(manifest_dir)
    .parent()
    .unwrap_or_else(|| std::path::Path::new(manifest_dir))
    .join("vite_csr")
    .join("dist");

  if path.exists() {
    path
  } else {
    panic!("The path to 'vite_csr/dist' does not exist. You may want to compile your frontend before running the server.");
  }
}

pub fn create_csr_assets() -> Files {
  Files::new(&env_config().assets_path, get_dist_path())
    .path_filter(|path, _req| path.to_str() != Some("index.html"))
    .show_files_listing()
}

pub fn create_csr_route() -> Route {
  web::to(|| async {
    let index_path = get_dist_path().join("index.html");
    if index_path.exists() {
      // Production flow: Wrap the NamedFile result in Either::Left
      match NamedFile::open(index_path) {
        Ok(file) => Either::Left(file),
        Err(_) => Either::Right(
          HttpResponse::InternalServerError().body("Failed to read index.html"),
        ),
      }
    } else {
      Either::Right(HttpResponse::NotFound().body("index.html not found"))
    }
  })
}
