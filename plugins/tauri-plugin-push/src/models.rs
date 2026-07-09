use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckPermissionResponse {
    /// One of "granted", "denied", "prompt".
    pub status: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestPermissionResponse {
    pub granted: bool,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTokenResponse {
    /// "apns" on iOS, "fcm" on Android.
    pub platform: String,
    pub token: String,
    /// "production" or "sandbox". Always "production" on Android.
    pub environment: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetOrCreateKeysResponse {
    /// base64url (no padding) of the 65-byte uncompressed P-256 public point.
    pub p256dh: String,
    /// base64url (no padding) of the 16-byte auth secret.
    pub auth: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetContextRequest {
    pub home_domain: String,
    pub ccid: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetLaunchNotificationResponse {
    pub uri: Option<String>,
    pub view: Option<String>,
}
