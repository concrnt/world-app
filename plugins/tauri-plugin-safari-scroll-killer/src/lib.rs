use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::SafariScrollKiller;
#[cfg(mobile)]
use mobile::SafariScrollKiller;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the safari-scroll-killer APIs.
pub trait SafariScrollKillerExt<R: Runtime> {
  fn safari_scroll_killer(&self) -> &SafariScrollKiller<R>;
}

impl<R: Runtime, T: Manager<R>> crate::SafariScrollKillerExt<R> for T {
  fn safari_scroll_killer(&self) -> &SafariScrollKiller<R> {
    self.state::<SafariScrollKiller<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("safari-scroll-killer")
    .invoke_handler(tauri::generate_handler![commands::ping])
    .setup(|app, api| {
      #[cfg(mobile)]
      let safari_scroll_killer = mobile::init(app, api)?;
      #[cfg(desktop)]
      let safari_scroll_killer = desktop::init(app, api)?;
      app.manage(safari_scroll_killer);
      Ok(())
    })
    .build()
}
