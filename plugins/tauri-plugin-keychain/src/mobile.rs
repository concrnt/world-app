use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_keychain);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Keychain<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.plugin.keychain", "KeychainPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_keychain)?;
  Ok(Keychain(handle))
}

/// Access to the Keychain APIs.
pub struct Keychain<R: Runtime>(PluginHandle<R>);


impl<R: Runtime> Keychain<R> {
  pub fn get_item(&self, payload: KeychainRequest) -> crate::Result<KeychainResponse> {
    self
      .0
      .run_mobile_plugin("getItem", payload)
      .map_err(Into::into)
  }
  pub fn save_item(&self, payload: KeychainRequest) -> crate::Result<KeychainResponse> {
    self
      .0
      .run_mobile_plugin("saveItem", payload)
      .map_err(Into::into)
  }
  pub fn remove_item(&self, payload: KeychainRequest) -> crate::Result<KeychainResponse> {
    self
      .0
      .run_mobile_plugin("removeItem", payload)
      .map_err(Into::into)
  }
}
