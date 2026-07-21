use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ageverify);

// initializes the Swift plugin class
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<AgeVerify<R>> {
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_ageverify)?;
  Ok(AgeVerify(handle))
}

/// Access to the age-verification APIs.
pub struct AgeVerify<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> AgeVerify<R> {
  /// Asks the system (via Apple's Declared Age Range API) for the user's age
  /// band, using a single 13-year age gate. Resolves asynchronously because
  /// the native call presents a system sheet.
  pub async fn request_age_range(&self) -> crate::Result<AgeRangeResponse> {
    self
      .0
      .run_mobile_plugin_async("requestAgeRange", ())
      .await
      .map_err(Into::into)
  }
}
