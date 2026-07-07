use concrnt::{compute_ckid, generate_identity, sign, Identity};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::{accounts, auth, Error};

// keychain/biometricプラグインを呼ぶコマンドは必ずasyncにすること。
// 同期コマンドはWebViewのIPCハンドラ(メインスレッド)上で実行され、
// run_mobile_pluginのブロッキング待ちがSwift側のipcキューと相互待ちして
// メインスレッドごとデッドロックする(白画面/フリーズ)。

/// 新しいマスターキーを生成してアカウントを追加し、アクティブにする。
/// 既存アカウントには一切触れない(二重実行しても既存の鍵は無傷)。
#[tauri::command]
pub(crate) async fn initialize_master(app_handle: tauri::AppHandle) -> Result<String, Error> {
    let master_identity =
        generate_identity().map_err(|e| format!("Failed to generate master identity: {}", e))?;

    accounts::upsert_account(
        &app_handle,
        accounts::AccountRecord {
            ccid: master_identity.ccid.clone(),
            mnemonic: master_identity.mnemonic.clone(),
            sub_priv: None,
            ckid: None,
            domain: None,
        },
    )?;
    accounts::set_active_ccid(&app_handle, &master_identity.ccid)?;

    Ok(master_identity.ccid)
}

/// mnemonicからアカウントを追加(または既存を再アクティブ化)する。
/// 同一ccidが既にある場合は既存のsubkey/domainを維持する(冪等)。
#[tauri::command]
pub(crate) async fn initialize_from_mnemonic(
    app_handle: tauri::AppHandle,
    mnemonic: &str,
) -> Result<String, Error> {
    let identity = concrnt::load_identity(mnemonic)?;

    accounts::upsert_account(
        &app_handle,
        accounts::AccountRecord {
            ccid: identity.ccid.clone(),
            mnemonic: identity.mnemonic.clone(),
            sub_priv: None,
            ckid: None,
            domain: None,
        },
    )?;
    accounts::set_active_ccid(&app_handle, &identity.ccid)?;

    Ok(identity.ccid)
}

#[tauri::command]
pub(crate) async fn create_subkey(
    app_handle: tauri::AppHandle,
    ccid: Option<String>,
) -> Result<String, Error> {
    let target = accounts::resolve(&app_handle, ccid.as_deref())?;

    let sub_identity =
        generate_identity().map_err(|e| format!("Failed to generate sub identity: {}", e))?;
    let ckid = compute_ckid(&sub_identity.public_key)
        .map_err(|e| format!("Failed to compute ckid: {}", e))?;

    accounts::update_account(&app_handle, &target.ccid, |rec| {
        rec.sub_priv = Some(sub_identity.private_key.clone());
        rec.ckid = Some(ckid.clone());
    })?;

    Ok(ckid)
}

#[tauri::command]
pub(crate) async fn auth_available(app_handle: tauri::AppHandle) -> Result<String, Error> {
    auth::biometric_status(&app_handle)
}

#[tauri::command]
pub(crate) async fn sign_masterkey(
    app_handle: tauri::AppHandle,
    payload: &str,
    ccid: Option<String>,
) -> Result<String, Error> {
    let identity = auth::retract_masterkey(&app_handle, ccid.as_deref())?;
    sign(&identity.private_key, payload)
}

#[tauri::command]
pub(crate) async fn sign_subkey(
    app_handle: tauri::AppHandle,
    payload: &str,
    ccid: Option<String>,
) -> Result<(String, String), Error> {
    let (priv_key, ckid) = auth::retract_subkey(&app_handle, ccid.as_deref())?;
    let signature = sign(&priv_key, payload)?;

    Ok((signature, ckid))
}

#[tauri::command]
pub(crate) async fn set_domain(
    app_handle: tauri::AppHandle,
    domain: &str,
    ccid: Option<String>,
) -> Result<(), Error> {
    let target = accounts::resolve(&app_handle, ccid.as_deref())?;
    let domain = domain.to_string();
    accounts::update_account(&app_handle, &target.ccid, move |rec| {
        rec.domain = Some(domain);
    })
}

#[tauri::command]
pub(crate) async fn get_session(app_handle: tauri::AppHandle) -> Option<accounts::SessionInfo> {
    accounts::get_session(&app_handle)
}

#[tauri::command]
pub(crate) async fn get_active_ccid(app_handle: tauri::AppHandle) -> Result<Option<String>, Error> {
    accounts::get_active_ccid(&app_handle)
}

#[tauri::command]
pub(crate) async fn list_accounts(
    app_handle: tauri::AppHandle,
) -> Result<Vec<accounts::AccountSummary>, Error> {
    accounts::list_accounts(&app_handle)
}

#[tauri::command]
pub(crate) async fn switch_account(
    app_handle: tauri::AppHandle,
    ccid: &str,
) -> Result<accounts::SessionInfo, Error> {
    let target = accounts::resolve(&app_handle, Some(ccid))?;
    accounts::set_active_ccid(&app_handle, &target.ccid)?;

    Ok(accounts::SessionInfo {
        ccid: Some(target.ccid),
        ckid: target.ckid,
        domain: target.domain,
    })
}

/// アカウントを端末から削除する。マスターキーを破棄する破壊的操作のため、
/// JS層を信用せず、このコマンド自身がOSネイティブの確認ダイアログを最終セーフティとして表示する。
/// JS側が改ざん・バグっていても、ネイティブの明示的な同意が無い限り削除は実行されない。
/// ユーザーがキャンセルした場合は何も削除せず Ok(false) を返す(削除実行時は Ok(true))。
/// blocking_showはメインスレッド上ではフリーズするが、本コマンドはasyncでメインスレッド外で
/// 実行されるため安全(keychainプラグインと同じ理由でasync必須)。
#[tauri::command]
pub(crate) async fn remove_account(app_handle: tauri::AppHandle, ccid: &str) -> Result<bool, Error> {
    let confirmed = app_handle
        .dialog()
        .message("このアカウントを端末から削除します。よろしいですか？")
        .title("アカウント情報の削除")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "削除".to_string(),
            "キャンセル".to_string(),
        ))
        .blocking_show();

    if !confirmed {
        return Ok(false);
    }

    accounts::remove_account(&app_handle, ccid)?;
    Ok(true)
}

/// アカウント単位のログアウト: subkey/domainを破棄するが、mnemonicと一覧掲載は維持する。
/// 再ログイン(subkey再エンロール)はWelcomeのready状態から行う。
#[tauri::command]
pub(crate) async fn clear_session(
    app_handle: tauri::AppHandle,
    ccid: Option<String>,
) -> Result<(), Error> {
    let target = accounts::resolve(&app_handle, ccid.as_deref())?;
    accounts::update_account(&app_handle, &target.ccid, |rec| {
        rec.sub_priv = None;
        rec.ckid = None;
        rec.domain = None;
    })
}

/// 全アカウントを消去する非常口。通常のUIフローからは呼ばないこと。
#[tauri::command]
pub(crate) async fn clear_all(app_handle: tauri::AppHandle) -> Result<(), Error> {
    accounts::clear_all(&app_handle)
}

#[tauri::command]
pub(crate) fn load_identity(mnemonic: &str) -> Result<Identity, Error> {
    concrnt::load_identity(mnemonic)
}
