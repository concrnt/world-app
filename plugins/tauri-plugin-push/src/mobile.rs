use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_push);

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "world.concrnt.plugin.push";

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Push<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "PushPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_push)?;
    Ok(Push(handle))
}

/// Access to the push notification APIs.
pub struct Push<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Clone for Push<R> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<R: Runtime> Push<R> {
    pub async fn check_permission(&self) -> crate::Result<CheckPermissionResponse> {
        self.0
            .run_mobile_plugin_async("checkPermission", ())
            .await
            .map_err(Into::into)
    }

    pub async fn request_permission(&self) -> crate::Result<RequestPermissionResponse> {
        self.0
            .run_mobile_plugin_async("requestPermission", ())
            .await
            .map_err(Into::into)
    }

    /// Registers for remote notifications (if not already) and resolves with
    /// the device/registration token. May take a few seconds on first call.
    pub async fn get_token(&self) -> crate::Result<GetTokenResponse> {
        self.0
            .run_mobile_plugin_async("getToken", ())
            .await
            .map_err(Into::into)
    }

    /// Returns the on-device WebPush keypair's public key + auth secret,
    /// generating and persisting them on first call. The private key never
    /// leaves native storage.
    pub async fn get_or_create_keys(&self) -> crate::Result<GetOrCreateKeysResponse> {
        self.0
            .run_mobile_plugin_async("getOrCreateKeys", ())
            .await
            .map_err(Into::into)
    }

    /// Deletes the on-device WebPush keypair (called on unsubscribe/logout).
    pub async fn reset_keys(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin_async("resetKeys", ())
            .await
            .map_err(Into::into)
    }

    /// Tells the native side which account/server "self" is, so the
    /// Notification Service Extension / FirebaseMessagingService can enrich
    /// notification payloads without another round trip through JS.
    pub async fn set_context(&self, payload: SetContextRequest) -> crate::Result<()> {
        self.0
            .run_mobile_plugin_async("setContext", payload)
            .await
            .map_err(Into::into)
    }

    /// Returns (and clears) the deep-link payload of the notification that
    /// launched the app, if the app was cold-started from a tap.
    pub async fn get_launch_notification(&self) -> crate::Result<GetLaunchNotificationResponse> {
        self.0
            .run_mobile_plugin_async("getLaunchNotification", ())
            .await
            .map_err(Into::into)
    }
}
