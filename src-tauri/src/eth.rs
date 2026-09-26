use crate::{accounts, auth, Error};

// Ethereum用コマンド群。鍵はConcrntと同じmnemonicから m/44'/60'/0'/0/0 で派生し、
// 秘密鍵はRust側から一切出さない(ConcrntのマスターキーAPIと同じ方針)。

/// アカウントのEthereumアドレス(EIP-55)を返す。公開情報なので端末認証は不要。
#[tauri::command]
pub(crate) async fn get_eth_address(
    app_handle: tauri::AppHandle,
    ccid: Option<String>,
) -> Result<String, Error> {
    let record = accounts::resolve(&app_handle, ccid.as_deref())?;
    let identity = concrnt::derive_eth_identity(&record.mnemonic)?;
    Ok(identity.address)
}

/// 32バイトのダイジェスト(hex、0x有無どちらでも可)に署名し `0x{r}{s}{v}` (v=27/28) を返す。
/// トランザクション署名(JS側でviem等がsigning hashを計算)やEIP-712に使う。
/// マスターキー相当の操作なので端末認証(生体認証/画面ロック)を必須とする。
#[tauri::command]
pub(crate) async fn sign_eth_hash(
    app_handle: tauri::AppHandle,
    hash: &str,
    ccid: Option<String>,
) -> Result<String, Error> {
    auth::authenticate_keychain_access(&app_handle)?;
    let record = accounts::resolve(&app_handle, ccid.as_deref())?;
    let identity = concrnt::derive_eth_identity(&record.mnemonic)?;
    concrnt::eth_sign_hash(&identity.private_key, hash)
}

/// EIP-191 (personal_sign) でUTF-8メッセージに署名する。端末認証必須。
#[tauri::command]
pub(crate) async fn sign_eth_message(
    app_handle: tauri::AppHandle,
    message: &str,
    ccid: Option<String>,
) -> Result<String, Error> {
    auth::authenticate_keychain_access(&app_handle)?;
    let record = accounts::resolve(&app_handle, ccid.as_deref())?;
    let identity = concrnt::derive_eth_identity(&record.mnemonic)?;
    concrnt::eth_sign_message(&identity.private_key, message.as_bytes())
}
