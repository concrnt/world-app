mod auth;
mod backup;
mod commands;
mod session;

pub(crate) type Error = concrnt::Error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(target_os = "ios")]
    {
        builder = builder.plugin(tauri_plugin_safari_scroll_killer::init())
    }

    builder
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_keychain::init())
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_file_saver::init())
        .invoke_handler(tauri::generate_handler![
            commands::auth_available,
            commands::initialize_master,
            commands::initialize_from_mnemonic,
            commands::create_subkey,
            commands::sign_masterkey,
            commands::sign_subkey,
            commands::get_session,
            commands::clear_session,
            commands::set_domain,
            commands::has_masterkey,
            commands::clear_all,
            commands::load_identity,
            backup::backup_masterkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
