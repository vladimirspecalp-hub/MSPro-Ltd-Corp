mod updater;

use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Singleton holding the spawned server sidecar child process.
static SERVER_CHILD: OnceLock<Mutex<Option<CommandChild>>> = OnceLock::new();

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

/// Spawn the MSPro-Ltd Corp server as a Tauri ShellExt sidecar.
/// The binary is registered via `bundle.externalBin = ["binaries/server"]` in tauri.conf.json.
/// On success the `CommandChild` is stored in `SERVER_CHILD` for later cleanup.
fn spawn_server(app: &tauri::AppHandle) {
    let cell = SERVER_CHILD.get_or_init(|| Mutex::new(None));
    match app
        .shell()
        .sidecar("server")
        .and_then(|cmd| {
            cmd.env("PORT", "3100")
                .env("NODE_ENV", "production")
                .spawn()
        }) {
        Ok((_rx, child)) => {
            let mut guard = cell.lock().unwrap();
            *guard = Some(child);
        }
        Err(e) => eprintln!("[devops] server sidecar spawn failed: {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Apply GPU mode flags from flag file before WebView2 initialises.
    apply_gpu_mode_if_enabled();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            spawn_server(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            updater::check_for_update,
            updater::install_update_with_backup,
            updater::list_backups,
            updater::rollback,
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(cell) = SERVER_CHILD.get() {
                    if let Ok(mut guard) = cell.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running MSPro-Ltd Corp desktop application");
}
