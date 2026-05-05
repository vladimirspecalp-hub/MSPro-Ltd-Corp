// Auto-updater with backup mechanism for MSPro-Ltd Corp.
//
// Implements three Tauri commands:
//   * `check_for_update`         — wraps `app.updater().check()`.
//   * `install_update_with_backup` — backs up the current MSI + embedded
//     server bundle into `%LOCALAPPDATA%/MSPro-Ltd Corp/backups/v{ver}/`,
//     keeps a FIFO of the three most recent backups, then runs
//     `update.download_and_install()`. Streams events via a Tauri Channel.
//   * `list_backups`             — enumerates existing backups for UI.
//
// MSP-237 / P-2026-024 / D3 v0.1.4.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle};
use tauri_plugin_updater::UpdaterExt;

/// Folder name in `%LOCALAPPDATA%`. Must match `productName` in tauri.conf.json.
const PRODUCT_FOLDER: &str = "MSPro-Ltd Corp";

/// FIFO depth for backups.
const MAX_BACKUPS: usize = 3;

// ----------------------------------------------------------------------------
// Wire types
// ----------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum UpdateEvent {
    Started {
        content_length: Option<u64>,
    },
    Progress {
        downloaded: u64,
        total: Option<u64>,
        pct: Option<f64>,
    },
    Verifying,
    Installing,
    Done,
    Error {
        message: String,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BackupMeta {
    pub version: String,
    /// Unix epoch seconds as decimal string (kept simple to avoid pulling chrono).
    pub installed_at: String,
    pub files: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct BackupInfo {
    pub version: String,
    pub path: String,
    pub installed_at: String,
    pub files: Vec<String>,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize)]
pub struct UpdateAvailable {
    pub available: bool,
    pub current_version: String,
    pub new_version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

// ----------------------------------------------------------------------------
// Path helpers
// ----------------------------------------------------------------------------

fn local_appdata() -> Result<PathBuf, String> {
    std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .map_err(|_| "LOCALAPPDATA env var is not set".to_string())
}

fn backups_root() -> Result<PathBuf, String> {
    Ok(local_appdata()?.join(PRODUCT_FOLDER).join("backups"))
}

fn installer_dir() -> Result<PathBuf, String> {
    Ok(local_appdata()?.join(PRODUCT_FOLDER).join("installer"))
}

/// `server/` is bundled next to the executable in production builds.
fn current_server_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("server")))
        .filter(|p| p.exists())
}

fn timestamp_now() -> String {
    SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

// ----------------------------------------------------------------------------
// FS helpers
// ----------------------------------------------------------------------------

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst_path)?;
        } else if ty.is_file() {
            fs::copy(entry.path(), &dst_path)?;
        }
    }
    Ok(())
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(rd) = fs::read_dir(path) {
        for entry in rd.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    total += meta.len();
                } else if meta.is_dir() {
                    total += dir_size(&entry.path());
                }
            }
        }
    }
    total
}

// ----------------------------------------------------------------------------
// Backup logic
// ----------------------------------------------------------------------------

/// Keep only the `MAX_BACKUPS` most recent backups (by filesystem mtime).
fn prune_backups(root: &Path) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    let mut entries: Vec<(PathBuf, SystemTime)> = fs::read_dir(root)
        .map_err(|e| format!("read_dir backups: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let modified = e.metadata().ok()?.modified().ok()?;
            Some((e.path(), modified))
        })
        .collect();

    // Newest first. Skip the first MAX_BACKUPS, drop the rest.
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    for (path, _) in entries.into_iter().skip(MAX_BACKUPS) {
        let _ = fs::remove_dir_all(&path);
    }
    Ok(())
}

