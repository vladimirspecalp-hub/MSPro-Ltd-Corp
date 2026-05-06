// @vitest-environment jsdom
//
// Smoke tests for InstanceGeneralSettings — verifies the UpdatesSection
// (кнопка «Проверить обновления») renders correctly in a Tauri context.
// MSP-257 P-2026-021 F5.

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Hoisted mocks (must be declared before module imports)
// ──────────────────────────────────────────────────────────────────────────────

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve(undefined)),
  Channel: class {
    onmessage: ((e: unknown) => void) | null = null;
  },
}));

vi.mock("@/lib/ws-host", () => ({
  isTauriEnvironment: () => true,
  getWebSocketHost: () => "localhost:3100",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "ru", changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../context/ToastContext", () => ({
  useToastActions: () => ({ pushToast: vi.fn() }),
}));

vi.mock("../api/instanceSettings", () => ({
  instanceSettingsApi: {
    getGeneral: vi.fn(() =>
      Promise.resolve({
        censorUsernameInLogs: false,
        keyboardShortcuts: true,
        feedbackDataSharingPreference: "not_allowed",
        backupRetention: null,
      }),
    ),
    updateGeneral: vi.fn(),
  },
}));

vi.mock("../api/auth", () => ({
  authApi: { signOut: vi.fn() },
}));

vi.mock("@/api/updater", () => ({
  updaterApi: {
    checkForUpdate: vi.fn(() =>
      Promise.resolve({
        available: false,
        currentVersion: "0.2.0",
        newVersion: null,
        body: null,
      }),
    ),
    installUpdate: vi.fn(),
    rollbackToBackup: vi.fn(),
    listBackups: vi.fn(() => Promise.resolve([])),
  },
}));

// ──────────────────────────────────────────────────────────────────────────────
// Import component under test (after mocks)
// ──────────────────────────────────────────────────────────────────────────────

import { InstanceGeneralSettings } from "./InstanceGeneralSettings";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("InstanceGeneralSettings — UpdatesSection (MSP-257 F5 smoke)", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  it("renders the UpdatesSection (Об обновлениях) in Tauri environment", async () => {
    const client = makeClient();
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <InstanceGeneralSettings />
        </QueryClientProvider>,
      );
    });
    // Flush multiple ticks so React Query can settle after async mocks
    await flush();
    await flush();
    await flush();

    const text = container.textContent ?? "";
    // Section heading is always rendered
    expect(text).toContain("instance.updates_title");
    // Button is rendered: either idle ("updates_check_button") or fetching ("updates_checking")
    const buttonRendered =
      text.includes("instance.updates_check_button") ||
      text.includes("instance.updates_checking");
    expect(buttonRendered).toBe(true);
  });

  it("does not crash when checkForUpdate rejects (updater not configured)", async () => {
    const { updaterApi } = await import("@/api/updater");
    vi.mocked(updaterApi.checkForUpdate).mockRejectedValueOnce(
      new Error("updater check failed: HTTP 404"),
    );

    const client = makeClient();
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <InstanceGeneralSettings />
        </QueryClientProvider>,
      );
    });
    // Multiple flushes so the rejection propagates through React Query
    await flush();
    await flush();
    await flush();

    const text = container.textContent ?? "";
    // Section still renders after error
    expect(text).toContain("instance.updates_title");
    // Should show the user-friendly i18n error key, not the raw Rust message
    expect(text).toContain("instance.updates_check_failed");
    expect(text).not.toContain("HTTP 404");
  });
});
