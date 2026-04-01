use tauri_plugin_biometric::{AuthOptions, BiometricExt};
use tauri_plugin_keychain::{KeychainExt, KeychainRequest};
use tauri_plugin_store::StoreExt;

use ripemd::Ripemd160;
use bip39::{Language, Mnemonic};
use bip32::{DerivationPath, XPrv};
use unicode_normalization::UnicodeNormalization;
use bech32::{Bech32, Hrp};
use sha2::{Digest as Sha2Digest, Sha256};
use secp256k1::{Message, PublicKey, Secp256k1, SecretKey};
use sha3::Keccak256;

const HD_PATH: &str = "m/44'/118'/0'/0/0";

type Error = String;

#[tauri::command]
fn initialize_master(app_handle: tauri::AppHandle) -> Result<String, Error> {

    let store = app_handle.store("session").map_err(|e| format!("Failed to create store: {}", e))?;

    // generate master key
    let master_identity = generate_identity().unwrap();

    let key = "concrnt_masterkey".to_string();
    let value = master_identity.mnemonic.clone();

    let request = KeychainRequest {
        key: Some(key.clone()),
        password: Some(value.clone()),
    };

    let success = app_handle.keychain().save_item(request);
    if !success {
        return Err("Failed to save master key to keychain".to_string());
    }

    return Ok(master_identity.ccid);
}

#[tauri::command]
fn create_subkey(app_handle: tauri::AppHandle) -> String {
    let store = match app_handle.store("session") {
        Ok(s) => s,
        Err(e) => return format!("Failed to create store: {}", e),
    };

    // generate sub key
    let sub_identity = generate_identity().unwrap();
    store.set("sub_priv".to_string(), sub_identity.private_key.clone());

    let ckid = compute_ckid(&sub_identity.public_key).unwrap();
    store.set("ckid".to_string(), ckid.clone());

    ckid
}

#[tauri::command]
fn auth_available(app_handle: tauri::AppHandle) -> String {
    let status = app_handle.biometric().status().unwrap();
    if status.is_available {
        return "Yes! Biometric Authentication is available".to_string();
    } else {
        return format!("No! Biometric Authentication is not available due to: {}", status.error.unwrap());
    }
}

fn sign(private_key_hex: &str, payload: &str) -> Result<String, Error> {
    let private_key_bytes = hex::decode(private_key_hex).map_err(|_| "private key is not valid hex")?;
    let secret_key = SecretKey::from_slice(&private_key_bytes).map_err(|_| "invalid private key bytes")?;

    let message_hash = Keccak256::digest(payload.as_bytes());
    let message = Message::from_digest_slice(&message_hash).map_err(|_| "failed to create message from payload hash")?;
    let secp = Secp256k1::new();
    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);
    let (recovery_id, compact) = signature.serialize_compact();

    let r = hex::encode(&compact[..32]);
    let s = hex::encode(&compact[32..64]);
    let v = match recovery_id.to_i32() {
        0 => "00",
        1 => "01",
        _ => return Err("invalid recovery id".into()),
    };

    Ok(format!("{r}{s}{v}"))
}

#[tauri::command]
fn sign_masterkey(app_handle: tauri::AppHandle, payload: &str) -> String {
    let identity = retract_masterkey(app_handle).unwrap();
    sign(&identity.private_key, payload).unwrap()
}

#[tauri::command]
fn sign_subkey(app_handle: tauri::AppHandle, payload: &str) -> (String, String) {
    let store = app_handle.store("session").unwrap();
    let ckid = store.get("ckid".to_string()).and_then(|v| v.as_str().map(|s| s.to_string())).unwrap();

    let priv_key = retract_subkey(app_handle).unwrap();
    (sign(&priv_key, payload).unwrap(), ckid)
}

#[tauri::command]
fn set_domain(app_handle: tauri::AppHandle, domain: &str) {
    let store = app_handle.store("session").unwrap();
    store.set("domain".to_string(), domain.to_string());
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SessionInfo {
    pub ccid: Option<String>,
    pub ckid: Option<String>,
    pub domain: Option<String>,
}

#[tauri::command]
fn has_masterkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let request = KeychainRequest {
        key: Some("concrnt_masterkey".to_string()),
        password: None,
    };

    let resp = match app_handle.keychain().get_item(request) {
        Ok(resp) => resp.password.ok_or_else(|| format!("No value found for concrnt_masterkey")),
        Err(e) => Err(format!("Failed to get concrnt_masterkey. Error: {}", e)),
    };

    let mnemonic = match resp {
        Ok(m) => m,
        Err(e) => return Err(e),
    };


    let identity = match load_identity(&mnemonic) {
        Ok(Some(id)) => id,
        Ok(None) => return Err("Failed to load identity from mnemonic".into()),
        Err(e) => return Err(e),
    };

    Ok(identity.ccid)
}

