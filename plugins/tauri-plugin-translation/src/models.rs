use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailabilityResponse {
  /// Whether on-device translation is usable on this device (iOS 18+ real
  /// device / Android). Always false on desktop.
  pub available: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectRequest {
  pub text: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectResponse {
  /// Raw BCP-47 tag as reported by the platform (e.g. "ja", "zh-Latn"), or
  /// None when the language could not be determined.
  pub language: Option<String>,
  /// Platform confidence for `language` in 0..1 (0 when undetermined). The
  /// frontend applies its own threshold so all engines share one policy.
  pub confidence: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateRequest {
  pub text: String,
  /// Base language code the UI is displayed in (e.g. "ja").
  pub target_language: String,
  /// Language the frontend detected on the cleaned body text. When present the
  /// platform must not re-detect on `text` (which still contains URLs, emoji
  /// and mentions that skew detection).
  pub source_language: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateResponse {
  pub text: String,
  pub source_language: String,
  pub target_language: String,
  /// "apple" | "mlkit"
  pub engine: String,
}
