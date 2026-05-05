import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.hoisted(() => vi.fn());
const channelInstances = vi.hoisted(
  () => [] as Array<{ onmessage: ((e: unknown) => void) | null }>,
);

const ChannelMock = vi.hoisted(() => {
  return class {
    onmessage: ((e: unknown) => void) | null = null;
    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channelInstances as any).push(this);
    }
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
  Channel: ChannelMock,
}));

import {
  checkForUpdate,
  installUpdate,
  listBackups,
  rollbackToBackup,
  type UpdateProgressEvent,
} from "./updater";

describe("updater api wrapper", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    channelInstances.length = 0;
  });

  it("checkForUpdate invokes 'check_for_update' and returns the payload", async () => {
    const payload = {
      available: true,
      currentVersion: "0.1.4",
      newVersion: "0.1.5",
      body: "## What's new\n- fix",
    };
    mockInvoke.mockResolvedValueOnce(payload);

    const result = await checkForUpdate();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("check_for_update");
    expect(result).toEqual(payload);
  });

  it("installUpdate invokes 'install_update_with_backup' with a Channel and routes events to handler", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const received: UpdateProgressEvent[] = [];

    await installUpdate((event) => received.push(event));

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockInvoke.mock.calls[0];
    expect(cmd).toBe("install_update_with_backup");
    expect(args).toBeDefined();
    expect(args).toHaveProperty("onEvent");

    // Simulate Rust streaming events through the channel.
    expect(channelInstances).toHaveLength(1);
    const channel = channelInstances[0];
    channel.onmessage?.({
      event: "progress",
      data: { downloaded: 50, total: 100 },
    });
    channel.onmessage?.({ event: "done" });

    expect(received).toEqual([
      { event: "progress", data: { downloaded: 50, total: 100 } },
      { event: "done" },
    ]);
  });

  it("installUpdate works without a progress handler", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await expect(installUpdate()).resolves.toBeUndefined();

    expect(mockInvoke).toHaveBeenCalledWith(
      "install_update_with_backup",
      expect.objectContaining({ onEvent: expect.anything() }),
    );
  });

  it("rollbackToBackup invokes 'rollback'", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await rollbackToBackup();

    expect(mockInvoke).toHaveBeenCalledWith("rollback");
  });

  it("listBackups invokes 'list_backups' and returns the array as-is", async () => {
    const backups = [
      {
        version: "0.1.3",
        installedAt: "2026-05-04T19:42:00.000Z",
        sizeMb: 87,
        path: "C:/Users/u/AppData/Local/MSPro-Ltd Corp/backups/v0.1.3",
      },
    ];
    mockInvoke.mockResolvedValueOnce(backups);

    const result = await listBackups();

    expect(mockInvoke).toHaveBeenCalledWith("list_backups");
    expect(result).toEqual(backups);
  });
});
