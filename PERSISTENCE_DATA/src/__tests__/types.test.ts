import { describe, it, expect } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_GRID,
  DEFAULT_SETTINGS,
  generateId,
  type GridValue,
  type ProgressionRecord,
  type SettingsRecord,
  type SharePayload,
} from "../types.js";

// UUID v4 pattern: 8-4-4-4-12 hex digits, version nibble = 4, variant bits = 8/9/a/b
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("CURRENT_SCHEMA_VERSION", () => {
  it("is 1", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});

describe("DEFAULT_GRID", () => {
  it('is "1/4"', () => {
    expect(DEFAULT_GRID).toBe("1/4");
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("has tempo_bpm = 120", () => {
    expect(DEFAULT_SETTINGS.tempo_bpm).toBe(120);
  });
});

describe("GridValue", () => {
  it("accepts all supported grid values", () => {
    const values: GridValue[] = ["1/4", "1/8", "1/3", "1/6"];
    expect(values).toHaveLength(4);
  });
});

describe("ProgressionRecord", () => {
  it("can be constructed with all required fields", () => {
    const record: ProgressionRecord = {
      id: "test-id",
      schema_version: CURRENT_SCHEMA_VERSION,
      title: "ii-V-I",
      tempo_bpm: 120,
      grid: "1/4",
      chords: ["Dm7", "G7", "Cmaj7"],
      notes: "",
      created_at: "2026-02-15T00:00:00Z",
      updated_at: "2026-02-15T00:00:00Z",
    };

    expect(record.id).toBe("test-id");
    expect(record.schema_version).toBe(1);
    expect(record.title).toBe("ii-V-I");
    expect(record.tempo_bpm).toBe(120);
    expect(record.grid).toBe("1/4");
    expect(record.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
    expect(record.notes).toBe("");
    expect(record.created_at).toBe("2026-02-15T00:00:00Z");
    expect(record.updated_at).toBe("2026-02-15T00:00:00Z");
  });

  it("stores chord symbols verbatim (no validation)", () => {
    const record: ProgressionRecord = {
      id: "test",
      schema_version: 1,
      title: "",
      tempo_bpm: 120,
      grid: "1/4",
      chords: ["XYZ", "!!!invalid", ""],
      notes: "",
      created_at: "",
      updated_at: "",
    };
    expect(record.chords).toEqual(["XYZ", "!!!invalid", ""]);
  });
});

describe("SettingsRecord", () => {
  it("can be constructed with tempo_bpm", () => {
    const settings: SettingsRecord = { tempo_bpm: 90 };
    expect(settings.tempo_bpm).toBe(90);
  });
});

describe("SharePayload", () => {
  it("can be constructed with required fields", () => {
    const payload: SharePayload = {
      schema_version: 1,
      grid: "1/8",
      tempo_bpm: 140,
      chords: ["Am", "F", "C", "G"],
    };
    expect(payload.schema_version).toBe(1);
    expect(payload.grid).toBe("1/8");
    expect(payload.tempo_bpm).toBe(140);
    expect(payload.chords).toEqual(["Am", "F", "C", "G"]);
  });

  it("is a subset of ProgressionRecord fields", () => {
    const record: ProgressionRecord = {
      id: "id",
      schema_version: 1,
      title: "Test",
      tempo_bpm: 120,
      grid: "1/4",
      chords: ["C"],
      notes: "",
      created_at: "",
      updated_at: "",
    };

    const payload: SharePayload = {
      schema_version: record.schema_version,
      grid: record.grid,
      tempo_bpm: record.tempo_bpm,
      chords: record.chords,
    };

    expect(payload.schema_version).toBe(record.schema_version);
    expect(payload.grid).toBe(record.grid);
    expect(payload.tempo_bpm).toBe(record.tempo_bpm);
    expect(payload.chords).toEqual(record.chords);
  });
});

describe("generateId", () => {
  it("produces a valid UUID v4 format", () => {
    const id = generateId();
    expect(id).toMatch(UUID_RE);
  });

  it("produces unique values across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });

  it("has correct length (36 characters)", () => {
    const id = generateId();
    expect(id).toHaveLength(36);
  });
});
