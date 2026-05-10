use concrnt::{compute_ckid, generate_identity, sign, Identity};

use crate::{auth, session, Error};

#[tauri::command]
pub(crate) fn initialize_master(app_handle: tauri::AppHandle) -> Result<String, Error> {
    if let Ok(ccid) = has_masterkey(app_handle.clone()) {
        return Ok(ccid);
    }

    session::ensure_session_store(&app_handle)?;

    let master_identity =
        generate_identity().map_err(|e| format!("Failed to generate master identity: {}", e))?;
    session::save_master_mnemonic(&app_handle, master_identity.mnemonic.clone())?;

    Ok(master_identity.ccid)
}

#[tauri::command]
pub(crate) fn initialize_from_mnemonic(
    app_handle: tauri::AppHandle,
    mnemonic: &str,
) -> Result<String, Error> {
    let identity = concrnt::load_identity(mnemonic)?;
    session::save_master_mnemonic(&app_handle, identity.mnemonic.clone())?;

    Ok(identity.ccid)
}

#[tauri::command]
pub(crate) fn create_subkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let sub_identity =
        generate_identity().map_err(|e| format!("Failed to generate sub identity: {}", e))?;
    session::set_session_string(
        &app_handle,
        session::SUB_PRIVATE_KEY,
        sub_identity.private_key.clone(),
    )?;

    let ckid = compute_ckid(&sub_identity.public_key)
        .map_err(|e| format!("Failed to compute ckid: {}", e))?;
    session::set_session_string(&app_handle, session::CKID, ckid.clone())?;

    Ok(ckid)
}

#[tauri::command]
pub(crate) fn auth_available(app_handle: tauri::AppHandle) -> Result<String, Error> {
    auth::biometric_status(&app_handle)
}

#[tauri::command]
pub(crate) fn sign_masterkey(app_handle: tauri::AppHandle, payload: &str) -> Result<String, Error> {
    let identity = auth::retract_masterkey(&app_handle)?;
    sign(&identity.private_key, payload)
}

#[tauri::command]
pub(crate) fn sign_subkey(
    app_handle: tauri::AppHandle,
    payload: &str,
) -> Result<(String, String), Error> {
    let ckid = session::get_session_string(&app_handle, session::CKID)?;
    let priv_key = auth::retract_subkey(&app_handle)?;
    let signature = sign(&priv_key, payload)?;

    Ok((signature, ckid))
}

#[tauri::command]
pub(crate) fn set_domain(app_handle: tauri::AppHandle, domain: &str) -> Result<(), Error> {
    session::set_session_string(&app_handle, session::DOMAIN, domain)
}

#[tauri::command]
pub(crate) fn has_masterkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let mnemonic = session::get_master_mnemonic(&app_handle)?;
    let identity = concrnt::load_identity(&mnemonic)?;

    Ok(identity.ccid)
}

#[tauri::command]
pub(crate) fn get_session(app_handle: tauri::AppHandle) -> Option<session::SessionInfo> {
    session::get_session(&app_handle)
}

#[tauri::command]
pub(crate) fn clear_session(app_handle: tauri::AppHandle) {
    session::clear_session_store(&app_handle).unwrap();
}

#[tauri::command]
pub(crate) fn clear_all(app_handle: tauri::AppHandle) {
    session::clear_session_store(&app_handle).unwrap();
    session::remove_master_mnemonic(&app_handle);
}

#[tauri::command]
pub(crate) fn load_identity(mnemonic: &str) -> Result<Identity, Error> {
    concrnt::load_identity(mnemonic)
}