/// Create a backup folder for `current_version` containing the current MSI(s)
/// and the embedded `server/` bundle, plus a `meta.json`.
fn create_backup(current_version: &str) -> Result<(), String> {
    let root = backups_root()?;
    let backup_dir = root.join(format!("v{}", current_version));

    if backup_dir.exists() {
        fs::remove_dir_all(&backup_dir)
            .map_err(|e| format!("clean previous backup: {}", e))?;
    }
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("create backup dir: {}", e))?;

    let mut files: Vec<String> = Vec::new();

    // 1. Copy current MSI(s) from installer dir.
    if let Ok(inst) = installer_dir() {
        if inst.exists() {
            if let Ok(rd) = fs::read_dir(&inst) {
                for entry in rd.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("msi")
                        && path.is_file()
                    {
                        let name = entry.file_name();
                        let dst = backup_dir.join(&name);
                        if fs::copy(&path, &dst).is_ok() {
                            files.push(name.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    // 2. Copy embedded server/ folder if present.
    if let Some(server) = current_server_dir() {
        let dst = backup_dir.join("server");
        if copy_dir_all(&server, &dst).is_ok() {
            files.push("server/".to_string());
        }
    }

    // 3. Write meta.json.
    let meta = BackupMeta {
        version: current_version.to_string(),
        installed_at: timestamp_now(),
        files,
    };
    let json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("serialize meta: {}", e))?;
    fs::write(backup_dir.join("meta.json"), json)
        .map_err(|e| format!("write meta.json: {}", e))?;

    // 4. FIFO prune.
    prune_backups(&root)?;
    Ok(())
}

// ----------------------------------------------------------------------------
// Tauri commands
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateAvailable, String> {
    let current_version = app.package_info().version.to_string();
    let updater = app.updater().map_err(|e| e.to_string())?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateAvailable {
            available: true,
            current_version,
            new_version: Some(update.version.clone()),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        }),
        Ok(None) => Ok(UpdateAvailable {
            available: false,
            current_version,
            new_version: None,
            notes: None,
            date: None,
        }),
        Err(e) => Err(format!("updater check failed: {}", e)),
    }
}

#[tauri::command]
pub async fn install_update_with_backup(
    app: AppHandle,
    on_event: Channel<UpdateEvent>,
) -> Result<(), String> {
    let current_version = app.package_info().version.to_string();

    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| format!("updater check failed: {}", e))?
        .ok_or_else(|| "no update available".to_string())?;

    // 1. Backup current installation. On failure: emit Error and abort.
    if let Err(e) = create_backup(&current_version) {
        let _ = on_event.send(UpdateEvent::Error {
            message: format!("backup failed: {}", e),
        });
        return Err(e);
    }

    // Shared state for the chunk callback (Fn, may be invoked many times).
    let started = Arc::new(Mutex::new(false));
    let downloaded = Arc::new(Mutex::new(0u64));

    let chunk_event = on_event.clone();
    let chunk_started = started.clone();
    let chunk_downloaded = downloaded.clone();

    let done_event = on_event.clone();

    let install_res = update
        .download_and_install(
            move |chunk_length, content_length| {
                // Emit Started exactly once on the first chunk.
                {
                    let mut s = chunk_started.lock().unwrap();
                    if !*s {
                        *s = true;
                        let _ = chunk_event.send(UpdateEvent::Started {
                            content_length,
                        });
                    }
                }
                let mut dl = chunk_downloaded.lock().unwrap();
                *dl += chunk_length as u64;
                let downloaded_now = *dl;
                let pct = content_length.and_then(|t| {
                    if t > 0 {
                        Some((downloaded_now as f64 / t as f64) * 100.0)
                    } else {
                        None
                    }
                });
                let _ = chunk_event.send(UpdateEvent::Progress {
                    downloaded: downloaded_now,
                    total: content_length,
                    pct,
                });
            },
            move || {
                // Download complete; signature already verified by the plugin
                // before this callback fires, so emit Verifying → Installing.
                let _ = done_event.send(UpdateEvent::Verifying);
                let _ = done_event.send(UpdateEvent::Installing);
            },
        )
        .await;

    match install_res {
        Ok(_) => {
            let _ = on_event.send(UpdateEvent::Done);
            Ok(())
        }
        Err(e) => {
            let msg = format!("install failed: {}", e);
            let _ = on_event.send(UpdateEvent::Error {
                message: msg.clone(),
            });
            Err(msg)
        }
    }
}

#[tauri::command]
pub fn list_backups() -> Result<Vec<BackupInfo>, String> {
    let root = backups_root()?;
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut backups: Vec<BackupInfo> = Vec::new();
    let entries = fs::read_dir(&root).map_err(|e| format!("read_dir backups: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = entry.file_name().to_string_lossy().to_string();
        let fallback_version = dir_name
            .strip_prefix('v')
            .unwrap_or(&dir_name)
            .to_string();

        let meta_path = path.join("meta.json");
        let (version, installed_at, files) = if meta_path.exists() {
            match fs::read_to_string(&meta_path)
                .ok()
                .and_then(|s| serde_json::from_str::<BackupMeta>(&s).ok())
            {
                Some(m) => (m.version, m.installed_at, m.files),
                None => (fallback_version, "unknown".to_string(), Vec::new()),
            }
        } else {
            (fallback_version, "unknown".to_string(), Vec::new())
        };

        backups.push(BackupInfo {
            version,
            path: path.to_string_lossy().to_string(),
            installed_at,
            files,
            size_bytes: dir_size(&path),
        });
    }

    // Newest first by installed_at (lexicographic on epoch-seconds string is
    // monotonic for values of the same length).
    backups.sort_by(|a, b| b.installed_at.cmp(&a.installed_at));
    Ok(backups)
}

// ----------------------------------------------------------------------------
// Rollback (MSP-238)
// ----------------------------------------------------------------------------

/// Find the most recent backup directory under `backups_root()` (newest by
/// directory mtime) and return the path to its first `.msi` file.
fn latest_backup_msi() -> Result<PathBuf, String> {
    let root = backups_root()?;
    if !root.exists() {
        return Err("no backups directory".to_string());
    }

    let mut entries: Vec<(PathBuf, SystemTime)> = fs::read_dir(&root)
        .map_err(|e| format!("read_dir backups: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let modified = e.metadata().ok()?.modified().ok()?;
            Some((e.path(), modified))
        })
        .collect();

    if entries.is_empty() {
        return Err("no backups available".to_string());
    }
    entries.sort_by(|a, b| b.1.cmp(&a.1));

    for (dir, _) in entries {
        if let Ok(rd) = fs::read_dir(&dir) {
            for entry in rd.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path.extension().and_then(|s| s.to_str()) == Some("msi")
                {
                    return Ok(path);
                }
            }
        }
    }
    Err("no .msi found in any backup".to_string())
}

/// Rollback to the most recent backup. Runs `msiexec /i <backup.msi>
/// /quiet /norestart` to silently reinstall the previous version, waits for
/// it to exit, then triggers `app.restart()` so the new (older) binary is
/// loaded. The MSI installer replaces the currently running executable on
/// disk; the actual hot-swap happens after restart.
#[tauri::command]
pub async fn rollback(app: AppHandle) -> Result<(), String> {
    let msi = latest_backup_msi()?;

    let status = Command::new("msiexec")
        .arg("/i")
        .arg(&msi)
        .arg("/quiet")
        .arg("/norestart")
        .status()
        .map_err(|e| format!("failed to spawn msiexec: {}", e))?;

    if !status.success() {
        return Err(format!(
            "msiexec exited with non-zero status: {}",
            status.code().map(|c| c.to_string()).unwrap_or_else(|| "unknown".to_string())
        ));
    }

    // Replace current process with the newly-installed (older) binary.
    app.restart();
}
