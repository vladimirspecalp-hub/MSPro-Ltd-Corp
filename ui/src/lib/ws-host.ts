// Tauri webview serves UI from `tauri.localhost`, where WebSocket connections
// to the same host fail (ERR_CONNECTION_REFUSED). When running inside Tauri
// we must connect directly to the local Paperclip server on 127.0.0.1:3100.
// In a regular browser we keep using window.location.host so the dev/preview
// server proxy or the production deployment continues to work.
//
// Detection follows Tauri v2 API: `window.__TAURI_INTERNALS__` (always present
// in v2 webviews) with a fallback to legacy `window.__TAURI__` for safety.

const TAURI_FALLBACK_HOST = "127.0.0.1:3100";

export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

export function getApiWsBase(): string {
  if (isTauriEnvironment()) {
    return `ws://${TAURI_FALLBACK_HOST}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}`;
}
