use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_translation);

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "world.concrnt.plugin.translation";

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Translation<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "TranslationPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_translation)?;
    Ok(Translation(handle))
}

/// Access to the translation APIs.
pub struct Translation<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Clone for Translation<R> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<R: Runtime> Translation<R> {
    pub async fn is_available(&self) -> crate::Result<AvailabilityResponse> {
        self.0
            .run_mobile_plugin_async("isAvailable", ())
            .await
            .map_err(Into::into)
    }

    pub async fn detect_language(&self, payload: DetectRequest) -> crate::Result<DetectResponse> {
        self.0
            .run_mobile_plugin_async("detectLanguage", payload)
            .await
            .map_err(Into::into)
    }

    /// Translates on-device. May present a system language-pack download
    /// prompt (iOS) or download a model silently (Android) on first use.
    pub async fn translate(&self, payload: TranslateRequest) -> crate::Result<TranslateResponse> {
        self.0
            .run_mobile_plugin_async("translate", payload)
            .await
            .map_err(Into::into)
    }
}
