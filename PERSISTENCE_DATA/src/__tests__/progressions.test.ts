import { describe, it, expect } from "vitest";
import { createMemoryStorageBackend } from "../storage.js";
import {
  saveProgression,
  loadProgression,
  listProgressions,
  deleteProgression,
} from "../progressions.js";
import { CURRENT_SCHEMA_VERSION } from "../types.js";
import type { GridValue, ProgressionRecord } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid progression input (no id, no timestamps). */
function minimalInput() {
  return {
    title: "ii-V-I",
    tempo_bpm: 120,
    grid: "1/4" as GridValue,
    chords: ["Dm7", "G7", "Cmaj7"],
  };
}

/**
 * Build a full ProgressionRecord with explicit id and timestamps
 * so list ordering is deterministic.
 */
function fullRecord(overrides: Partial<ProgressionRecord>): ProgressionRecord {
  return {
    id: "default-id",
    schema_version: CURRENT_SCHEMA_VERSION,
    title: "Test",
    tempo_bpm: 120,
    grid: "1/4" as GridValue,
    chords: ["C"],
    notes: "",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// saveProgression / loadProgression (Phase 2a)
// ---------------------------------------------------------------------------

describe("saveProgression", () => {
  it("save then load returns identical record", () => {
    const b = createMemoryStorageBackend();
    const saved = saveProgression(b, minimalInput());
    const loaded = loadProgression(b, saved.id);
    expect(loaded).toEqual(saved);
  });

  it("generates UUID if id is missing", () => {
    const b = createMemoryStorageBackend();
    const saved = saveProgression(b, minimalInput());
    expect(saved.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("sets created_at on new records", () => {
    const b = createMemoryStorageBackend();
    const before = new Date().toISOString();
    const saved = saveProgression(b, minimalInput());
    const after = new Date().toISOString();
    expect(saved.created_at).toBeTruthy();
    expect(saved.created_at >= before).toBe(true);
    expect(saved.created_at <= after).toBe(true);
  });

  it("updates updated_at on existing records", () => {
    const b = createMemoryStorageBackend();
    const saved = saveProgression(b, minimalInput());

    const updated = saveProgression(b, {
      ...saved,
      title: "ii-V-I (updated)",
    });

    expect(updated.id).toBe(saved.id);
    expect(updated.created_at).toBe(saved.created_at);
    expect(updated.updated_at >= saved.updated_at).toBe(true);
    expect(updated.title).toBe("ii-V-I (updated)");
  });

  it("includes schema_version in stored JSON", () => {
    const b = createMemoryStorageBackend();
    const saved = saveProgression(b, minimalInput());
    expect(saved.schema_version).toBe(CURRENT_SCHEMA_VERSION);

    // Also verify it's in the raw stored JSON
    const raw = b.getItem(`tonnetz:prog:${saved.id}`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.schema_version).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe("loadProgression", () => {
  it("returns null for non-existent id", () => {
    const b = createMemoryStorageBackend();
    expect(loadProgression(b, "nonexistent-id")).toBeNull();
  });

  it("returns null for corrupted JSON (not throw)", () => {
    const b = createMemoryStorageBackend();
    b.setItem("tonnetz:prog:bad-id", "this is not {json}");
    expect(loadProgression(b, "bad-id")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listProgressions (Phase 2b)
// ---------------------------------------------------------------------------

describe("listProgressions", () => {
  it("returns empty array on empty storage", () => {
    const b = createMemoryStorageBackend();
    expect(listProgressions(b)).toEqual([]);
  });

  it("returns all records sorted by updated_at descending", () => {
    const b = createMemoryStorageBackend();

    const oldest = fullRecord({
      id: "id-1",
      title: "Oldest",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const middle = fullRecord({
      id: "id-2",
      title: "Middle",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    const newest = fullRecord({
      id: "id-3",
      title: "Newest",
      updated_at: "2026-01-03T00:00:00.000Z",
    });

    // Insert out of order
    b.setItem("tonnetz:prog:id-2", JSON.stringify(middle));
    b.setItem("tonnetz:prog:id-3", JSON.stringify(newest));
    b.setItem("tonnetz:prog:id-1", JSON.stringify(oldest));

    const list = listProgressions(b);
    expect(list).toHaveLength(3);
    expect(list[0].title).toBe("Newest");
    expect(list[1].title).toBe("Middle");
    expect(list[2].title).toBe("Oldest");
  });

  it("skips corrupted records without crashing", () => {
    const b = createMemoryStorageBackend();
    b.setItem(
      "tonnetz:prog:good",
      JSON.stringify(fullRecord({ id: "good", title: "Good" })),
    );
    b.setItem("tonnetz:prog:bad", "not-json{{{");

    const list = listProgressions(b);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("good");
  });

  it("ignores non-progression keys", () => {
    const b = createMemoryStorageBackend();
    b.setItem(
      "tonnetz:prog:real",
      JSON.stringify(fullRecord({ id: "real" })),
    );
    b.setItem("tonnetz:settings", '{"tempo_bpm":140}');
    b.setItem("other-app-key", "data");

    const list = listProgressions(b);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("real");
  });
});

// ---------------------------------------------------------------------------
// deleteProgression (Phase 2b)
// ---------------------------------------------------------------------------

describe("deleteProgression", () => {
  it("removes the record", () => {
    const b = createMemoryStorageBackend();
    const saved = saveProgression(b, minimalInput());
    expect(loadProgression(b, saved.id)).not.toBeNull();

    deleteProgression(b, saved.id);
    expect(loadProgression(b, saved.id)).toBeNull();
  });

  it("is a no-op for non-existent id", () => {
    const b = createMemoryStorageBackend();
    expect(() => deleteProgression(b, "no-such-id")).not.toThrow();
  });

  it("list after delete omits deleted record", () => {
    const b = createMemoryStorageBackend();
    const a = saveProgression(b, { ...minimalInput(), title: "A" });
    saveProgression(b, { ...minimalInput(), title: "B" });

    deleteProgression(b, a.id);

    const list = listProgressions(b);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// Phase 2 completion: full CRUD round-trip
// ---------------------------------------------------------------------------

describe("Phase 2 completion", () => {
  it("full CRUD round-trip: save → list → load → update → list → delete → list", () => {
    const b = createMemoryStorageBackend();

    // 1. Save two progressions
    const p1 = saveProgression(b, {
      ...minimalInput(),
      title: "Blues in F",
    });
    const p2 = saveProgression(b, {
      ...minimalInput(),
      title: "Autumn Leaves",
      chords: ["Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm"],
    });

    // 2. List — both present
    let list = listProgressions(b);
    expect(list).toHaveLength(2);
    const ids = list.map((r) => r.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);

    // 3. Load — verify data integrity
    const loaded = loadProgression(b, p1.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Blues in F");
    expect(loaded!.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
    expect(loaded!.schema_version).toBe(CURRENT_SCHEMA_VERSION);

    // 4. Update — change title, verify timestamps
    const updated = saveProgression(b, {
      ...loaded!,
      title: "Blues in F (revised)",
    });
    expect(updated.id).toBe(p1.id);
    expect(updated.title).toBe("Blues in F (revised)");
    expect(updated.created_at).toBe(loaded!.created_at);
    expect(updated.updated_at >= loaded!.updated_at).toBe(true);

    // 5. List after update — still two, updated data visible
    list = listProgressions(b);
    expect(list).toHaveLength(2);
    const revisedInList = list.find((r) => r.id === p1.id);
    expect(revisedInList).toBeDefined();
    expect(revisedInList!.title).toBe("Blues in F (revised)");

    // 6. Delete one
    deleteProgression(b, p1.id);

    // 7. List after delete — only one remains
    list = listProgressions(b);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(p2.id);
    expect(list[0].title).toBe("Autumn Leaves");

    // 8. Load deleted — returns null
    expect(loadProgression(b, p1.id)).toBeNull();
  });

  it("corrupted records are skipped in list (not crash)", () => {
    const b = createMemoryStorageBackend();

    const valid = saveProgression(b, minimalInput());

    // Manually inject corrupted records at progression keys
    b.setItem("tonnetz:prog:corrupt-1", "{bad json");
    b.setItem("tonnetz:prog:corrupt-2", "");

    const list = listProgressions(b);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(valid.id);
  });

  it("all operations work with memory backend (no localStorage required)", () => {
    const b = createMemoryStorageBackend();

    const saved = saveProgression(b, minimalInput());
    expect(saved.id).toBeTruthy();

    const loaded = loadProgression(b, saved.id);
    expect(loaded).toEqual(saved);

    const list = listProgressions(b);
    expect(list).toHaveLength(1);

    deleteProgression(b, saved.id);
    expect(listProgressions(b)).toEqual([]);
    expect(loadProgression(b, saved.id)).toBeNull();
  });

  it("multiple progressions: save 5 → list → delete 2 → list (3 remain)", () => {
    const b = createMemoryStorageBackend();

    const records: ProgressionRecord[] = [];
    for (let i = 0; i < 5; i++) {
      records.push(
        saveProgression(b, { ...minimalInput(), title: `Prog ${i}` }),
      );
    }

    // All 5 present
    let list = listProgressions(b);
    expect(list).toHaveLength(5);

    // Delete first and third
    deleteProgression(b, records[0].id);
    deleteProgression(b, records[2].id);

    // 3 remain, deleted ones absent
    list = listProgressions(b);
    expect(list).toHaveLength(3);
    const remainingIds = list.map((r) => r.id);
    expect(remainingIds).not.toContain(records[0].id);
    expect(remainingIds).not.toContain(records[2].id);
    expect(remainingIds).toContain(records[1].id);
    expect(remainingIds).toContain(records[3].id);
    expect(remainingIds).toContain(records[4].id);
  });
});
