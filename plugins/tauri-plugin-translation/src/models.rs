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
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateRequest {
  pub text: String,
  /// Base language code the UI is displayed in (e.g. "ja").
  pub target_language: String,
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
