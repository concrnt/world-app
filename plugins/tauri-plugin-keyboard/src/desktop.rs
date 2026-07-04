use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<Keyboard<R>> {
  Ok(Keyboard(app.clone()))
}

/// Access to the keyboard APIs.
/// Desktop has no OS software keyboard; this is a stub so the crate compiles
/// on desktop targets.
pub struct Keyboard<R: Runtime>(#[allow(dead_code)] AppHandle<R>);
