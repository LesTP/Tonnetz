import { describe, it, expect } from "vitest";
import { encodeShareUrl, decodeShareUrl } from "../sharing.js";
import type { SharePayload } from "../sharing.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typicalPayload(): SharePayload {
  return {
    tempo_bpm: 120,
    chords: ["Dm7", "G7", "Cmaj7"],
  };
}

// ---------------------------------------------------------------------------
// encodeShareUrl / decodeShareUrl
// ---------------------------------------------------------------------------

describe("encodeShareUrl / decodeShareUrl", () => {
  it("encode then decode round-trips correctly", () => {
    const input = typicalPayload();
    const encoded = encodeShareUrl(input);
    const decoded = decodeShareUrl(encoded);
    expect(decoded).toEqual(input);
  });

  it("produces human-readable format (chords + tempo only)", () => {
    const encoded = encodeShareUrl(typicalPayload());
    expect(encoded).toBe("Dm7-G7-Cmaj7&t=120");
  });

  it("encoded string is URL-safe (no #, spaces, or control chars)", () => {
    const input: SharePayload = {
      ...typicalPayload(),
      chords: ["F#7", "C#m7", "G#m"],
    };
    const encoded = encodeShareUrl(input);
    expect(encoded).not.toMatch(/[# \t\n]/);
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

  it("decode missing tempo returns null", () => {
    expect(decodeShareUrl("Dm7-G7&x=4")).toBeNull();
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
  it("rejects non-numeric tempo", () => {
    expect(decodeShareUrl("Dm7&t=fast")).toBeNull();
  });

  it("rejects empty chord segment", () => {
    expect(decodeShareUrl("-Dm7&t=120")).toBeNull();
    expect(decodeShareUrl("Dm7--G7&t=120")).toBeNull();
  });

  it("ignores unknown parameters gracefully", () => {
    const decoded = decodeShareUrl("Dm7-G7&t=120&g=4&v=1&x=foo");
    expect(decoded).not.toBeNull();
    expect(decoded!.chords).toEqual(["Dm7", "G7"]);
    expect(decoded!.tempo_bpm).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Compact URL tests
// ---------------------------------------------------------------------------

describe("compact URLs", () => {
  it("payload size for typical progression is compact", () => {
    const input: SharePayload = {
      tempo_bpm: 120,
      chords: ["Dm7", "G7", "Cmaj7", "Cmaj7", "Dm7", "G7", "Cmaj7", "Am7"],
    };
    const encoded = encodeShareUrl(input);
    expect(encoded.length).toBeLessThan(80);
  });

  it("deterministic: same input produces identical output", () => {
    const input = typicalPayload();
    const a = encodeShareUrl(input);
    const b = encodeShareUrl(input);
    expect(a).toBe(b);
  });

  it("no grid or version parameters in output", () => {
    const encoded = encodeShareUrl(typicalPayload());
    expect(encoded).not.toContain("&g=");
    expect(encoded).not.toContain("&v=");
  });
});
