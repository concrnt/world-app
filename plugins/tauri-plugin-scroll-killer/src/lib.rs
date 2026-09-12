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
use desktop::ScrollKiller;
#[cfg(mobile)]
use mobile::ScrollKiller;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the scroll-killer APIs.
pub trait ScrollKillerExt<R: Runtime> {
  fn scroll_killer(&self) -> &ScrollKiller<R>;
}

impl<R: Runtime, T: Manager<R>> crate::ScrollKillerExt<R> for T {
  fn scroll_killer(&self) -> &ScrollKiller<R> {
    self.state::<ScrollKiller<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("scroll-killer")
    .invoke_handler(tauri::generate_handler![commands::ping])
    .setup(|app, api| {
      #[cfg(mobile)]
      let scroll_killer = mobile::init(app, api)?;
      #[cfg(desktop)]
      let scroll_killer = desktop::init(app, api)?;
      app.manage(scroll_killer);
      Ok(())
    })
    .build()
}
