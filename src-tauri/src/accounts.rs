use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_keychain::{KeychainExt, KeychainRequest};
use tauri_plugin_store::StoreExt;

use crate::Error;

// 全アカウントを1つのJSONブロブとして、2つのストアに保存する:
//   - ローカル正コピー: tauri-plugin-store(端末内の永続ファイル)。消えない「真」の保存先。
//   - iCloud同期バックアップ: iOSキーチェーンの synchronizable アイテム。クロスデバイス/復元用。
// キーチェーンの synchronizable アイテムはシミュレータやiCloud設定変更時にまばらに読めなくなるため、
// これ単独には依存しない。読み取り時は両者を ccid で統合(union)し、片方が一時的に読めなくても、
// あるいは片方にしか無いアカウントでも「無いこと」にはしない。並び順はローカルを基準とする。
// 書き込みはローカル(必ず永続化)＋キーチェーン(ベストエフォート)の両方に行う。
// AndroidではキーチェーンプラグインがBlock Store + Auto Backupを用い、アンインストール後も復元される。
const ACCOUNTS_KEY: &str = "concrnt_accounts";
const SESSION_STORE: &str = "session";
const ACTIVE_CCID: &str = "active_ccid";
// ローカル正コピーをストア内に保持するキー。
const LOCAL_ACCOUNTS: &str = "accounts";

