use bloomfilter::Bloom;
use std::sync::Arc;

pub type SharedBloom = Arc<std::sync::RwLock<BloomFtr>>;

#[derive(Debug)]
pub struct BloomFtr {
  pub user_filter: Bloom<String>,
  pub email_filter: Bloom<String>,
}

impl BloomFtr {
  pub fn new() -> Self {
    BloomFtr {
      user_filter: Bloom::<String>::new_for_fp_rate(1_000_000, 0.001).unwrap(),
      email_filter: Bloom::<String>::new_for_fp_rate(1_000_000, 0.001).unwrap(),
    }
  }
}
