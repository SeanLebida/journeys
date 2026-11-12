import { describe, expect, it, vi } from "vitest";

const openAppStore = vi.fn();
vi.mock("@capawesome/capacitor-app-update", () => ({
  AppUpdate: { openAppStore: () => openAppStore() },
  AppUpdateAvailability: { UPDATE_AVAILABLE: 2 },
}));

import { openStore } from "./storeUpdate";

describe("openStore", () => {
  it("resolves false when the store cannot open", async () => {
    openAppStore.mockRejectedValueOnce(new Error("no Play Store"));
    await expect(openStore()).resolves.toBe(false);
  });
  it("resolves true when the store opens", async () => {
    openAppStore.mockResolvedValueOnce(undefined);
    await expect(openStore()).resolves.toBe(true);
  });
});
