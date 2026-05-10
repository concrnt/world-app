use concrnt::Identity;
use tauri_plugin_biometric::{AuthOptions, BiometricExt};

use crate::{session, Error};

pub(crate) fn biometric_status(app_handle: &tauri::AppHandle) -> Result<String, Error> {
    match app_handle.biometric().status() {
        Ok(status) => {
            if status.is_available {
                Ok("Yes! Biometric Authentication is available".to_string())
            } else {
                Err(format!(
                    "No! Biometric Authentication is not available due to: {}",
                    status.error.unwrap_or("Unknown error".to_string())
                ))
            }
        }
        Err(e) => Err(format!("Failed to check biometric status: {}", e)),
    }
}

pub(crate) fn retract_masterkey(app_handle: &tauri::AppHandle) -> Result<Identity, Error> {
    authenticate_keychain_access(app_handle)?;
    let mnemonic = session::get_master_mnemonic(app_handle)?;

    concrnt::load_identity(&mnemonic)
}

pub(crate) fn retract_subkey(app_handle: &tauri::AppHandle) -> Result<String, Error> {
    session::get_session_string(app_handle, session::SUB_PRIVATE_KEY)
}

fn authenticate_keychain_access(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    let verified = app_handle.biometric().authenticate(
        "Authenticate to access the keychain item".to_string(),
        AuthOptions {
            allow_device_credential: true,
            cancel_title: Some("Cannot access key without authentication".to_string()),
            ..Default::default()
        },
    );

    if verified.is_err() {
        return Err("Authentication failed. Cannot access key".into());
    }

    Ok(())
}
