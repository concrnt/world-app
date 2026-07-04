use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_keyboard);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Keyboard<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.plugin.keyboard", "KeyboardPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_keyboard)?;
  Ok(Keyboard(handle))
}

/// Access to the keyboard APIs.
/// The plugin is event-only: the native side pushes `keyboardChange` events
/// to the webview, so no methods are exposed here.
pub struct Keyboard<R: Runtime>(#[allow(dead_code)] PluginHandle<R>);
