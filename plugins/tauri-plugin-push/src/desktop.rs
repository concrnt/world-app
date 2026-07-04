use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Push<R>> {
    Ok(Push(app.clone()))
}

/// Access to the push notification APIs. Push notifications are a mobile-only
/// feature; every method here returns Err on desktop.
pub struct Push<R: Runtime>(AppHandle<R>);

const UNSUPPORTED: &str = "push notifications are only supported on iOS and Android";

impl<R: Runtime> Push<R> {
    pub async fn check_permission(&self) -> crate::Result<CheckPermissionResponse> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }

    pub async fn request_permission(&self) -> crate::Result<RequestPermissionResponse> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }

    pub async fn get_token(&self) -> crate::Result<GetTokenResponse> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }

    pub async fn get_or_create_keys(&self) -> crate::Result<GetOrCreateKeysResponse> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }

    pub async fn reset_keys(&self) -> crate::Result<()> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }

    pub async fn set_context(&self, _payload: SetContextRequest) -> crate::Result<()> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }

    pub async fn get_launch_notification(&self) -> crate::Result<GetLaunchNotificationResponse> {
        Err(crate::Error::UnsupportedPlatform(UNSUPPORTED))
    }
}
