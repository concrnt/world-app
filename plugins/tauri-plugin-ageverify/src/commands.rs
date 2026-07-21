use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::AgeVerifyExt;
use crate::Result;

#[command]
pub(crate) async fn request_age_range<R: Runtime>(app: AppHandle<R>) -> Result<AgeRangeResponse> {
    app.age_verify().request_age_range().await
}
