use concrnt::Identity;
use tauri::plugin::mobile::PluginInvokeError;
use tauri_plugin_biometric::{AuthOptions, BiometricExt, Error as BiometricError};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

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

// 端末に利用可能な認証手段(生体認証・画面ロック)が一つも無いことを示すエラーコード。
// このときは認証を強制しても永久に進行不能になるだけなので、ユーザーの明示的な同意の上で続行する。
// (マスターキーはBlock Store/SharedPreferencesに保存されており生体認証で暗号化保護されている訳ではなく、
//  このプロンプトは確認ゲートに過ぎない)
const NO_AUTH_METHOD_CODES: &[&str] = &[
    "biometryNotEnrolled",  // Android: 生体情報が未登録
    "noDeviceCredential",   // Android: 画面ロック(PIN/パターン/パスワード)未設定
    "biometryNotAvailable", // Android/iOS: 認証機構自体が使えない
    "passcodeNotSet",       // iOS: パスコード未設定
];

pub(crate) fn authenticate_keychain_access(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    // allow_device_credential: true により、生体認証がOFFでも画面ロック(PIN等)があればそれに
    // フォールバックする(状態A / iOSのパスコード)。フォールバック先が存在すればここで成功する。
    let err = match app_handle.biometric().authenticate(
        "Authenticate to access the keychain item".to_string(),
        AuthOptions {
            allow_device_credential: true,
            cancel_title: Some("Cannot access key without authentication".to_string()),
            ..Default::default()
        },
    ) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };

    // プラグインが返すエラーコードを構造化された形で取り出す(tauri::plugin::mobile::ErrorResponse)。
    let code = match &err {
        BiometricError::PluginInvoke(PluginInvokeError::InvokeRejected(resp)) => {
            resp.code.clone().unwrap_or_default()
        }
        _ => String::new(),
    };

    // 認証手段が一つも無い端末(状態B: 生体認証OFFかつ画面ロック無し)。
    // 進行不能を避けるため、確認ダイアログで同意を取ってから続行する。
    if NO_AUTH_METHOD_CODES.contains(&code.as_str()) {
        let proceed = app_handle
            .dialog()
            .message(
                "この端末には画面ロック(PIN・パターン・指紋など)が設定されていません。\nデバイス認証なしで続行しますか？",
            )
            .title("デバイス認証が利用できません")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "続行".to_string(),
                "キャンセル".to_string(),
            ))
            .blocking_show();

        if proceed {
            return Ok(());
        }
        return Err("認証がキャンセルされました。鍵にアクセスできません".to_string());
    }

    // プロンプトは提示されたがユーザーがキャンセル/失敗した、あるいはその他のエラー。
    // 本当の原因(コード/メッセージ)を含めて返し、フロント側で正しく表示できるようにする。
    Err(format!("端末認証に失敗しました: {}", err))
}
