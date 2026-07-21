use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<AgeVerify<R>> {
  Ok(AgeVerify(app.clone()))
}

/// Access to the age-verification APIs.
///
/// There is no Declared Age Range API off iOS, so desktop always reports the
/// gate as unavailable (which the frontend treats as "pass").
pub struct AgeVerify<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> AgeVerify<R> {
  pub async fn request_age_range(&self) -> crate::Result<AgeRangeResponse> {
    Ok(AgeRangeResponse::default())
  }
}
