use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;

/// Resolve the GPU mode flag file path, mirroring the Node.js `resolveGpuModeFlagPath()`.
/// Default: `~/.mspro-ltd/instances/default/gpu-mode.flag`.
/// Override via `MSPROLTD_HOME` and `MSPROLTD_INSTANCE_ID` env vars (same as the server).
fn resolve_gpu_mode_flag_path() -> PathBuf {
    let home_base = std::env::var("MSPROLTD_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(".mspro-ltd")
        });
    let instance_id = std::env::var("MSPROLTD_INSTANCE_ID")
        .map(|v| v.trim().to_string())
        .unwrap_or_else(|_| "default".to_string());
    home_base.join("instances").join(instance_id).join("gpu-mode.flag")
}

/// If the GPU mode flag file exists, apply GPU acceleration settings:
/// - `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` → Chromium GPU rasterization flags for WebView2
/// - `OLLAMA_NUM_GPU=999` → inherited by the Node server process for GPU-accelerated LLM inference
///
/// Must be called before `tauri::Builder::default()` so that WebView2 picks up the env var.
fn apply_gpu_mode_if_enabled() {
    if resolve_gpu_mode_flag_path().exists() {
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-gpu-rasterization --enable-zero-copy",
        );
        std::env::set_var("OLLAMA_NUM_GPU", "999");
    }
}

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
    // Apply GPU mode flags from flag file before WebView2 initialises.
    // The flag file is written/removed by the server when the user toggles
    // "Усиленный режим (GPU)" in Settings → General.
    apply_gpu_mode_if_enabled();

    // Only spawn the embedded server in production (release) builds.
    // Embedded server bundling not implemented yet (P-2026-021 backlog).
    // App expects external Paperclip server on http://127.0.0.1:3100 in v0.1.0.
    // spawn_server() disabled to prevent silent failures.
    let _ = spawn_server;

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running MSPro-Ltd Corp desktop application");
}
