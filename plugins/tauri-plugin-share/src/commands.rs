use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::Result;
use crate::ShareExt;

#[command]
pub(crate) async fn share_text<R: Runtime>(app: AppHandle<R>, payload: ShareTextRequest) -> Result<()> {
    app.share().share_text(payload).await
}
