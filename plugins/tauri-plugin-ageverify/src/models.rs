use serde::{Deserialize, Serialize};

/// Result of an age-range request.
///
/// The raw age band is only surfaced so the frontend can decide whether to
/// show the block screen. It is used purely on-device for gating and must
/// never be transmitted anywhere (see the privacy note in the plan).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgeRangeResponse {
  /// One of: "under13", "over13", "unknown".
  ///
  /// We only request the 13-year age gate, so the native side reports whether
  /// the person is below 13 ("under13") or 13-and-over ("over13"). "unknown"
  /// means we could not determine it (declined, unavailable, or error).
  pub age_range: String,
  /// Whether the Declared Age Range API was actually available and answered
  /// (false on iOS < 26.2, non-iOS platforms, or on error).
  pub available: bool,
  /// Whether the person (or their guardian) declined to share their age range.
  pub declined: bool,
}

impl Default for AgeRangeResponse {
  fn default() -> Self {
    Self {
      age_range: "unknown".to_string(),
      available: false,
      declined: false,
    }
  }
}
