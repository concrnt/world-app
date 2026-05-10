use concrnt::{compute_ckid, generate_identity, sign, Identity};
use tauri_plugin_biometric::{AuthOptions, BiometricExt};
use tauri_plugin_file_saver::{FileSaverExt, SaveTextFileRequest};
use tauri_plugin_keychain::{KeychainExt, KeychainRequest};
use tauri_plugin_store::StoreExt;

type Error = concrnt::Error;

const MASTER_KEY: &str = "concrnt_masterkey";
const SESSION_STORE: &str = "session";
const SUB_PRIVATE_KEY: &str = "sub_priv";
const CKID: &str = "ckid";
const DOMAIN: &str = "domain";

#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionInfo {
    pub ccid: Option<String>,
    pub ckid: Option<String>,
    pub domain: Option<String>,
}

#[tauri::command]
fn initialize_master(app_handle: tauri::AppHandle) -> Result<String, Error> {
    if let Ok(ccid) = has_masterkey(app_handle.clone()) {
        return Ok(ccid);
    }

    let _store = app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))?;

    let master_identity =
        generate_identity().map_err(|e| format!("Failed to generate master identity: {}", e))?;
    save_master_mnemonic(&app_handle, master_identity.mnemonic.clone())?;

    Ok(master_identity.ccid)
}

#[tauri::command]
fn initialize_from_mnemonic(app_handle: tauri::AppHandle, mnemonic: &str) -> Result<String, Error> {
    let identity = concrnt::load_identity(mnemonic)?;
    save_master_mnemonic(&app_handle, identity.mnemonic.clone())?;

    Ok(identity.ccid)
}

#[tauri::command]
fn create_subkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let store = app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))?;

    let sub_identity =
        generate_identity().map_err(|e| format!("Failed to generate sub identity: {}", e))?;
    store.set(
        SUB_PRIVATE_KEY.to_string(),
        sub_identity.private_key.clone(),
    );

    let ckid = compute_ckid(&sub_identity.public_key)
        .map_err(|e| format!("Failed to compute ckid: {}", e))?;
    store.set(CKID.to_string(), ckid.clone());

    Ok(ckid)
}

#[tauri::command]
fn auth_available(app_handle: tauri::AppHandle) -> Result<String, Error> {
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

#[tauri::command]
fn sign_masterkey(app_handle: tauri::AppHandle, payload: &str) -> Result<String, Error> {
    let identity = retract_masterkey(app_handle)?;
    sign(&identity.private_key, payload)
}

#[tauri::command]
fn sign_subkey(app_handle: tauri::AppHandle, payload: &str) -> Result<(String, String), Error> {
    let store = app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))?;
    let ckid = store_string(&store, CKID)?;

    let priv_key = retract_subkey(app_handle)?;
    let signature = sign(&priv_key, payload)?;

    Ok((signature, ckid))
}

#[tauri::command]
fn set_domain(app_handle: tauri::AppHandle, domain: &str) -> Result<(), Error> {
    let store = app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))?;
    store.set(DOMAIN.to_string(), domain.to_string());
    Ok(())
}

#[tauri::command]
fn has_masterkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let mnemonic = get_master_mnemonic(&app_handle)?;
    let identity = concrnt::load_identity(&mnemonic)?;

    Ok(identity.ccid)
}

#[tauri::command]
fn get_session(app_handle: tauri::AppHandle) -> Option<SessionInfo> {
    let mnemonic = get_master_mnemonic(&app_handle).ok()?;
    let identity = concrnt::load_identity(&mnemonic).ok()?;

    let store = app_handle.store(SESSION_STORE).ok()?;
    let ckid = store
        .get(CKID.to_string())
        .and_then(|v| v.as_str().map(String::from));
    let domain = store
        .get(DOMAIN.to_string())
        .and_then(|v| v.as_str().map(String::from));

    Some(SessionInfo {
        ccid: Some(identity.ccid),
        ckid,
        domain,
    })
}

#[tauri::command]
fn clear_session(app_handle: tauri::AppHandle) {
    let store = app_handle.store(SESSION_STORE).unwrap();
    store.clear();
}

#[tauri::command]
fn clear_all(app_handle: tauri::AppHandle) {
    let store = app_handle.store(SESSION_STORE).unwrap();
    store.clear();

    let request = KeychainRequest {
        key: Some(MASTER_KEY.to_string()),
        password: None,
    };
    let _ = app_handle.keychain().remove_item(request);
}

#[tauri::command]
fn load_identity(mnemonic: &str) -> Result<Identity, Error> {
    concrnt::load_identity(mnemonic)
}

#[tauri::command]
async fn backup_masterkey(
    app_handle: tauri::AppHandle,
    template: &str,
    filename: &str,
) -> Result<(), Error> {
    let identity = retract_masterkey(app_handle.clone())?;

    let filename = if filename.trim().is_empty() {
        "concrnt_masterkey_backup.txt".to_string()
    } else {
        filename.trim().to_string()
    };

    let content = template
        .replace("${mnemonic}", &identity.mnemonic)
        .replace("${mnemonic_ja}", &identity.mnemonic_ja)
        .replace("${ccid}", &identity.ccid);

    app_handle
        .file_saver()
        .save_text_file(SaveTextFileRequest {
            file_name: filename,
            content: content.into(),
            mime_type: Some("text/plain".into()),
        })
        .await
        .map_err(|e| format!("Failed to save text file: {}", e))?;

    Ok(())
}

fn retract_masterkey(app_handle: tauri::AppHandle) -> Result<Identity, Error> {
    authenticate_keychain_access(&app_handle)?;
    let mnemonic = get_master_mnemonic(&app_handle)?;

    concrnt::load_identity(&mnemonic)
}

fn retract_subkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let store = app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))?;

    store_string(&store, SUB_PRIVATE_KEY)
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

fn save_master_mnemonic(app_handle: &tauri::AppHandle, mnemonic: String) -> Result<(), Error> {
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

fn get_master_mnemonic(app_handle: &tauri::AppHandle) -> Result<String, Error> {
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

fn store_string<R: tauri::Runtime>(
    store: &tauri_plugin_store::Store<R>,
    key: &str,
) -> Result<String, Error> {
    store
        .get(key.to_string())
        .and_then(|v| v.as_str().map(String::from))
        .ok_or_else(|| format!("No value found for {}", key))
}

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
            auth_available,
            initialize_master,
            initialize_from_mnemonic,
            create_subkey,
            sign_masterkey,
            sign_subkey,
            get_session,
            clear_session,
            set_domain,
            has_masterkey,
            clear_all,
            load_identity,
            backup_masterkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