#[tauri::command]
fn get_session(app_handle: tauri::AppHandle) -> Option<SessionInfo> {

    let request = KeychainRequest {
        key: Some("concrnt_masterkey".to_string()),
        password: None,
    };

    let resp = match app_handle.keychain().get_item(request) {
        Ok(resp) => resp.password.ok_or_else(|| format!("No value found for concrnt_masterkey")),
        Err(e) => return None, // If we fail to access the keychain, we just return None for session info instead of error
    };

    let mnemonic = match resp {
        Ok(m) => m,
        Err(e) => return None, // If we fail to get the master key, we just return None for session info instead of error
    };


    let identity = match load_identity(&mnemonic) {
        Ok(Some(id)) => id,
        Ok(None) => return None, // If we fail to load identity from mnemonic, we just return None for session info instead of error
        Err(e) => return None, // If we fail to load identity due to some error, we just return None for session info instead of error
    };

    let ccid = Some(identity.ccid);

    let store = app_handle.store("session").ok()?;
    let ckid = store.get("ckid".to_string()).and_then(|v| v.as_str().map(|s| s.to_string()));
    let domain = store.get("domain".to_string()).and_then(|v| v.as_str().map(|s| s.to_string()));

    Some(SessionInfo { ccid, ckid, domain })
}

#[tauri::command]
fn clear_session(app_handle: tauri::AppHandle) {
    let store = app_handle.store("session").unwrap();
    store.clear();
}

#[tauri::command]
fn clear_all(app_handle: tauri::AppHandle) {
    let store = app_handle.store("session").unwrap();
    store.clear();

    let request = KeychainRequest {
        key: Some("concrnt_masterkey".to_string()),
        password: None,
    };
    let _ = app_handle.keychain().remove_item(request);
}

fn retract_masterkey(app_handle: tauri::AppHandle) -> Result<Identity, Error> {
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
        return Err("Authentication failed. Cannot access key".into());
    }

    let request = KeychainRequest {
        key: Some("concrnt_masterkey".to_string()),
        password: None,
    };

    let resp = match app_handle.keychain().get_item(request) {
        Ok(resp) => resp.password.ok_or_else(|| format!("No value found for concrnt_masterkey")),
        Err(e) => Err(format!("Failed to get concrnt_masterkey. Error: {}", e)),
    };

    let mnemonic = match resp {
        Ok(m) => m,
        Err(e) => return Err(e),
    };

    if let Some(identity) = load_identity(&mnemonic)? {
        Ok(identity)
    } else {
        Err("Failed to load identity from mnemonic".into())
    }
}

fn retract_subkey(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let store = match app_handle.store("session") {
        Ok(s) => s,
        Err(e) => return Err(format!("Failed to create store: {}", e)),
    };

    let private_key_raw = match store.get("sub_priv".to_string()) {
        Some(v) => v,
        None => return Err("No value found for sub_priv".to_string()),
    };

    let private_key_str = match private_key_raw.as_str() {
        Some(s) => s,
        None => return Err("Value for sub_priv is not a string".to_string()),
    };

    Ok(private_key_str.to_string())
}

