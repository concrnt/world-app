use tauri::{command, AppHandle, Runtime};

use crate::models::*;
use crate::FileSaverExt;
use crate::Result;

#[command]
pub(crate) async fn save_text_file<R: Runtime>(
    app: AppHandle<R>,
    payload: SaveTextFileRequest,
) -> Result<SaveTextFileResponse> {
    app.file_saver().save_text_file(payload)
}
