use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<SafariScrollKiller<R>> {
  Ok(SafariScrollKiller(app.clone()))
}

/// Access to the safari-scroll-killer APIs.
pub struct SafariScrollKiller<R: Runtime>(AppHandle<R>);

impl<R: Runtime> SafariScrollKiller<R> {
}