fn load_identity(mnemonic: &str) -> Result<Option<Identity>, Error> {
    let normalized = normalize_nfkd(mnemonic);
    if normalized.split(' ').count() != 12 {
        return Ok(None);
    }

    let first = normalized.chars().next().unwrap_or_default();
    let (mnemonic_en, mnemonic_ja) = if first.is_ascii_lowercase() {
        (normalized.clone(), mnemonic_en2ja(&normalized)?)
    } else {
        (mnemonic_ja2en(&normalized)?, normalized.clone())
    };

    let (private_key, public_key) = derive_keypair(&mnemonic_en)?;
    let ccid = compute_ccid(&public_key)?;

    Ok(Some(Identity {
        mnemonic: mnemonic_en,
        mnemonic_ja,
        private_key,
        public_key,
        ccid,
    }))
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(target_os = "ios")] {
        builder = builder.plugin(tauri_plugin_safari_scroll_killer::init())
    }

    builder
        .plugin(tauri_plugin_biometric::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .plugin(tauri_plugin_keychain::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            auth_available,
            initialize_master,
            create_subkey,
            sign_masterkey,
            sign_subkey,
            get_session,
            clear_session,
            set_domain,
            has_masterkey,
            clear_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


#[derive(Debug, Clone)]
struct Identity {
    mnemonic: String,
    mnemonic_ja: String,
    private_key: String,
    public_key: String,
    ccid: String,
}

fn generate_identity() -> Result<Identity, Error> {
    let mnemonic =
        Mnemonic::generate_in(Language::English, 12).map_err(|_| "failed to generate mnemonic")?;
    let mnemonic_en = normalize_nfkd(&mnemonic.to_string());
    let mnemonic_ja = mnemonic_en2ja(&mnemonic_en).map_err(|_| "failed to convert mnemonic to Japanese")?;

    let (private_key, public_key) = derive_keypair(&mnemonic_en).map_err(|_| "failed to derive keypair from mnemonic")?;
    let ccid = compute_ccid(&public_key)?;

    Ok(Identity {
        mnemonic: mnemonic_en,
        mnemonic_ja,
        private_key,
        public_key,
        ccid,
    })
}

fn normalize_nfkd(input: &str) -> String {
    input
        .trim()
        .nfkd()
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn mnemonic_ja2en(mnemonic_ja: &str) -> Result<String, Error> {
    map_mnemonic_by_word_id(mnemonic_ja, Language::Japanese, Language::English)
}

fn mnemonic_en2ja(mnemonic_en: &str) -> Result<String, Error> {
    map_mnemonic_by_word_id(mnemonic_en, Language::English, Language::Japanese)
}

fn map_mnemonic_by_word_id(input: &str, src: Language, dst: Language) -> Result<String, Error> {
    let normalized = normalize_nfkd(input);
    let mapped = normalized
        .split(' ')
        .map(|word| {
            let idx = src.find_word(word);
            let idx = match idx {
                Some(i) => i,
                None => return Err(format!("word '{}' not found in source language wordlist", word).into()),
            };
            Ok(dst.word_list()[idx as usize])
        })
        .collect::<Result<Vec<_>, Error>>()?;

    Ok(mapped.join(" "))
}

fn compute_ccid(public_key_hex: &str) -> Result<String, Error> {
    compute_bech32_id(public_key_hex, "con")
}

fn compute_ckid(public_key_hex: &str) -> Result<String, Error> {
    compute_bech32_id(public_key_hex, "cck")
}

fn derive_keypair(mnemonic_en: &str) -> Result<(String, String), Error> {
    let mnemonic = Mnemonic::parse_in(Language::English, &normalize_nfkd(mnemonic_en)).map_err(|_| "invalid mnemonic format")?;
    let seed = mnemonic.to_seed("");
    let path: DerivationPath = HD_PATH.parse().map_err(|_| "invalid HD path format")?;
    let xprv = XPrv::derive_from_path(seed, &path).map_err(|_| "failed to derive xprv from seed and path")?;
    let private_key_bytes = xprv.private_key().to_bytes();

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key_bytes).map_err(|_| "invalid private key bytes for secp256k1")?;
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    let private_key = hex::encode(private_key_bytes);
    let public_key = hex::encode(public_key.serialize_uncompressed());

    Ok((private_key, public_key))
}

fn compute_bech32_id(public_key_hex: &str, prefix: &str) -> Result<String, Error> {
    let public_key_bytes = hex::decode(public_key_hex).map_err(|_| "public key is not valid hex")?;
    let public_key = PublicKey::from_slice(&public_key_bytes).map_err(|_| "invalid public key bytes")?;
    let compressed_pubkey = public_key.serialize();

    let sha_hash = Sha256::digest(compressed_pubkey);
    let raw_address = Ripemd160::digest(sha_hash);

    let hrp = Hrp::parse(prefix).map_err(|_| "invalid HRP for bech32 encoding")?;
    let bech32 = bech32::encode::<Bech32>(hrp, &raw_address).map_err(|_| "failed to encode bech32 address")?;
    Ok(bech32)
}

