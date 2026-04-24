use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<FileSaver<R>> {
    Ok(FileSaver(app.clone()))
}

/// Access to the file-saver APIs.
pub struct FileSaver<R: Runtime>(AppHandle<R>);

impl<R: Runtime> FileSaver<R> {
    pub async fn save_text_file(
        &self,
        _payload: SaveTextFileRequest,
    ) -> crate::Result<SaveTextFileResponse> {
        Err(crate::Error::UnsupportedPlatform(
            "save_text_file is only supported on iOS and Android",
        ))
    }
}
