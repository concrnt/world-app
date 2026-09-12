use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<ScrollKiller<R>> {
  Ok(ScrollKiller(app.clone()))
}

/// Access to the scroll-killer APIs.
pub struct ScrollKiller<R: Runtime>(AppHandle<R>);

impl<R: Runtime> ScrollKiller<R> {
}
