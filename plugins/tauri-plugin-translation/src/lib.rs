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
use desktop::Translation;
#[cfg(mobile)]
use mobile::Translation;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the translation APIs.
pub trait TranslationExt<R: Runtime> {
    fn translation(&self) -> &Translation<R>;
}

impl<R: Runtime, T: Manager<R>> crate::TranslationExt<R> for T {
    fn translation(&self) -> &Translation<R> {
        self.state::<Translation<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("translation")
        .invoke_handler(tauri::generate_handler![
            commands::is_available,
            commands::detect_language,
            commands::translate
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let translation = mobile::init(app, api)?;
            #[cfg(desktop)]
            let translation = desktop::init(app, api)?;
            app.manage(translation);
            Ok(())
        })
        .build()
}
