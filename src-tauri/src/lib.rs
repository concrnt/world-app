mod accounts;
mod auth;
mod backup;
mod commands;

use tauri_plugin_opener::OpenerExt;

pub(crate) type Error = concrnt::Error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(target_os = "ios")]
    {
        builder = builder
            .plugin(tauri_plugin_safari_scroll_killer::init())
            .plugin(tauri_plugin_ageverify::init())
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        builder = builder.plugin(tauri_plugin_keyboard::init())
    }

    builder
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_keychain::init())
        .plugin(tauri_plugin_haptics::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_file_saver::init())
        .plugin(tauri_plugin_push::init())
        .manage(accounts::AccountsLock::default())
        .setup(|app| {
            // Androidではtarget="_blank"が同一WebView内ナビゲーションに降格するため、
            // アプリ外へのhttp(s)ナビゲーションはWebViewに載せずシステムブラウザへ流す。
            // (iOSの_blankはナビゲーションイベント自体が発生しないのでフロント側で処理)
            let handle = app.handle().clone();
            let dev_url = app.config().build.dev_url.clone();
            tauri::WebviewWindowBuilder::from_config(app.handle(), &app.config().app.windows[0])?
                .on_navigation(move |url| {
                    if url.scheme() != "http" && url.scheme() != "https" {
                        // tauri:, about:, 他アプリのカスタムスキーム等はWebKit/WebView任せ
                        return true;
                    }
                    let host = url.host_str().unwrap_or_default();
                    if host == "localhost" || host == "tauri.localhost" || host.ends_with(".localhost") {
                        return true;
                    }
                    if let Some(dev) = &dev_url {
                        if url.host_str() == dev.host_str()
                            && url.port_or_known_default() == dev.port_or_known_default()
                        {
                            return true;
                        }
                    }
                    let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                    false
                })
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth_available,
            commands::initialize_master,
            commands::initialize_from_mnemonic,
            commands::create_subkey,
            commands::sign_masterkey,
            commands::sign_subkey,
            commands::get_session,
            commands::get_active_ccid,
            commands::list_accounts,
            commands::switch_account,
            commands::remove_account,
            commands::clear_session,
            commands::set_domain,
            commands::clear_all,
            commands::load_identity,
            backup::backup_masterkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
