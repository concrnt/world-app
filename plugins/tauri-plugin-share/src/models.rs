use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareTextRequest {
    pub text: String,
    pub title: Option<String>,
}
