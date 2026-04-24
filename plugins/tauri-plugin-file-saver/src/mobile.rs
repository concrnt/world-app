use serde::de::DeserializeOwned;
use std::sync::mpsc::channel;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_file_saver);

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.plugin.filesaver";

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<FileSaver<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "FileSaverPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_file_saver)?;
    Ok(FileSaver(handle))
}

/// Access to the file-saver APIs.
pub struct FileSaver<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Clone for FileSaver<R> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<R: Runtime> FileSaver<R> {
    pub fn save_text_file(
        &self,
        payload: SaveTextFileRequest,
    ) -> crate::Result<SaveTextFileResponse> {
        let plugin = self.clone();
        let (tx, rx) = channel();

        std::thread::spawn(move || {
            let result = plugin
                .0
                .run_mobile_plugin("saveTextFile", payload)
                .map_err(Into::into);
            let _ = tx.send(result);
        });

        rx.recv().map_err(|_| {
            crate::Error::Internal("save_text_file worker thread terminated unexpectedly")
        })?
    }
}
