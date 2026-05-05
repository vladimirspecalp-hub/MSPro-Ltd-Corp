/**
 * Tauri commands wrapper for in-app updater UI (P-2026-024 B2).
 *
 * Pure data layer: no UI / React. Backed by Rust commands registered in
 * `src-tauri/src/updater.rs` (see plan: smooth-pondering-mccarthy.md).
 */
import { Channel, invoke } from "@tauri-apps/api/core";

/** Result of `check_for_update`. */
export type UpdateInfo = {
  available: boolean;
  /** Version of the currently running shell (Tauri `app.getVersion()`). */
  currentVersion: string;
  /** Version proposed by `latest.json`, or `null` when nothing is available. */
  newVersion: string | null;
  /** Release notes (markdown) from `latest.json.notes`, or `null`. */
  body: string | null;
};

/** Single backup entry returned by `list_backups`. */
export type BackupInfo = {
  /** Semver of the backed-up build (e.g. "0.1.3"). */
  version: string;
  /** ISO-8601 timestamp when the backup was created. */
  installedAt: string;
  /** Approximate size in megabytes (rounded). */
  sizeMb: number;
  /** Absolute path to the backup directory on disk. */
  path: string;
};

/**
 * Streamed events from `install_update_with_backup`. The Rust side emits a
 * sequence: `started` -> N x `progress` -> `verifying` -> `installing` -> `done`.
 * UI should render a progress bar + status label.
 */
export type UpdateProgressEvent =
  | { event: "started"; data: { contentLength: number | null } }
  | { event: "progress"; data: { downloaded: number; total: number | null } }
  | { event: "verifying" }
  | { event: "installing" }
  | { event: "done" };

export type UpdateProgressHandler = (event: UpdateProgressEvent) => void;

/**
 * Check whether a newer version is published in `latest.json`.
 * Wraps `app.updater()?.check()` on the Rust side.
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  return invoke<UpdateInfo>("check_for_update");
}

/**
 * Download + verify signature + back up current install + install + restart.
 *
 * Progress is streamed via a Tauri `Channel`. The promise resolves when the
 * Rust side emits the `done` event; restart is initiated by Rust right after.
 */
export async function installUpdate(
  onProgress?: UpdateProgressHandler,
): Promise<void> {
  const channel = new Channel<UpdateProgressEvent>();
  if (onProgress) {
    channel.onmessage = onProgress;
  }
  await invoke<void>("install_update_with_backup", { onEvent: channel });
}

/**
 * Reinstall the most recent backup MSI silently and restart the app.
 * No-op (rejects) on the Rust side when no backup exists.
 */
export async function rollbackToBackup(): Promise<void> {
  await invoke<void>("rollback");
}

/** Enumerate available backups, newest first. */
export async function listBackups(): Promise<BackupInfo[]> {
  return invoke<BackupInfo[]>("list_backups");
}

/** Convenience namespace mirroring the style of other api modules. */
export const updaterApi = {
  checkForUpdate,
  installUpdate,
  rollbackToBackup,
  listBackups,
};
