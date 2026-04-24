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
use desktop::FileSaver;
#[cfg(mobile)]
use mobile::FileSaver;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the file-saver APIs.
pub trait FileSaverExt<R: Runtime> {
    fn file_saver(&self) -> &FileSaver<R>;
}

impl<R: Runtime, T: Manager<R>> crate::FileSaverExt<R> for T {
    fn file_saver(&self) -> &FileSaver<R> {
        self.state::<FileSaver<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("file-saver")
        .invoke_handler(tauri::generate_handler![commands::save_text_file])
        .setup(|app, api| {
            #[cfg(mobile)]
            let file_saver = mobile::init(app, api)?;
            #[cfg(desktop)]
            let file_saver = desktop::init(app, api)?;
            app.manage(file_saver);
            Ok(())
        })
        .build()
}