// Block Storeの総容量(約64KB)に対する安全マージン。1アカウント約450バイト。
const MAX_ACCOUNTS: usize = 20;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub(crate) struct AccountRecord {
    pub ccid: String,
    pub mnemonic: String,
    #[serde(default)]
    pub sub_priv: Option<String>,
    #[serde(default)]
    pub ckid: Option<String>,
    #[serde(default)]
    pub domain: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub(crate) struct AccountsFile {
    pub version: u32,
    pub accounts: Vec<AccountRecord>,
}

impl Default for AccountsFile {
    fn default() -> Self {
        Self {
            version: 1,
            accounts: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct SessionInfo {
    pub ccid: Option<String>,
    pub ckid: Option<String>,
    pub domain: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AccountSummary {
    pub ccid: String,
    pub ckid: Option<String>,
    pub domain: Option<String>,
    pub is_active: bool,
}

// コマンドはasyncで並行実行され得るため、ブロブのload-modify-saveを直列化する。
// キーチェーン呼び出しはブロッキング(awaitを跨がない)なのでstdのMutexでよい。
#[derive(Default)]
pub(crate) struct AccountsLock(Mutex<()>);

// ===== 純粋ロジック(AppHandle非依存、ユニットテスト対象) =====

/// 鍵消失防止の不変条件チェック。
/// 明示的な削除操作(allow_removal)以外では、既存の全アカウントが新ブロブに
/// 残っていなければ保存を拒否する。mnemonicの書き換えは削除操作であっても拒否する
/// (ccidはmnemonic由来なので、同一ccidでmnemonicが変わることは正常系では起こらない)。
fn guard_no_key_loss(
    before: &AccountsFile,
    after: &AccountsFile,
    allow_removal: bool,
) -> Result<(), Error> {
    for old in &before.accounts {
        match after.accounts.iter().find(|a| a.ccid == old.ccid) {
            Some(new) => {
                if new.mnemonic != old.mnemonic {
                    return Err(format!(
                        "Refusing to save: mnemonic for {} would be overwritten",
                        old.ccid
                    ));
                }
            }
            None => {
                if !allow_removal {
                    return Err(format!(
                        "Refusing to save: account {} would be lost",
                        old.ccid
                    ));
                }
            }
        }
    }
    Ok(())
}

/// アカウントを追加または更新する。同一ccidが既に存在する場合、mnemonicは
/// 既存の値を維持し、subkey系フィールドも新レコードがNoneなら既存値を残す(冪等な再インポート)。
fn upsert_into(file: &mut AccountsFile, rec: AccountRecord) -> Result<(), Error> {
    if let Some(existing) = file.accounts.iter_mut().find(|a| a.ccid == rec.ccid) {
        if rec.sub_priv.is_some() {
            existing.sub_priv = rec.sub_priv;
        }
        if rec.ckid.is_some() {
            existing.ckid = rec.ckid;
        }
        if rec.domain.is_some() {
            existing.domain = rec.domain;
        }
        return Ok(());
    }
    if file.accounts.len() >= MAX_ACCOUNTS {
        return Err(format!("Cannot add more than {} accounts", MAX_ACCOUNTS));
    }
    file.accounts.push(rec);
    Ok(())
}

/// アカウントを削除し、削除後にアクティブにすべきccidを返す。
/// 削除対象がアクティブだった場合は残りの先頭、いなければNone。
fn remove_from(
    file: &mut AccountsFile,
    ccid: &str,
    active: Option<&str>,
) -> Result<Option<String>, Error> {
    let index = file
        .accounts
        .iter()
        .position(|a| a.ccid == ccid)
        .ok_or_else(|| format!("Account {} not found", ccid))?;
    file.accounts.remove(index);

    match active {
        Some(a) if a != ccid => Ok(Some(a.to_string())),
        _ => Ok(file.accounts.first().map(|a| a.ccid.clone())),
    }
}

/// 保存されているアクティブポインタをブロブと照合し、実際に使うべきccidを返す。
/// ポインタが無効・欠落している場合は先頭アカウントにフォールバックする。
fn pick_active(file: &AccountsFile, stored: Option<&str>) -> Option<String> {
    if let Some(ccid) = stored {
        if file.accounts.iter().any(|a| a.ccid == ccid) {
            return Some(ccid.to_string());
        }
    }
    file.accounts.first().map(|a| a.ccid.clone())
}

/// ローカル(正)とクラウド(iCloud同期バックアップ)のアカウント一覧を統合する。
/// どちらか一方にしか無いアカウントも保持し(ccidで重複排除)、「鍵があるのに無い」誤認を防ぐ。
/// 並び順はローカルを基準にし(将来の並べ替え機能はローカルで順序を持つ)、ローカルに無く
/// クラウドにのみ有るアカウントを末尾に追加する。同一ccidが両方にある場合は、subkey/domain等の
/// 端末固有フィールドを持つローカルのレコードを優先する。
fn merge_accounts(local: Option<AccountsFile>, cloud: Option<AccountsFile>) -> AccountsFile {
    let mut merged = local.map(|f| f.accounts).unwrap_or_default();
    if let Some(cloud) = cloud {
        for c in cloud.accounts {
            if !merged.iter().any(|a| a.ccid == c.ccid) {
                merged.push(c);
            }
        }
    }
    AccountsFile {
        version: 1,
        accounts: merged,
    }
}

// ===== ストアIO(ローカル正コピー) =====

/// ローカル正コピーを読み込む。欠落はNone。パース失敗はErr(壊れた正を空として上書きしないため)。
fn load_local(app_handle: &tauri::AppHandle) -> Result<Option<AccountsFile>, Error> {
    let store = session_store(app_handle)?;
    match store.get(LOCAL_ACCOUNTS) {
        Some(value) => {
            let file: AccountsFile = serde_json::from_value(value)
                .map_err(|e| format!("Local accounts data is corrupted: {}", e))?;
            Ok(Some(file))
        }
        None => Ok(None),
    }
}

/// ローカル正コピーを永続化する。鍵の唯一確実な保存先なので、必ずディスクへflushする。
fn save_local(app_handle: &tauri::AppHandle, file: &AccountsFile) -> Result<(), Error> {
    let store = session_store(app_handle)?;
    let value =
        serde_json::to_value(file).map_err(|e| format!("Failed to serialize accounts: {}", e))?;
    store.set(LOCAL_ACCOUNTS.to_string(), value);
    store
        .save()
        .map_err(|e| format!("Failed to persist accounts: {}", e))
}

// ===== キーチェーンIO(iCloud同期バックアップ) =====

/// iCloud同期バックアップを読み込む。ベストエフォート: 読み取り失敗・パース失敗はNone
/// (ローカル正が別途あるため致命的でない)。
fn load_cloud(app_handle: &tauri::AppHandle) -> Option<AccountsFile> {
    let request = KeychainRequest {
        key: Some(ACCOUNTS_KEY.to_string()),
        password: None,
    };
    let raw = app_handle.keychain().get_item(request).ok()?.password?;
    if raw.trim().is_empty() {
        return None;
    }
    match serde_json::from_str(&raw) {
        Ok(file) => Some(file),
        Err(_) => None,
    }
}

/// iCloud同期バックアップへ書き込む(ベストエフォート)。統合済みブロブを書くため、
/// 既存クラウド分の消失は起きない(update-or-add)。失敗しても正はローカルにあるので無視する。
fn save_cloud_best_effort(app_handle: &tauri::AppHandle, file: &AccountsFile) {
    let json = match serde_json::to_string(file) {
        Ok(json) => json,
        Err(_) => return,
    };
    let updated = app_handle.keychain().update_item(KeychainRequest {
        key: Some(ACCOUNTS_KEY.to_string()),
        password: Some(json.clone()),
    });
    if !updated {
        // 存在しなければ追加する。
        app_handle.keychain().save_item(KeychainRequest {
            key: Some(ACCOUNTS_KEY.to_string()),
            password: Some(json),
        });
    }
}

/// ローカル正とクラウドを統合した現在のアカウント一覧を返す。
pub(crate) fn load_accounts(app_handle: &tauri::AppHandle) -> Result<AccountsFile, Error> {
    let local = load_local(app_handle)?;
    let cloud = load_cloud(app_handle);
    Ok(merge_accounts(local, cloud))
}

/// クラウドにのみ存在する既存データを、信頼できるローカル正コピーへ複製する(冪等)。
/// 既存ユーザーの移行と、同期コピーが一時的に読めない状況での「無いこと」誤認の防止のため、
/// アプリ起動時の読み取り経路(get_active_ccid)から呼ぶ。ミューテーションロックを取得して
/// 読み取り経路の競合書き込みを避ける。ローカルが既に存在すれば何もしない。
fn ensure_migrated(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    let lock = app_handle.state::<AccountsLock>();
    let _guard = lock
        .0
        .lock()
        .map_err(|_| "Accounts lock is poisoned".to_string())?;

    if load_local(app_handle)?
        .map(|f| !f.accounts.is_empty())
        .unwrap_or(false)
    {
        return Ok(());
    }
    if let Some(cloud) = load_cloud(app_handle) {
        if !cloud.accounts.is_empty() {
            save_local(app_handle, &cloud)?;
        }
    }
    Ok(())
}

/// アカウント一覧への全ての変更はこの関数を通す。Mutexで直列化し、統合した現在値(before)を基準に
/// 変更後にguard_no_key_lossで鍵の消失がないことを検証してから、ローカル正(必ず永続化)と
/// クラウド同期バックアップ(ベストエフォート)の両方へ保存する。
pub(crate) fn with_accounts_mut<T>(
    app_handle: &tauri::AppHandle,
    allow_removal: bool,
    f: impl FnOnce(&mut AccountsFile) -> Result<T, Error>,
) -> Result<T, Error> {
    let lock = app_handle.state::<AccountsLock>();
    let _guard = lock
        .0
        .lock()
        .map_err(|_| "Accounts lock is poisoned".to_string())?;

    let before = merge_accounts(load_local(app_handle)?, load_cloud(app_handle));
    let mut file = before.clone();
    let result = f(&mut file)?;
    guard_no_key_loss(&before, &file, allow_removal)?;
    save_local(app_handle, &file)?;
    save_cloud_best_effort(app_handle, &file);
    Ok(result)
}

pub(crate) fn upsert_account(
    app_handle: &tauri::AppHandle,
    rec: AccountRecord,
) -> Result<(), Error> {
    with_accounts_mut(app_handle, false, |file| upsert_into(file, rec))
}

pub(crate) fn update_account(
    app_handle: &tauri::AppHandle,
    ccid: &str,
    f: impl FnOnce(&mut AccountRecord),
) -> Result<(), Error> {
    with_accounts_mut(app_handle, false, |file| {
        let rec = file
            .accounts
            .iter_mut()
            .find(|a| a.ccid == ccid)
            .ok_or_else(|| format!("Account {} not found", ccid))?;
        f(rec);
        Ok(())
    })
}

pub(crate) fn remove_account(app_handle: &tauri::AppHandle, ccid: &str) -> Result<(), Error> {
    let active = get_active_ccid(app_handle)?;
    let next_active =
        with_accounts_mut(app_handle, true, |file| remove_from(file, ccid, active.as_deref()))?;

    match next_active {
        Some(next) => set_active_ccid(app_handle, &next),
        None => clear_active_ccid(app_handle),
    }
}

/// 全アカウントとアクティブポインタを消す非常口。通常のフローからは呼ばないこと。
/// ローカル正・クラウド同期の両方を消す。クラウド削除に失敗するとローカルを消しても
/// 次回のunion読み取りで復活し得るため、その場合はエラーを返してリトライを促す。
pub(crate) fn clear_all(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    let lock = app_handle.state::<AccountsLock>();
    let _guard = lock
        .0
        .lock()
        .map_err(|_| "Accounts lock is poisoned".to_string())?;

    let cloud_removed = app_handle.keychain().remove_item(KeychainRequest {
        key: Some(ACCOUNTS_KEY.to_string()),
        password: None,
    });

    let store = session_store(app_handle)?;
    store.clear();
    store
        .save()
        .map_err(|e| format!("Failed to persist store: {}", e))?;

    if !cloud_removed {
        return Err(
            "Failed to clear iCloud-synced accounts from keychain (local copy was cleared)"
                .to_string(),
        );
    }
    Ok(())
}

// ===== アクティブアカウント =====

pub(crate) fn get_active_ccid(app_handle: &tauri::AppHandle) -> Result<Option<String>, Error> {
    // 起動時の読み取り経路。既存ユーザーのクラウド→ローカル移行をここで確実に行う。
    ensure_migrated(app_handle)?;
    let file = load_accounts(app_handle)?;

    let store = session_store(app_handle)?;
    let stored = store.get(ACTIVE_CCID.to_string()).and_then(json_string);

    let picked = pick_active(&file, stored.as_deref());
    if picked != stored {
        match &picked {
            Some(ccid) => set_active_ccid(app_handle, ccid)?,
            None => clear_active_ccid(app_handle)?,
        }
    }
    Ok(picked)
}

pub(crate) fn set_active_ccid(app_handle: &tauri::AppHandle, ccid: &str) -> Result<(), Error> {
    let store = session_store(app_handle)?;
    store.set(ACTIVE_CCID.to_string(), ccid.to_string());
    Ok(())
}

fn clear_active_ccid(app_handle: &tauri::AppHandle) -> Result<(), Error> {
    let store = session_store(app_handle)?;
    store.delete(ACTIVE_CCID.to_string());
    Ok(())
}

/// 明示ccidまたはアクティブアカウントのレコードを返す。
pub(crate) fn resolve(
    app_handle: &tauri::AppHandle,
    ccid: Option<&str>,
) -> Result<AccountRecord, Error> {
    let file = load_accounts(app_handle)?;
    let target = match ccid {
        Some(c) => c.to_string(),
        None => get_active_ccid(app_handle)?.ok_or_else(|| "No account found".to_string())?,
    };
    file.accounts
        .into_iter()
        .find(|a| a.ccid == target)
        .ok_or_else(|| format!("Account {} not found", target))
}

pub(crate) fn get_session(app_handle: &tauri::AppHandle) -> Option<SessionInfo> {
    let record = resolve(app_handle, None).ok()?;
    Some(SessionInfo {
        ccid: Some(record.ccid),
        ckid: record.ckid,
        domain: record.domain,
    })
}

pub(crate) fn list_accounts(app_handle: &tauri::AppHandle) -> Result<Vec<AccountSummary>, Error> {
    let file = load_accounts(app_handle)?;
    let active = get_active_ccid(app_handle)?;
    Ok(file
        .accounts
        .into_iter()
        .map(|a| AccountSummary {
            is_active: Some(a.ccid.as_str()) == active.as_deref(),
            ccid: a.ccid,
            ckid: a.ckid,
            domain: a.domain,
        })
        .collect())
}

fn session_store(
    app_handle: &tauri::AppHandle,
) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, Error> {
    app_handle
        .store(SESSION_STORE)
        .map_err(|e| format!("Failed to create store: {}", e))
}

fn json_string(value: serde_json::Value) -> Option<String> {
    value.as_str().map(String::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(ccid: &str, mnemonic: &str) -> AccountRecord {
        AccountRecord {
            ccid: ccid.to_string(),
            mnemonic: mnemonic.to_string(),
            sub_priv: None,
            ckid: None,
            domain: None,
        }
    }

    fn file_with(accounts: Vec<AccountRecord>) -> AccountsFile {
        AccountsFile {
            version: 1,
            accounts,
        }
    }

    #[test]
    fn serde_roundtrip() {
        let mut rec = record("con1aaa", "apple banana");
        rec.sub_priv = Some("deadbeef".to_string());
        rec.ckid = Some("cck1xxx".to_string());
        rec.domain = Some("example.com".to_string());
        let file = file_with(vec![rec]);

        let json = serde_json::to_string(&file).unwrap();
        let parsed: AccountsFile = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.version, 1);
        assert_eq!(parsed.accounts, file.accounts);
    }

    #[test]
    fn guard_rejects_account_loss_without_flag() {
        let before = file_with(vec![record("con1aaa", "m1"), record("con1bbb", "m2")]);
        let after = file_with(vec![record("con1aaa", "m1")]);
        assert!(guard_no_key_loss(&before, &after, false).is_err());
        assert!(guard_no_key_loss(&before, &after, true).is_ok());
    }

    #[test]
    fn guard_rejects_mnemonic_overwrite_even_with_flag() {
        let before = file_with(vec![record("con1aaa", "m1")]);
        let after = file_with(vec![record("con1aaa", "DIFFERENT")]);
        assert!(guard_no_key_loss(&before, &after, false).is_err());
        assert!(guard_no_key_loss(&before, &after, true).is_err());
    }

    #[test]
    fn guard_allows_subkey_changes() {
        let before = file_with(vec![record("con1aaa", "m1")]);
        let mut updated = record("con1aaa", "m1");
        updated.sub_priv = Some("newsub".to_string());
        let after = file_with(vec![updated]);
        assert!(guard_no_key_loss(&before, &after, false).is_ok());
    }

    #[test]
    fn upsert_preserves_existing_mnemonic_and_subkey() {
        let mut existing = record("con1aaa", "m1");
        existing.sub_priv = Some("oldsub".to_string());
        existing.ckid = Some("oldckid".to_string());
        existing.domain = Some("example.com".to_string());
        let mut file = file_with(vec![existing]);

        // mnemonicが違っても(正常系ではあり得ないが)既存値を維持し、Noneのフィールドは残す
        upsert_into(&mut file, record("con1aaa", "SHOULD_BE_IGNORED")).unwrap();

        assert_eq!(file.accounts.len(), 1);
        assert_eq!(file.accounts[0].mnemonic, "m1");
        assert_eq!(file.accounts[0].sub_priv.as_deref(), Some("oldsub"));
        assert_eq!(file.accounts[0].ckid.as_deref(), Some("oldckid"));
        assert_eq!(file.accounts[0].domain.as_deref(), Some("example.com"));
    }

    #[test]
    fn upsert_appends_new_account_and_respects_cap() {
        let mut file = file_with(vec![]);
        upsert_into(&mut file, record("con1aaa", "m1")).unwrap();
        assert_eq!(file.accounts.len(), 1);

        for i in 1..MAX_ACCOUNTS {
            upsert_into(&mut file, record(&format!("con1x{}", i), "m")).unwrap();
        }
        assert!(upsert_into(&mut file, record("con1overflow", "m")).is_err());
    }

    #[test]
    fn remove_repoints_active_to_first_remaining() {
        let mut file = file_with(vec![record("con1aaa", "m1"), record("con1bbb", "m2")]);
        let next = remove_from(&mut file, "con1aaa", Some("con1aaa")).unwrap();
        assert_eq!(next.as_deref(), Some("con1bbb"));
    }

    #[test]
    fn remove_keeps_active_when_other_removed() {
        let mut file = file_with(vec![record("con1aaa", "m1"), record("con1bbb", "m2")]);
        let next = remove_from(&mut file, "con1bbb", Some("con1aaa")).unwrap();
        assert_eq!(next.as_deref(), Some("con1aaa"));
    }

    #[test]
    fn remove_last_account_clears_active() {
        let mut file = file_with(vec![record("con1aaa", "m1")]);
        let next = remove_from(&mut file, "con1aaa", Some("con1aaa")).unwrap();
        assert_eq!(next, None);
    }

    #[test]
    fn merge_unions_dedupes_and_prefers_local() {
        let mut local_a = record("con1aaa", "m1");
        local_a.domain = Some("local.example".to_string());
        let local = file_with(vec![local_a, record("con1bbb", "m2")]);

        let mut cloud_a = record("con1aaa", "m1");
        cloud_a.domain = Some("cloud.example".to_string()); // 同一ccidはローカル優先
        let cloud = file_with(vec![cloud_a, record("con1ccc", "m3")]); // con1cccはクラウドのみ

        let merged = merge_accounts(Some(local), Some(cloud));
        let ccids: Vec<&str> = merged.accounts.iter().map(|a| a.ccid.as_str()).collect();
        // ローカル順を基準にし、クラウドのみのアカウントを末尾に追加する
        assert_eq!(ccids, vec!["con1aaa", "con1bbb", "con1ccc"]);
        // 同一ccidはローカルのフィールドを優先する
        assert_eq!(merged.accounts[0].domain.as_deref(), Some("local.example"));
    }

    #[test]
    fn merge_handles_missing_sides() {
        assert!(merge_accounts(None, None).accounts.is_empty());
        assert_eq!(
            merge_accounts(None, Some(file_with(vec![record("con1ccc", "m3")]))).accounts.len(),
            1
        );
        assert_eq!(
            merge_accounts(Some(file_with(vec![record("con1aaa", "m1")])), None).accounts.len(),
            1
        );
    }

    #[test]
    fn pick_active_falls_back_to_first() {
        let file = file_with(vec![record("con1aaa", "m1"), record("con1bbb", "m2")]);
        assert_eq!(
            pick_active(&file, Some("con1bbb")).as_deref(),
            Some("con1bbb")
        );
        assert_eq!(
            pick_active(&file, Some("con1missing")).as_deref(),
            Some("con1aaa")
        );
        assert_eq!(pick_active(&file, None).as_deref(), Some("con1aaa"));
        assert_eq!(pick_active(&file_with(vec![]), Some("con1aaa")), None);
    }
}
