#[cfg(feature = "proxy_default_service")]
use ipnetwork::IpNetwork;
#[cfg(feature = "proxy_default_service")]
use std::net::IpAddr;

/// IPs of proxies (load balancers, CDNs, etc.) whose inbound `X-Forwarded-For` /
/// `Forwarded` headers we trust as accurate. If the immediate peer is NOT in
/// this set, its forwarding headers are ignored and it is treated as the
/// actual client — this prevents an untrusted caller from spoofing its own
/// IP by just setting the header itself.
#[derive(Default)]
#[cfg(feature = "proxy_default_service")]
pub struct TrustedProxies(Vec<IpNetwork>);
#[cfg(not(feature = "proxy_default_service"))]
pub struct TrustedProxies;

impl TrustedProxies {
    #[cfg(feature = "proxy_default_service")]
    pub fn is_trusted(&self, addr: &IpAddr) -> bool {
        self.0.iter().any(|net| net.contains(*addr))
    }

    // Builds a `TrustedProxies` set from an array of IP or CIDR strings
    /// (e.g. "203.0.113.10" or "203.0.113.0/24"). A bare IP is treated as
    /// a /32 (or /128 for IPv6) — i.e. matching that single address.
    /// Returns an error if any entry fails to parse, so callers (e.g.
    /// reading from CLI args or a config file) can fail fast with a clear
    /// message instead of silently dropping a malformed entry.
    pub fn from_strs<'a>(
        #[cfg(feature = "proxy_default_service")]
        entries: impl IntoIterator<Item = &'a str>,
    ) -> Result<Self, ipnetwork::IpNetworkError> {
        #[cfg(not(feature = "proxy_default_service"))]
        {
            Ok(TrustedProxies)
        }
        #[cfg(feature = "proxy_default_service")]
        {
            entries
                .into_iter()
                .map(|s| s.parse::<IpNetwork>())
                .collect::<Result<Vec<_>, _>>()
                .map(TrustedProxies)
        }
    }
}
