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
use desktop::AgeVerify;
#[cfg(mobile)]
use mobile::AgeVerify;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the age-verification APIs.
pub trait AgeVerifyExt<R: Runtime> {
  fn age_verify(&self) -> &AgeVerify<R>;
}

impl<R: Runtime, T: Manager<R>> crate::AgeVerifyExt<R> for T {
  fn age_verify(&self) -> &AgeVerify<R> {
    self.state::<AgeVerify<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("ageverify")
    .invoke_handler(tauri::generate_handler![commands::request_age_range])
    .setup(|app, api| {
      #[cfg(mobile)]
      let age_verify = mobile::init(app, api)?;
      #[cfg(desktop)]
      let age_verify = desktop::init(app, api)?;
      app.manage(age_verify);
      Ok(())
    })
    .build()
}
