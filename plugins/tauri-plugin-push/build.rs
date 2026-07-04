// Commands actually implemented in src/commands.rs (forwarded to native via
// mobile.rs) plus "register_listener"/"remove_listener", which are NOT
// implemented in Rust: on mobile, any invoke("plugin:push|<cmd>") that our own
// invoke_handler doesn't match falls back automatically to the native
// Plugin base class (Kotlin/Swift), which already implements registerListener
// / removeListener and trigger(). They still need an ACL permission entry —
// hence listing them here so tauri-plugin autogenerates one — but no Rust
// command function should be added for them.
const COMMANDS: &[&str] = &[
    "check_permission",
    "request_permission",
    "get_token",
    "get_or_create_keys",
    "reset_keys",
    "set_context",
    "get_launch_notification",
    "register_listener",
    "remove_listener",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
