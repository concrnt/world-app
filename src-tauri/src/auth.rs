use concrnt::Identity;
use tauri_plugin_biometric::{AuthOptions, BiometricExt};

use crate::{accounts, Error};

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

pub(crate) fn retract_masterkey(
    app_handle: &tauri::AppHandle,
    ccid: Option<&str>,
) -> Result<Identity, Error> {
    authenticate_keychain_access(app_handle)?;
    let record = accounts::resolve(app_handle, ccid)?;

    concrnt::load_identity(&record.mnemonic)
}

pub(crate) fn retract_subkey(
    app_handle: &tauri::AppHandle,
    ccid: Option<&str>,
) -> Result<(String, String), Error> {
    let record = accounts::resolve(app_handle, ccid)?;
    let sub_priv = record
        .sub_priv
        .ok_or_else(|| format!("Account {} has no subkey", record.ccid))?;
    let ckid = record
        .ckid
        .ok_or_else(|| format!("Account {} has no ckid", record.ccid))?;
    Ok((sub_priv, ckid))
}

pub(crate) fn authenticate_keychain_access(app_handle: &tauri::AppHandle) -> Result<(), Error> {
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
