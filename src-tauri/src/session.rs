use std::sync::Arc;

use tauri_plugin_keychain::{KeychainExt, KeychainRequest};
use tauri_plugin_store::StoreExt;

use crate::Error;

const MASTER_KEY: &str = "concrnt_masterkey";
const SESSION_STORE: &str = "session";

pub(crate) const SUB_PRIVATE_KEY: &str = "sub_priv";
pub(crate) const CKID: &str = "ckid";
pub(crate) const DOMAIN: &str = "domain";

#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct SessionInfo {
    pub ccid: Option<String>,
    pub ckid: Option<String>,
    pub domain: Option<String>,
}

pub(crate) fn get_session(app_handle: &tauri::AppHandle) -> Option<SessionInfo> {
    let mnemonic = get_master_mnemonic(app_handle).ok()?;
    let identity = concrnt::load_identity(&mnemonic).ok()?;

    let store = app_handle.store(SESSION_STORE).ok()?;
    let ckid = store.get(CKID.to_string()).and_then(json_string);
    let domain = store.get(DOMAIN.to_string()).and_then(json_string);

    Some(SessionInfo {
        ccid: Some(identity.ccid),
        ckid,
        domain,
    })
}

pub(crate) fn ensure_session_store(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    session_store(app_handle)?;
    Ok(())
}

pub(crate) fn set_session_string(
    app_handle: &tauri::AppHandle,
    key: &str,
    value: impl Into<String>,
) -> Result<(), Error> {
    let store = session_store(app_handle)?;
    store.set(key.to_string(), value.into());
    Ok(())
}

pub(crate) fn get_session_string(
    app_handle: &tauri::AppHandle,
    key: &str,
) -> Result<String, Error> {
    let store = session_store(app_handle)?;
    store
        .get(key.to_string())
        .and_then(json_string)
        .ok_or_else(|| format!("No value found for {}", key))
}

pub(crate) fn clear_session_store(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    let store = session_store(app_handle)?;
    store.clear();
    Ok(())
}

pub(crate) fn save_master_mnemonic(
    app_handle: &tauri::AppHandle,
    mnemonic: String,
) -> Result<(), Error> {
    let request = KeychainRequest {
        key: Some(MASTER_KEY.to_string()),
        password: Some(mnemonic),
    };

    let success = app_handle.keychain().save_item(request);
    if !success {
        return Err("Failed to save master key to keychain".to_string());
    }

    Ok(())
}

pub(crate) fn get_master_mnemonic(app_handle: &tauri::AppHandle) -> Result<String, Error> {
    let request = KeychainRequest {
        key: Some(MASTER_KEY.to_string()),
        password: None,
    };

    match app_handle.keychain().get_item(request) {
        Ok(resp) => resp
            .password
            .ok_or_else(|| format!("No value found for {}", MASTER_KEY)),
        Err(e) => Err(format!("Failed to get {}. Error: {}", MASTER_KEY, e)),
    }
}

pub(crate) fn remove_master_mnemonic(app_handle: &tauri::AppHandle) {
    let request = KeychainRequest {
        key: Some(MASTER_KEY.to_string()),
        password: None,
    };

    app_handle.keychain().remove_item(request);
}

fn session_store(
    app_handle: &tauri::AppHandle,
) -> Result<Arc<tauri_plugin_store::Store<tauri::Wry>>, Error> {
    app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))
}

fn json_string(value: serde_json::Value) -> Option<String> {
    value.as_str().map(String::from)
}
