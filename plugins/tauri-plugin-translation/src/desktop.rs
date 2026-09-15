use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Translation<R>> {
    Ok(Translation(app.clone()))
}

/// Access to the translation APIs.
///
/// There is no on-device translation engine off iOS/Android, so desktop
/// reports the feature as unavailable (the frontend then falls back to a
/// Google Translate link in the post menu).
pub struct Translation<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> Translation<R> {
    pub async fn is_available(&self) -> crate::Result<AvailabilityResponse> {
        Ok(AvailabilityResponse { available: false })
    }

    pub async fn detect_language(&self, _payload: DetectRequest) -> crate::Result<DetectResponse> {
        Ok(DetectResponse { language: None })
    }

    pub async fn translate(&self, _payload: TranslateRequest) -> crate::Result<TranslateResponse> {
        Err(crate::Error::UnsupportedPlatform(
            "translate is only supported on iOS and Android",
        ))
    }
}
