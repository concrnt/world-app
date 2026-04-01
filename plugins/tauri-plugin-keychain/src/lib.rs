use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

// mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Keychain;
#[cfg(mobile)]
use mobile::Keychain;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the Keychain APIs.
pub trait KeychainExt<R: Runtime> {
  fn keychain(&self) -> &Keychain<R>;
}

impl<R: Runtime, T: Manager<R>> crate::KeychainExt<R> for T {
  fn keychain(&self) -> &Keychain<R> {
    self.state::<Keychain<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
	
	// .invoke_handler(tauri::generate_handler![commands::keychain])
  Builder::new("keychain")
    .setup(|app, api| {
      #[cfg(mobile)]
      let keychain = mobile::init(app, api)?;
      #[cfg(desktop)]
      let keychain = desktop::init(app, api)?;
      app.manage(keychain);
      Ok(())
    })
    .build()
}
