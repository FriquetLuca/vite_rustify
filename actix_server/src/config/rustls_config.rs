use rustls::{
  crypto::aws_lc_rs::default_provider,
  pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer},
  ServerConfig,
};

pub(crate) fn rustls_config() -> ServerConfig {
  default_provider().install_default().unwrap();

  // load TLS key/cert files
  let cert_chain = CertificateDer::pem_file_iter("cert.pem")
    .unwrap()
    .flatten()
    .collect();

  let key_der = PrivateKeyDer::from_pem_file("key.pem")
    .expect("Could not locate PKCS 8 private keys.");

  ServerConfig::builder()
    .with_no_client_auth()
    .with_single_cert(cert_chain, key_der)
    .unwrap()
}
