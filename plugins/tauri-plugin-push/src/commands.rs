use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::PushExt;
use crate::Result;

#[command]
pub(crate) async fn check_permission<R: Runtime>(app: AppHandle<R>) -> Result<CheckPermissionResponse> {
    app.push().check_permission().await
}

#[command]
pub(crate) async fn request_permission<R: Runtime>(app: AppHandle<R>) -> Result<RequestPermissionResponse> {
    app.push().request_permission().await
}

#[command]
pub(crate) async fn get_token<R: Runtime>(app: AppHandle<R>) -> Result<GetTokenResponse> {
    app.push().get_token().await
}

#[command]
pub(crate) async fn get_or_create_keys<R: Runtime>(app: AppHandle<R>) -> Result<GetOrCreateKeysResponse> {
    app.push().get_or_create_keys().await
}

#[command]
pub(crate) async fn reset_keys<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.push().reset_keys().await
}

#[command]
pub(crate) async fn set_context<R: Runtime>(
    app: AppHandle<R>,
    payload: SetContextRequest,
) -> Result<()> {
    app.push().set_context(payload).await
}

#[command]
pub(crate) async fn get_launch_notification<R: Runtime>(
    app: AppHandle<R>,
) -> Result<GetLaunchNotificationResponse> {
    app.push().get_launch_notification().await
}

// "register_listener" and "remove_listener" are intentionally NOT defined
// here. On mobile, invoke("plugin:push|register_listener"/"remove_listener")
// falls back automatically (since our own invoke_handler below doesn't match
// them) to the native Plugin base class's built-in registerListener/
// removeListener, which is what `trigger()`-based events need. See build.rs.
