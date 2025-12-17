use tauri_plugin_biometric::{AuthOptions, BiometricExt};
use tauri_plugin_keychain::{KeychainExt, KeychainRequest};

#[tauri::command]
fn auth_available(app_handle: tauri::AppHandle) -> String {
    let status = app_handle.biometric().status().unwrap();
    if status.is_available {
        return "Yes! Biometric Authentication is available".to_string();
    } else {
        return format!("No! Biometric Authentication is not available due to: {}", status.error.unwrap());
    }
}

#[tauri::command]
fn save_key(app_handle: tauri::AppHandle, key: String, value: String) -> String {
    let request = KeychainRequest {
        key: Some(key.clone()),
        password: Some(value.clone()),
    };

    match app_handle.keychain().save_item(request) {
        Ok(_) => format!("Successfully saved key: {} with value: {}", key, value),
        Err(e) => format!("Failed to save key: {}. Error: {}", key, e),
    }
}

#[tauri::command]
fn get_key(app_handle: tauri::AppHandle, key: String) -> String {

    let verified = app_handle
        .biometric()
        .authenticate(
            "Authenticate to access the keychain item".to_string(),
            AuthOptions {
                allow_device_credential: true,
                cancel_title: Some("Cannot access key without authentication".to_string()),
                ..Default::default()
            },
        );

    if verified.is_err() {
        return format!(
            "Authentication failed. Cannot access key: {}",
            key
        );
    }

    let request = KeychainRequest {
        key: Some(key.clone()),
        password: None,
    };

    match app_handle.keychain().get_item(request) {
        Ok(resp) => format!(
            "Value for key {}: {}",
            key,
            resp.password.unwrap_or("No Value Found".to_string())
        ),
        Err(e) => format!("Failed to get key: {}. Error: {}", key, e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_keychain::init())
        .invoke_handler(tauri::generate_handler![auth_available, save_key, get_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
