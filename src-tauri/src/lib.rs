use std::process::Command;
use std::thread;
use std::time::Duration;

/// Spawn the embedded MSPro-Ltd Corp server (Node.js) on port 3100.
/// In dev mode (`pnpm tauri dev`) the server is expected to be running already
/// (started by `beforeDevCommand`). In production builds the sidecar binary
/// is used instead.
fn spawn_server() {
    thread::spawn(|| {
        // Wait briefly for Tauri window to initialise before starting the backend.
        thread::sleep(Duration::from_millis(500));

        // Production: run the compiled server bundle.
        // Adjust path if the server output location changes.
        let server_js = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("server").join("index.js")));

        if let Some(path) = server_js {
            if path.exists() {
                let _ = Command::new("node")
                    .arg(&path)
                    .env("PORT", "3100")
                    .env("NODE_ENV", "production")
                    .spawn();
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Only spawn the embedded server in production (release) builds.
    // In dev mode the server is started by `beforeDevCommand` in tauri.conf.json.
    #[cfg(not(debug_assertions))]
    spawn_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running MSPro-Ltd Corp desktop application");
}
