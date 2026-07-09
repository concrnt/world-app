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
use desktop::Push;
#[cfg(mobile)]
use mobile::Push;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the push APIs.
pub trait PushExt<R: Runtime> {
    fn push(&self) -> &Push<R>;
}

impl<R: Runtime, T: Manager<R>> crate::PushExt<R> for T {
    fn push(&self) -> &Push<R> {
        self.state::<Push<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("push")
        .invoke_handler(tauri::generate_handler![
            commands::check_permission,
            commands::request_permission,
            commands::get_token,
            commands::get_or_create_keys,
            commands::reset_keys,
            commands::set_context,
            commands::get_launch_notification,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let push = mobile::init(app, api)?;
            #[cfg(desktop)]
            let push = desktop::init(app, api)?;
            app.manage(push);
            Ok(())
        })
        .build()
}
