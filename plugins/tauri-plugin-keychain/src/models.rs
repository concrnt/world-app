use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainRequest {
  pub key: Option<String>,
  pub password: Option<String>,
}


#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainResponse {
  pub password: Option<String>,
}
