import { describe, it, expect, afterEach } from "vitest";
import {
  migrateProgression,
  _registerMigration,
  _unregisterMigration,
} from "../migration.js";
import { CURRENT_SCHEMA_VERSION } from "../types.js";
import type { GridValue } from "../types.js";
import { createMemoryStorageBackend } from "../storage.js";
import {
  saveProgression,
  loadProgression,
  listProgressions,
} from "../progressions.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal v1 record as it would appear from JSON.parse(). */
function v1Raw(): Record<string, unknown> {
  return {
    id: "test-id",
    schema_version: 1,
    title: "Test",
    tempo_bpm: 120,
    grid: "1/4",
    chords: ["Dm7", "G7", "Cmaj7"],
    notes: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Phase 5a: migrateProgression
// ---------------------------------------------------------------------------

describe("migrateProgression", () => {
  it("v1 record passes through unchanged", () => {
    const raw = v1Raw();
    const result = migrateProgression(raw);
    expect(result).not.toBeNull();
    expect(result!.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(result!.title).toBe("Test");
    expect(result!.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
  });

  it("record with missing schema_version treated as v1", () => {
    const raw = v1Raw();
    delete raw.schema_version;
    const result = migrateProgression(raw);
    expect(result).not.toBeNull();
    expect(result!.schema_version).toBe(1);
  });

  it("record with future version (999) returns null", () => {
    const raw = { ...v1Raw(), schema_version: 999 };
    const result = migrateProgression(raw);
    expect(result).toBeNull();
  });

  describe("migration chain", () => {
    // Register temporary v0→v1 migration to test the chain mechanism.
    // v0 records have "name" instead of "title" — the migration renames the field.
    afterEach(() => {
      _unregisterMigration(0);
    });

    it("applies migration sequentially (v0→v1 when migration exists)", () => {
      _registerMigration(0, (raw) => {
        // v0→v1: rename "name" field to "title"
        const { name, ...rest } = raw as Record<string, unknown> & {
          name?: string;
        };
        return { ...rest, title: name ?? "" };
      });

      const v0Record: Record<string, unknown> = {
        id: "old-id",
        schema_version: 0,
        name: "Old Name",
        tempo_bpm: 100,
        grid: "1/4",
        chords: ["C"],
        notes: "",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      };

      const result = migrateProgression(v0Record);
      expect(result).not.toBeNull();
      expect(result!.schema_version).toBe(CURRENT_SCHEMA_VERSION);
      expect(result!.title).toBe("Old Name");
      expect((result as Record<string, unknown>).name).toBeUndefined();
    });

    it("returns null when a migration step is missing", () => {
      // No v0→v1 migration registered — chain is broken
      const v0Record = { ...v1Raw(), schema_version: 0 };
      const result = migrateProgression(v0Record);
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 5 completion: migration wired into CRUD
// ---------------------------------------------------------------------------

describe("Phase 5 completion", () => {
  afterEach(() => {
    _unregisterMigration(0);
  });

  it("loadProgression applies migration on load", () => {
    const b = createMemoryStorageBackend();

    // Manually store a v0 record (simulates legacy data)
    _registerMigration(0, (raw) => {
      const { name, ...rest } = raw as Record<string, unknown> & {
        name?: string;
      };
      return { ...rest, title: name ?? "" };
    });

    const legacy = JSON.stringify({
      id: "legacy-1",
      schema_version: 0,
      name: "Legacy Prog",
      tempo_bpm: 90,
      grid: "1/4",
      chords: ["Am", "F", "C", "G"],
      notes: "",
      created_at: "2025-06-01T00:00:00.000Z",
      updated_at: "2025-06-01T00:00:00.000Z",
    });
    b.setItem("tonnetz:prog:legacy-1", legacy);

    const loaded = loadProgression(b, "legacy-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded!.title).toBe("Legacy Prog");
  });

  it("migrated records are re-saved at current version", () => {
    const b = createMemoryStorageBackend();

    _registerMigration(0, (raw) => {
      const { name, ...rest } = raw as Record<string, unknown> & {
        name?: string;
      };
      return { ...rest, title: name ?? "" };
    });

    const legacy = JSON.stringify({
      id: "legacy-2",
      schema_version: 0,
      name: "Migrated Prog",
      tempo_bpm: 110,
      grid: "1/8",
      chords: ["Dm7", "G7"],
      notes: "",
      created_at: "2025-06-01T00:00:00.000Z",
      updated_at: "2025-06-01T00:00:00.000Z",
    });
    b.setItem("tonnetz:prog:legacy-2", legacy);

    // First load triggers migration
    const loaded = loadProgression(b, "legacy-2");
    expect(loaded).not.toBeNull();
    expect(loaded!.schema_version).toBe(CURRENT_SCHEMA_VERSION);

    // Verify storage was updated (re-saved at current version)
    const raw = b.getItem("tonnetz:prog:legacy-2");
    const parsed = JSON.parse(raw!);
    expect(parsed.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.title).toBe("Migrated Prog");
    expect(parsed.name).toBeUndefined();
  });

  it("listProgressions includes migrated records", () => {
    const b = createMemoryStorageBackend();

    _registerMigration(0, (raw) => {
      const { name, ...rest } = raw as Record<string, unknown> & {
        name?: string;
      };
      return { ...rest, title: name ?? "" };
    });

    // One current, one legacy
    saveProgression(b, {
      title: "Current",
      tempo_bpm: 120,
      grid: "1/4" as GridValue,
      chords: ["C"],
    });
    b.setItem(
      "tonnetz:prog:old-one",
      JSON.stringify({
        id: "old-one",
        schema_version: 0,
        name: "Old One",
        tempo_bpm: 100,
        grid: "1/4",
        chords: ["Am"],
        notes: "",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      }),
    );

    const list = listProgressions(b);
    expect(list).toHaveLength(2);
    expect(list.every((r) => r.schema_version === CURRENT_SCHEMA_VERSION)).toBe(
      true,
    );
  });

  it("unmigrateable records (future version) are skipped in list", () => {
    const b = createMemoryStorageBackend();

    saveProgression(b, {
      title: "Good",
      tempo_bpm: 120,
      grid: "1/4" as GridValue,
      chords: ["C"],
    });
    b.setItem(
      "tonnetz:prog:future",
      JSON.stringify({ ...v1Raw(), id: "future", schema_version: 999 }),
    );

    const list = listProgressions(b);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Good");
  });
});
