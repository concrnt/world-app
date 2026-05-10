use tauri_plugin_file_saver::{FileSaverExt, SaveTextFileRequest};

use crate::{auth, Error};

#[tauri::command]
pub(crate) async fn backup_masterkey(
    app_handle: tauri::AppHandle,
    template: &str,
    filename: &str,
) -> Result<(), Error> {
    let identity = auth::retract_masterkey(&app_handle)?;

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
