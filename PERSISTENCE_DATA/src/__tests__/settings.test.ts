import { describe, it, expect } from "vitest";
import { createMemoryStorageBackend } from "../storage.js";
import { loadSettings, saveSettings } from "../settings.js";
import { DEFAULT_SETTINGS } from "../types.js";

// ---------------------------------------------------------------------------
// Phase 4a: loadSettings / saveSettings
// ---------------------------------------------------------------------------

describe("loadSettings", () => {
  it("returns defaults on empty storage", () => {
    const b = createMemoryStorageBackend();
    const settings = loadSettings(b);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.tempo_bpm).toBe(150);
  });

  it("corrupted settings JSON returns defaults (not throw)", () => {
    const b = createMemoryStorageBackend();
    b.setItem("tonnetz:settings", "not valid json{{{");
    const settings = loadSettings(b);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("saveSettings", () => {
  it("save then load round-trips", () => {
    const b = createMemoryStorageBackend();
    saveSettings(b, { tempo_bpm: 140 });
    const loaded = loadSettings(b);
    expect(loaded.tempo_bpm).toBe(140);
  });

  it("partial update merges (does not overwrite unrelated fields)", () => {
    const b = createMemoryStorageBackend();
    // First save sets tempo
    saveSettings(b, { tempo_bpm: 100 });

    // Second save with empty partial — tempo preserved
    saveSettings(b, {});
    const loaded = loadSettings(b);
    expect(loaded.tempo_bpm).toBe(100);
  });

  it("multiple partial saves accumulate correctly", () => {
    const b = createMemoryStorageBackend();

    // Start from defaults (tempo_bpm: 150)
    expect(loadSettings(b).tempo_bpm).toBe(150);

    // Update tempo
    saveSettings(b, { tempo_bpm: 90 });
    expect(loadSettings(b).tempo_bpm).toBe(90);

    // Update again
    saveSettings(b, { tempo_bpm: 200 });
    expect(loadSettings(b).tempo_bpm).toBe(200);

    // Empty partial preserves last value
    saveSettings(b, {});
    expect(loadSettings(b).tempo_bpm).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 completion tests
// ---------------------------------------------------------------------------

describe("Phase 4 completion", () => {
  it("settings survive across save/load cycles", () => {
    const b = createMemoryStorageBackend();

    // Cycle 1
    saveSettings(b, { tempo_bpm: 75 });
    expect(loadSettings(b).tempo_bpm).toBe(75);

    // Cycle 2 — different partial
    saveSettings(b, { tempo_bpm: 160 });
    expect(loadSettings(b).tempo_bpm).toBe(160);

    // Cycle 3 — no-op save preserves
    saveSettings(b, {});
    expect(loadSettings(b).tempo_bpm).toBe(160);
  });

  it("defaults are well-defined and documented", () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(typeof DEFAULT_SETTINGS.tempo_bpm).toBe("number");
    expect(DEFAULT_SETTINGS.tempo_bpm).toBe(150);

    // Verify loadSettings returns a fresh copy (not reference to DEFAULT_SETTINGS)
    const b = createMemoryStorageBackend();
    const a = loadSettings(b);
    const b2 = loadSettings(b);
    expect(a).toEqual(b2);
    expect(a).not.toBe(b2);
  });
});
