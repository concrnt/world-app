use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::Result;
use crate::TranslationExt;

#[command]
pub(crate) async fn is_available<R: Runtime>(app: AppHandle<R>) -> Result<AvailabilityResponse> {
    app.translation().is_available().await
}

#[command]
pub(crate) async fn detect_language<R: Runtime>(
    app: AppHandle<R>,
    payload: DetectRequest,
) -> Result<DetectResponse> {
    app.translation().detect_language(payload).await
}

#[command]
pub(crate) async fn translate<R: Runtime>(
    app: AppHandle<R>,
    payload: TranslateRequest,
) -> Result<TranslateResponse> {
    app.translation().translate(payload).await
}
