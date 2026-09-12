use crate::states::TrustedProxies;

pub fn trusted_proxies_data() -> TrustedProxies {
  #[cfg(feature = "proxy_default_service")]
  {
    TrustedProxies::from_strs([
        "203.0.113.0/24",   // example: load balancer subnet (TEST-NET-3, RFC 5737)
        "203.0.113.10",  // example: load balancer node A (TEST-NET-3, RFC 5737)
        "203.0.113.11",  // example: load balancer node B
        "198.51.100.42", // example: CDN edge egress (TEST-NET-2, RFC 5737)
    ])
    .expect("hardcoded example IPs should always be valid")
  }
  #[cfg(not(feature = "proxy_default_service"))]
  {
    TrustedProxies::from_strs()
    .expect("This should always be valid")
  }
}
