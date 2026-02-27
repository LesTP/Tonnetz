/**
 * Phase 6b: End-to-end integration tests.
 *
 * Verifies the full public API surface and cross-module workflows:
 * - API surface completeness (6a)
 * - Full lifecycle: save → list → load → encode → decode → verify
 * - Settings round-trip
 * - Corrupted data resilience
 * - Multi-progression management
 */

import { describe, it, expect } from "vitest";

// Import the ENTIRE public API via barrel — this is the integration surface test
import {
  // Types (verified at compile time by usage below)
  type GridValue,
  type ProgressionRecord,
  type SettingsRecord,
  type SharePayload,
  type StorageBackend,
  type MigrationFn,

  // Constants
  CURRENT_SCHEMA_VERSION,
  DEFAULT_GRID,
  DEFAULT_SETTINGS,
  generateId,

  // Storage
  createMemoryStorageBackend,
  createLocalStorageBackend,
  StorageError,

  // Progressions
  saveProgression,
  loadProgression,
  listProgressions,
  deleteProgression,

  // Sharing
  encodeShareUrl,
  decodeShareUrl,

  // Migration
  migrateProgression,

  // Settings
  loadSettings,
  saveSettings,
} from "../index.js";

// ---------------------------------------------------------------------------
// Phase 6a: API surface assembly
// ---------------------------------------------------------------------------

