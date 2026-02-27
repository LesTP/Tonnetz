/**
 * Tests for persistence-wiring.ts — Phase 5a/5b.
 *
 * Phase 5a: Storage initialization, startup settings, URL hash detection
 * Phase 5b: Save/Load/Share actions
 *
 * Strategy:
 * - Uses real PD functions (happy-dom provides localStorage)
 * - Clears localStorage before each test for isolation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  initPersistence,
  checkUrlHash,
  saveCurrentProgression,
  loadSavedProgression,
  listSavedProgressions,
  deleteSavedProgression,
  generateShareUrl,
  updateSettings,
  DEFAULT_SETTINGS,
} from "../persistence-wiring.js";
import type { AppPersistenceState } from "../persistence-wiring.js";
import { encodeShareUrl } from "persistence-data";
import type { GridValue } from "persistence-data";

// ── Setup ───────────────────────────────────────────────────────────

let persistenceState: AppPersistenceState;

beforeEach(() => {
  localStorage.clear();
  persistenceState = initPersistence();
});

// ═══════════════════════════════════════════════════════════════════
// Phase 5a: Storage Initialization
// ═══════════════════════════════════════════════════════════════════

describe("initPersistence", () => {
  it("creates a StorageBackend and loads default settings", () => {
    const state = initPersistence();
    expect(state.backend).toBeDefined();
    expect(state.settings).toEqual(DEFAULT_SETTINGS);
    expect(state.settings.tempo_bpm).toBe(150);
  });

  it("loads previously saved settings", () => {
    // Save custom tempo first
    localStorage.setItem(
      "tonnetz:settings",
      JSON.stringify({ tempo_bpm: 140 }),
    );

    const state = initPersistence();
    expect(state.settings.tempo_bpm).toBe(140);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 5a: URL Hash Detection
// ═══════════════════════════════════════════════════════════════════

describe("checkUrlHash", () => {
  it("detects valid shared progression URL", () => {
    const encoded = encodeShareUrl({
      chords: ["Dm7", "G7", "Cmaj7"],
      tempo_bpm: 120,
      grid: "1/4" as GridValue,
    });
    const hash = `#p=${encoded}`;

    const result = checkUrlHash(hash);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.payload.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
      expect(result.payload.tempo_bpm).toBe(120);
    }
  });

  it("returns found:false for empty hash", () => {
    expect(checkUrlHash("").found).toBe(false);
  });

  it("returns found:false for hash without #p= prefix", () => {
    expect(checkUrlHash("#other=value").found).toBe(false);
  });

  it("returns found:false for #p= with no content", () => {
    expect(checkUrlHash("#p=").found).toBe(false);
  });

  it("returns found:false for malformed payload", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = checkUrlHash("#p=not-valid-at-all");
    expect(result.found).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles sharp-encoded chord symbols (F#m → Fsm in URL)", () => {
    const encoded = encodeShareUrl({
      chords: ["F#m", "B7", "E"],
      tempo_bpm: 100,
      grid: "1/4" as GridValue,
    });
    const hash = `#p=${encoded}`;

    const result = checkUrlHash(hash);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.payload.chords).toEqual(["F#m", "B7", "E"]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 5b: Save/Load/Share Actions
// ═══════════════════════════════════════════════════════════════════

describe("saveCurrentProgression", () => {
  it("saves a progression and returns a record with ID", () => {
    const record = saveCurrentProgression(persistenceState, {
      title: "ii-V-I",
      chords: ["Dm7", "G7", "Cmaj7"],
      tempo_bpm: 120,
      grid: "1/4",
    });

    expect(record.id).toBeTruthy();
    expect(record.title).toBe("ii-V-I");
    expect(record.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
    expect(record.tempo_bpm).toBe(120);
    expect(record.grid).toBe("1/4");
    expect(record.created_at).toBeTruthy();
    expect(record.updated_at).toBeTruthy();
  });
});

describe("loadSavedProgression", () => {
  it("loads a previously saved progression by ID", () => {
    const saved = saveCurrentProgression(persistenceState, {
      title: "Blues",
      chords: ["A7", "D7", "E7"],
      tempo_bpm: 100,
      grid: "1/4",
    });

    const loaded = loadSavedProgression(persistenceState, saved.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Blues");
    expect(loaded!.chords).toEqual(["A7", "D7", "E7"]);
  });

  it("returns null for nonexistent ID", () => {
    const result = loadSavedProgression(persistenceState, "nonexistent-id");
    expect(result).toBeNull();
  });
});

describe("listSavedProgressions", () => {
  it("lists all saved progressions", () => {
    saveCurrentProgression(persistenceState, {
      title: "Prog A",
      chords: ["C", "G"],
      tempo_bpm: 120,
      grid: "1/4",
    });
    saveCurrentProgression(persistenceState, {
      title: "Prog B",
      chords: ["Am", "Em"],
      tempo_bpm: 100,
      grid: "1/8",
    });

    const list = listSavedProgressions(persistenceState);
    expect(list).toHaveLength(2);
    const titles = list.map((r) => r.title);
    expect(titles).toContain("Prog A");
    expect(titles).toContain("Prog B");
  });

  it("returns empty array when no progressions saved", () => {
    expect(listSavedProgressions(persistenceState)).toEqual([]);
  });
});

describe("deleteSavedProgression", () => {
  it("removes a progression by ID", () => {
    const saved = saveCurrentProgression(persistenceState, {
      title: "To Delete",
      chords: ["C"],
      tempo_bpm: 120,
      grid: "1/4",
    });

    deleteSavedProgression(persistenceState, saved.id);
    expect(loadSavedProgression(persistenceState, saved.id)).toBeNull();
  });

  it("no-op for nonexistent ID", () => {
    expect(() =>
      deleteSavedProgression(persistenceState, "nope"),
    ).not.toThrow();
  });
});

describe("generateShareUrl", () => {
  it("produces a hash string with #p= prefix", () => {
    const hash = generateShareUrl({
      chords: ["Dm7", "G7", "Cmaj7"],
      tempo_bpm: 120,
      grid: "1/4",
    });

    expect(hash).toMatch(/^#p=.+/);
  });

  it("round-trips with checkUrlHash", () => {
    const hash = generateShareUrl({
      chords: ["Dm7", "G7", "Cmaj7"],
      tempo_bpm: 120,
      grid: "1/4",
    });

    const result = checkUrlHash(hash);
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.payload.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
      expect(result.payload.tempo_bpm).toBe(120);
    }
  });

  it("round-trips with sharp chords", () => {
    const hash = generateShareUrl({
      chords: ["F#m7", "B7", "Emaj7"],
      tempo_bpm: 140,
    });
    const result = checkUrlHash(`#p=${hash.slice(hash.indexOf("#p=") + 3)}`);
    if (result.found) {
      expect(result.payload.chords).toEqual(["F#m7", "B7", "Emaj7"]);
      expect(result.payload.tempo_bpm).toBe(140);
    }
  });
});

describe("updateSettings", () => {
  it("saves partial settings and updates in-memory state", () => {
    expect(persistenceState.settings.tempo_bpm).toBe(150);

    const merged = updateSettings(persistenceState, { tempo_bpm: 140 });

    expect(merged.tempo_bpm).toBe(140);
    expect(persistenceState.settings.tempo_bpm).toBe(140);
  });

  it("persists settings across re-initialization", () => {
    updateSettings(persistenceState, { tempo_bpm: 90 });

    // Re-init (simulates page reload)
    const freshState = initPersistence();
    expect(freshState.settings.tempo_bpm).toBe(90);
  });
});
