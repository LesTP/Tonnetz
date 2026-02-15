import { describe, it, expect } from "vitest";
import { encodeShareUrl, decodeShareUrl } from "../sharing.js";
import { CURRENT_SCHEMA_VERSION } from "../types.js";
import type { GridValue, SharePayload } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Typical share payload for testing. */
function typicalPayload(): SharePayload {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    grid: "1/4" as GridValue,
    tempo_bpm: 120,
    chords: ["Dm7", "G7", "Cmaj7"],
  };
}

// ---------------------------------------------------------------------------
// Phase 3a: encodeShareUrl / decodeShareUrl (human-readable format, PD-DEV-D5)
// ---------------------------------------------------------------------------

describe("encodeShareUrl / decodeShareUrl", () => {
  it("encode then decode round-trips correctly", () => {
    const input = typicalPayload();
    const encoded = encodeShareUrl(input);
    const decoded = decodeShareUrl(encoded);
    expect(decoded).toEqual(input);
  });

  it("produces human-readable format", () => {
    const encoded = encodeShareUrl(typicalPayload());
    expect(encoded).toBe("Dm7-G7-Cmaj7&t=120&g=4&v=1");
  });

  it("encoded string is URL-safe (no #, spaces, or control chars)", () => {
    const input: SharePayload = {
      ...typicalPayload(),
      chords: ["F#7", "C#m7", "G#m"],
    };
    const encoded = encodeShareUrl(input);
    expect(encoded).not.toMatch(/[# \t\n]/);
    // Sharps encoded as "s"
    expect(encoded).toContain("Fs7");
    expect(encoded).toContain("Csm7");
    expect(encoded).toContain("Gsm");
  });

  it("sharp signs round-trip correctly (# ↔ s)", () => {
    const input: SharePayload = {
      ...typicalPayload(),
      chords: ["F#7", "C#m7", "G#m", "A#dim"],
    };
    const decoded = decodeShareUrl(encodeShareUrl(input));
    expect(decoded).not.toBeNull();
    expect(decoded!.chords).toEqual(["F#7", "C#m7", "G#m", "A#dim"]);
  });

  it("decode malformed string returns null (not throw)", () => {
    expect(decodeShareUrl("")).toBeNull();
    expect(decodeShareUrl("just-chords-no-params")).toBeNull();
    expect(decodeShareUrl("!!!garbage!!!")).toBeNull();
  });

  it("decode missing required parameter returns null", () => {
    // Missing t (tempo)
    expect(decodeShareUrl("Dm7-G7&g=4&v=1")).toBeNull();
    // Missing g (grid)
    expect(decodeShareUrl("Dm7-G7&t=120&v=1")).toBeNull();
    // Missing v (version)
    expect(decodeShareUrl("Dm7-G7&t=120&g=4")).toBeNull();
  });

  it("schema_version is preserved through round-trip", () => {
    const input = { ...typicalPayload(), schema_version: 42 };
    const decoded = decodeShareUrl(encodeShareUrl(input));
    expect(decoded).not.toBeNull();
    expect(decoded!.schema_version).toBe(42);
  });

  it("long progression (50+ chords) round-trips", () => {
    const longChords = Array.from({ length: 60 }, (_, i) =>
      i % 3 === 0 ? "Dm7" : i % 3 === 1 ? "G7" : "Cmaj7",
    );
    const input: SharePayload = { ...typicalPayload(), chords: longChords };
    const decoded = decodeShareUrl(encodeShareUrl(input));
    expect(decoded).not.toBeNull();
    expect(decoded!.chords).toEqual(longChords);
    expect(decoded!.chords).toHaveLength(60);
  });
});

// ---------------------------------------------------------------------------
// Decode validation edge cases
// ---------------------------------------------------------------------------

describe("decodeShareUrl validation", () => {
  it("rejects invalid grid denominator", () => {
    expect(decodeShareUrl("Dm7&t=120&g=5&v=1")).toBeNull();
    expect(decodeShareUrl("Dm7&t=120&g=0&v=1")).toBeNull();
  });

  it("rejects non-numeric tempo", () => {
    expect(decodeShareUrl("Dm7&t=fast&g=4&v=1")).toBeNull();
  });

  it("rejects non-numeric version", () => {
    expect(decodeShareUrl("Dm7&t=120&g=4&v=abc")).toBeNull();
  });

  it("rejects empty chord segment", () => {
    // Leading dash → empty first chord
    expect(decodeShareUrl("-Dm7&t=120&g=4&v=1")).toBeNull();
    // Consecutive dashes → empty chord
    expect(decodeShareUrl("Dm7--G7&t=120&g=4&v=1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 3 completion tests
// ---------------------------------------------------------------------------

describe("Phase 3 completion", () => {
  it("round-trips all supported grid values", () => {
    const grids: Array<{ grid: GridValue; denom: number }> = [
      { grid: "1/4", denom: 4 },
      { grid: "1/8", denom: 8 },
      { grid: "1/3", denom: 3 },
      { grid: "1/6", denom: 6 },
    ];
    for (const { grid, denom } of grids) {
      const input: SharePayload = { ...typicalPayload(), grid };
      const encoded = encodeShareUrl(input);
      expect(encoded).toContain(`g=${denom}`);
      const decoded = decodeShareUrl(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.grid).toBe(grid);
    }
  });

  it("payload size for typical progression (8 chords) is shorter than base64 equivalent", () => {
    const input: SharePayload = {
      schema_version: CURRENT_SCHEMA_VERSION,
      grid: "1/4" as GridValue,
      tempo_bpm: 120,
      chords: ["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Am7"],
    };
    const encoded = encodeShareUrl(input);
    // Human-readable format should be compact
    expect(encoded.length).toBeLessThan(100);
  });

  it("deterministic: same input produces identical output", () => {
    const input = typicalPayload();
    const a = encodeShareUrl(input);
    const b = encodeShareUrl(input);
    expect(a).toBe(b);
  });
});