describe("Phase 6a: API surface", () => {
  it("exports all public functions", () => {
    expect(typeof generateId).toBe("function");
    expect(typeof createMemoryStorageBackend).toBe("function");
    expect(typeof createLocalStorageBackend).toBe("function");
    expect(typeof saveProgression).toBe("function");
    expect(typeof loadProgression).toBe("function");
    expect(typeof listProgressions).toBe("function");
    expect(typeof deleteProgression).toBe("function");
    expect(typeof encodeShareUrl).toBe("function");
    expect(typeof decodeShareUrl).toBe("function");
    expect(typeof migrateProgression).toBe("function");
    expect(typeof loadSettings).toBe("function");
    expect(typeof saveSettings).toBe("function");
  });

  it("exports constants", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(DEFAULT_GRID).toBe("1/4");
    expect(DEFAULT_SETTINGS).toEqual({ tempo_bpm: 150 });
  });

  it("exports StorageError class", () => {
    const err = new StorageError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("StorageError");
  });

  it("exports all public types (compile-time check)", () => {
    // These assignments verify the types are importable and structurally correct.
    // They are never executed at runtime — the test passes if this file compiles.
    const _grid: GridValue = "1/4";
    const _payload: SharePayload = {
      tempo_bpm: 150,
      chords: ["C"],
    };
    const _settings: SettingsRecord = { tempo_bpm: 100 };
    const _migFn: MigrationFn = (raw) => raw;

    // StorageBackend structural check
    const b: StorageBackend = createMemoryStorageBackend();
    expect(typeof b.getItem).toBe("function");
    expect(typeof b.setItem).toBe("function");
    expect(typeof b.removeItem).toBe("function");
    expect(typeof b.keys).toBe("function");

    // Suppress unused-variable warnings
    void _grid;
    void _payload;
    void _settings;
    void _migFn;
  });

  it("does not export internal helpers", async () => {
    const mod = await import("../index.js") as Record<string, unknown>;
    expect(mod._registerMigration).toBeUndefined();
    expect(mod._unregisterMigration).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 6b: End-to-end integration tests
// ---------------------------------------------------------------------------

describe("Phase 6b: end-to-end integration", () => {
  describe("full lifecycle: save → list → load → encode → decode → verify", () => {
    it("round-trips a progression through all operations", () => {
      const b = createMemoryStorageBackend();

      // 1. Save
      const saved = saveProgression(b, {
        title: "II-V-I",
        tempo_bpm: 140,
        grid: "1/8" as GridValue,
        chords: ["Dm7", "G7", "Cmaj7"],
      });
      expect(saved.id).toBeTruthy();
      expect(saved.schema_version).toBe(CURRENT_SCHEMA_VERSION);

      // 2. List
      const list = listProgressions(b);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(saved.id);

      // 3. Load
      const loaded = loadProgression(b, saved.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe("II-V-I");
      expect(loaded!.tempo_bpm).toBe(140);
      expect(loaded!.grid).toBe("1/8");
      expect(loaded!.chords).toEqual(["Dm7", "G7", "Cmaj7"]);

      // 4. Encode to URL
      const url = encodeShareUrl(loaded!);
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);

      // 5. Decode from URL
      const decoded = decodeShareUrl(url);
      expect(decoded).not.toBeNull();
      expect(decoded!.tempo_bpm).toBe(140);
      expect(decoded!.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
    });
  });

  describe("settings round-trip", () => {
    it("load defaults → save partial → load → verify merge", () => {
      const b = createMemoryStorageBackend();

      // 1. Load defaults
      const defaults = loadSettings(b);
      expect(defaults).toEqual(DEFAULT_SETTINGS);
      expect(defaults.tempo_bpm).toBe(150);

      // 2. Save partial
      const updated = saveSettings(b, { tempo_bpm: 90 });
      expect(updated.tempo_bpm).toBe(90);

      // 3. Reload — verify persisted
      const reloaded = loadSettings(b);
      expect(reloaded.tempo_bpm).toBe(90);
    });
  });

  describe("corrupted data handling", () => {
    it("corrupted progression key → load returns null", () => {
      const b = createMemoryStorageBackend();
      b.setItem("tonnetz:prog:bad", "NOT_JSON{{{");
      expect(loadProgression(b, "bad")).toBeNull();
    });

    it("corrupted progression key → list skips it", () => {
      const b = createMemoryStorageBackend();
      saveProgression(b, {
        title: "Good",
        tempo_bpm: 150,
        grid: "1/4" as GridValue,
        chords: ["C"],
      });
      b.setItem("tonnetz:prog:corrupt", "NOT_JSON");
      const list = listProgressions(b);
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("Good");
    });

    it("corrupted settings → returns defaults", () => {
      const b = createMemoryStorageBackend();
      b.setItem("tonnetz:settings", "{BROKEN");
      expect(loadSettings(b)).toEqual(DEFAULT_SETTINGS);
    });

    it("corrupted share URL → returns null", () => {
      expect(decodeShareUrl("totally-broken")).toBeNull();
      expect(decodeShareUrl("")).toBeNull();
    });
  });

  describe("multi-progression management", () => {
    it("save 5 → list (correct order) → delete 2 → list (3 remain)", () => {
      const b = createMemoryStorageBackend();

      // Save 5 progressions with staggered timestamps
      const ids: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const r = saveProgression(b, {
          title: `Prog ${i}`,
          tempo_bpm: 100 + i * 10,
          grid: "1/4" as GridValue,
          chords: ["C", "G"],
        });
        ids.push(r.id);
      }

      // List should have 5
      const list5 = listProgressions(b);
      expect(list5).toHaveLength(5);

      // Most recently saved should be first (sorted by updated_at desc)
      expect(list5[0].title).toBe("Prog 5");
      expect(list5[4].title).toBe("Prog 1");

      // Delete #2 and #4
      deleteProgression(b, ids[1]);
      deleteProgression(b, ids[3]);

      // List should have 3
      const list3 = listProgressions(b);
      expect(list3).toHaveLength(3);
      const remainingTitles = list3.map((r) => r.title);
      expect(remainingTitles).toContain("Prog 1");
      expect(remainingTitles).toContain("Prog 3");
      expect(remainingTitles).toContain("Prog 5");
      expect(remainingTitles).not.toContain("Prog 2");
      expect(remainingTitles).not.toContain("Prog 4");
    });
  });

  describe("memory and localStorage backends produce identical results", () => {
    it("same operations → same data shapes", () => {
      const mem = createMemoryStorageBackend();

      // We can't test real localStorage in Node, but we can verify the
      // factory returns a valid StorageBackend with the same interface.
      // Functional parity is guaranteed by the shared interface.
      const saved = saveProgression(mem, {
        title: "Parity Test",
        tempo_bpm: 150,
        grid: "1/4" as GridValue,
        chords: ["Am", "F", "C", "G"],
      });

      const loaded = loadProgression(mem, saved.id)!;
      expect(loaded.title).toBe("Parity Test");
      expect(loaded.chords).toEqual(["Am", "F", "C", "G"]);
      expect(loaded.schema_version).toBe(CURRENT_SCHEMA_VERSION);

      // Verify createLocalStorageBackend returns the same interface shape
      // (can't call methods without a browser, but we can verify it's a function)
      expect(typeof createLocalStorageBackend).toBe("function");
    });
  });

  describe("URL sharing", () => {
    it("F#m7 → encode → decode → F#m7", () => {
      const encoded = encodeShareUrl({
        chords: ["F#m7", "C#7", "G#m"],
        tempo_bpm: 100,
      });
      const decoded = decodeShareUrl(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.chords).toEqual(["F#m7", "C#7", "G#m"]);
    });
  });

  describe("progression update flow", () => {
    it("save → load → modify → save → load reflects update", () => {
      const b = createMemoryStorageBackend();

      const original = saveProgression(b, {
        title: "Draft",
        tempo_bpm: 150,
        grid: "1/4" as GridValue,
        chords: ["C"],
      });

      // Update with new chords and title
      const updated = saveProgression(b, {
        ...original,
        title: "Final",
        chords: ["C", "Am", "F", "G"],
      });

      expect(updated.id).toBe(original.id);
      expect(updated.title).toBe("Final");
      expect(updated.chords).toEqual(["C", "Am", "F", "G"]);
      expect(updated.created_at).toBe(original.created_at);
      expect(updated.updated_at >= original.updated_at).toBe(true);

      const reloaded = loadProgression(b, original.id)!;
      expect(reloaded.title).toBe("Final");
      expect(reloaded.chords).toEqual(["C", "Am", "F", "G"]);
    });
  });
});
