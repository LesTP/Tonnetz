/**
 * Tests for progression-pipeline.ts — Phase 2b + 2c.
 *
 * Phase 2b: parseProgressionInput — text → chord symbol token array
 * Phase 2c: loadProgressionPipeline — chord strings → Shape[] + ChordEvent[]
 */
import { describe, it, expect } from "vitest";
import {
  parseProgressionInput,
  loadProgressionPipeline,
  cleanChordSymbol,
} from "../progression-pipeline.js";
import type { PipelineSuccess, PipelineError } from "../progression-pipeline.js";
import { buildWindowIndices } from "harmony-core";
import type { CentroidCoord, WindowIndices } from "harmony-core";

// ── Shared fixture ──────────────────────────────────────────────────

/** Small but sufficient lattice window for placement tests. */
const TEST_BOUNDS = { uMin: -4, uMax: 4, vMin: -4, vMax: 4 };
const indices: WindowIndices = buildWindowIndices(TEST_BOUNDS);
const defaultFocus: CentroidCoord = { u: 0, v: 0 };

// ═══════════════════════════════════════════════════════════════════
// Phase 2b: parseProgressionInput
// ═══════════════════════════════════════════════════════════════════

describe("parseProgressionInput", () => {
  it("parses pipe-delimited input", () => {
    expect(parseProgressionInput("Dm7 | G7 | Cmaj7")).toEqual([
      "Dm7",
      "G7",
      "Cmaj7",
    ]);
  });

  it("parses space-delimited input", () => {
    expect(parseProgressionInput("Dm7 G7 Cmaj7")).toEqual([
      "Dm7",
      "G7",
      "Cmaj7",
    ]);
  });

  it("parses mixed delimiters", () => {
    expect(parseProgressionInput("Dm7 | G7 Cmaj7")).toEqual([
      "Dm7",
      "G7",
      "Cmaj7",
    ]);
  });

  it("strips extra whitespace and empty tokens", () => {
    expect(parseProgressionInput("  Dm7   |   G7  |  Cmaj7  ")).toEqual([
      "Dm7",
      "G7",
      "Cmaj7",
    ]);
  });

  it("handles leading and trailing pipes", () => {
    expect(parseProgressionInput("| Dm7 | G7 |")).toEqual(["Dm7", "G7"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseProgressionInput("")).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(parseProgressionInput("   ")).toEqual([]);
  });

  it("returns empty array for pipe-only input", () => {
    expect(parseProgressionInput("| | |")).toEqual([]);
  });

  it("handles single chord", () => {
    expect(parseProgressionInput("Cmaj7")).toEqual(["Cmaj7"]);
  });

  it("preserves chord symbol casing", () => {
    expect(parseProgressionInput("Dm7 Cmaj7 F#m")).toEqual([
      "Dm7",
      "Cmaj7",
      "F#m",
    ]);
  });

  it("handles tab characters as delimiters", () => {
    expect(parseProgressionInput("Dm7\tG7\tCmaj7")).toEqual([
      "Dm7",
      "G7",
      "Cmaj7",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 2c: loadProgressionPipeline
// ═══════════════════════════════════════════════════════════════════

describe("loadProgressionPipeline", () => {
  describe("success cases", () => {
    it("produces shapes + events for a valid ii–V–I", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "G7", "Cmaj7"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.shapes).toHaveLength(3);
      expect(success.events).toHaveLength(3);

      // POL-D17: each chord = 4 beats, no grid
      expect(success.events[0].startBeat).toBe(0);
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[1].startBeat).toBe(4);
      expect(success.events[1].durationBeats).toBe(4);
      expect(success.events[2].startBeat).toBe(8);
      expect(success.events[2].durationBeats).toBe(4);
    });

    it("repeated chords produce separate shapes (POL-D17: no collapsing)", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "Dm7", "G7", "Cmaj7", "Cmaj7"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      // POL-D17: no collapsing — 5 chords = 5 shapes
      expect(success.shapes).toHaveLength(5);
      expect(success.events).toHaveLength(5);

      // Each chord = 4 beats
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[0].startBeat).toBe(0);
      expect(success.events[1].startBeat).toBe(4);
      expect(success.events[4].startBeat).toBe(16);
    });

    it("all chords get uniform 4-beat durations (POL-D17)", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "G7", "Cmaj7"],
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[1].durationBeats).toBe(4);
      expect(success.events[1].startBeat).toBe(4);
      expect(success.events[2].startBeat).toBe(8);
    });

    it("uniform 4-beat durations for triads too", () => {
      const result = loadProgressionPipeline({
        chords: ["Am", "Dm", "Em"],
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[1].startBeat).toBe(4);
      expect(success.events[2].startBeat).toBe(8);
    });

    it("returns empty shapes + events for empty chords array", () => {
      const result = loadProgressionPipeline({
        chords: [],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.shapes).toEqual([]);
      expect(success.events).toEqual([]);
    });

    it("preserves shape object identity between shapes[] and events[]", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "G7", "Cmaj7"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      for (let i = 0; i < success.shapes.length; i++) {
        expect(success.events[i].shape).toBe(success.shapes[i]);
      }
    });

    it("exposes collapsed array in success result", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "Dm7", "G7"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      // POL-D17: no collapsing — each chord token = one shape, 4 beats
      expect(success.shapes).toHaveLength(3);
      expect(success.events).toHaveLength(3);
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[1].durationBeats).toBe(4);
      expect(success.events[2].durationBeats).toBe(4);
    });

    it("shapes have expected HC Shape properties", () => {
      const result = loadProgressionPipeline({
        chords: ["C"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      const shape = success.shapes[0];
      expect(shape).toHaveProperty("chord");
      expect(shape).toHaveProperty("main_tri");
      expect(shape).toHaveProperty("covered_pcs");
      expect(shape).toHaveProperty("centroid_uv");
      expect(shape.chord.root_pc).toBe(0); // C = 0
    });

    it("repeated chord produces multiple shapes (POL-D17: no collapsing)", () => {
      const result = loadProgressionPipeline({
        chords: ["Am", "Am", "Am", "Am"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.shapes).toHaveLength(4);
      expect(success.events).toHaveLength(4);
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[3].startBeat).toBe(12);
    });
  });

  describe("error cases", () => {
    it("returns error for invalid chord symbol", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "INVALID", "Cmaj7"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(false);
      const error = result as PipelineError;
      expect(error.failedSymbols).toContain("INVALID");
      expect(error.error).toContain("INVALID");
    });

    it("reports all failed symbols (not just first)", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "NOPE", "G7", "ALSO_BAD"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(false);
      const error = result as PipelineError;
      expect(error.failedSymbols).toContain("NOPE");
      expect(error.failedSymbols).toContain("ALSO_BAD");
      expect(error.failedSymbols).toHaveLength(2);
    });

    it("does not include valid symbols in failedSymbols", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "INVALID"],
            focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(false);
      const error = result as PipelineError;
      expect(error.failedSymbols).not.toContain("Dm7");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 0b Layer 1: cleanChordSymbol
// ═══════════════════════════════════════════════════════════════════

describe("cleanChordSymbol", () => {
  describe("slash bass stripping", () => {
    it('"C/E" → "C"', () => {
      expect(cleanChordSymbol("C/E").cleaned).toBe("C");
    });

    it('"Dm7/A" → "Dm7"', () => {
      expect(cleanChordSymbol("Dm7/A").cleaned).toBe("Dm7");
    });

    it('"Cmaj7/G" → "Cmaj7"', () => {
      expect(cleanChordSymbol("Cmaj7/G").cleaned).toBe("Cmaj7");
    });

    it('"Am/E" → "Am"', () => {
      expect(cleanChordSymbol("Am/E").cleaned).toBe("Am");
    });

    it('"G/B" → "G" (bass with accidental-like letter)', () => {
      expect(cleanChordSymbol("G/B").cleaned).toBe("G");
    });

    it('"Fm7/Bb" → "Fm7" (bass with accidental)', () => {
      expect(cleanChordSymbol("Fm7/Bb").cleaned).toBe("Fm7");
    });

    it('"C6/9" preserved (not a slash chord)', () => {
      expect(cleanChordSymbol("C6/9").cleaned).toBe("C6/9");
    });

    it('"G6/9" preserved', () => {
      expect(cleanChordSymbol("G6/9").cleaned).toBe("G6/9");
    });

    it("no warning for slash bass stripping", () => {
      expect(cleanChordSymbol("C/E").warning).toBeNull();
    });
  });

  describe("parenthesized alterations", () => {
    it('"C7(b9)" → "C7"', () => {
      expect(cleanChordSymbol("C7(b9)").cleaned).toBe("C7");
    });

    it('"G7(#11)" → "G7"', () => {
      expect(cleanChordSymbol("G7(#11)").cleaned).toBe("G7");
    });

    it('"Dm7(b5)" → "Dm7"', () => {
      expect(cleanChordSymbol("Dm7(b5)").cleaned).toBe("Dm7");
    });

    it("no warning for parenthesized stripping", () => {
      expect(cleanChordSymbol("C7(b9)").warning).toBeNull();
    });
  });

  describe("half-diminished symbol (ø)", () => {
    it('"Cø7" → "Cm7b5"', () => {
      expect(cleanChordSymbol("Cø7").cleaned).toBe("Cm7b5");
    });

    it('"Cø" → "Cm7b5"', () => {
      expect(cleanChordSymbol("Cø").cleaned).toBe("Cm7b5");
    });

    it('"Bø7" → "Bm7b5"', () => {
      expect(cleanChordSymbol("Bø7").cleaned).toBe("Bm7b5");
    });
  });

  describe("triangle symbol (Δ/△ → maj7)", () => {
    it('"CΔ7" → "Cmaj7"', () => {
      expect(cleanChordSymbol("CΔ7").cleaned).toBe("Cmaj7");
    });

    it('"CΔ" → "Cmaj7"', () => {
      expect(cleanChordSymbol("CΔ").cleaned).toBe("Cmaj7");
    });

    it('"F△7" → "Fmaj7"', () => {
      expect(cleanChordSymbol("F△7").cleaned).toBe("Fmaj7");
    });

    it('"F△" → "Fmaj7"', () => {
      expect(cleanChordSymbol("F△").cleaned).toBe("Fmaj7");
    });
  });

  describe("dash-as-minor", () => {
    it('"C-7" → "Cm7"', () => {
      expect(cleanChordSymbol("C-7").cleaned).toBe("Cm7");
    });

    it('"C-" → "Cm"', () => {
      expect(cleanChordSymbol("C-").cleaned).toBe("Cm");
    });

    it('"Eb-7" → "Ebm7"', () => {
      expect(cleanChordSymbol("Eb-7").cleaned).toBe("Ebm7");
    });

    it('"F#-" → "F#m"', () => {
      expect(cleanChordSymbol("F#-").cleaned).toBe("F#m");
    });
  });

  describe("sus stripping (with warning)", () => {
    it('"Csus4" → "C"', () => {
      expect(cleanChordSymbol("Csus4").cleaned).toBe("C");
    });

    it('"Csus2" → "C"', () => {
      expect(cleanChordSymbol("Csus2").cleaned).toBe("C");
    });

    it('"Dsus" → "D"', () => {
      expect(cleanChordSymbol("Dsus").cleaned).toBe("D");
    });

    it("produces warning for sus stripping", () => {
      const result = cleanChordSymbol("Csus4");
      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain("sus");
    });
  });

  describe("passthrough (no cleaning needed)", () => {
    it('"C" → "C" with null warning', () => {
      const r = cleanChordSymbol("C");
      expect(r.cleaned).toBe("C");
      expect(r.warning).toBeNull();
    });

    it('"Dm7" → "Dm7"', () => {
      expect(cleanChordSymbol("Dm7").cleaned).toBe("Dm7");
    });

    it('"F#dim7" → "F#dim7"', () => {
      expect(cleanChordSymbol("F#dim7").cleaned).toBe("F#dim7");
    });

    it('"Am7b5" → "Am7b5"', () => {
      expect(cleanChordSymbol("Am7b5").cleaned).toBe("Am7b5");
    });

    it("empty string → empty string", () => {
      const r = cleanChordSymbol("");
      expect(r.cleaned).toBe("");
      expect(r.warning).toBeNull();
    });

    it("whitespace-only → trimmed empty string", () => {
      expect(cleanChordSymbol("  ").cleaned).toBe("");
    });
  });

  describe("combined cleaning", () => {
    it('"C-7/E" → slash stripped, then dash → "Cm7"', () => {
      expect(cleanChordSymbol("C-7/E").cleaned).toBe("Cm7");
    });

    it('"FΔ7/A" → slash stripped, then triangle → "Fmaj7"', () => {
      expect(cleanChordSymbol("FΔ7/A").cleaned).toBe("Fmaj7");
    });

    it('"G7(#11)/B" → slash stripped, then parentheses → "G7"', () => {
      expect(cleanChordSymbol("G7(#11)/B").cleaned).toBe("G7");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 0b Layer 1: Pipeline integration (cleaning + parsing)
// ═══════════════════════════════════════════════════════════════════

describe("loadProgressionPipeline with input cleaning", () => {
  it("slash chord parses successfully after cleaning", () => {
    const result = loadProgressionPipeline({
      chords: ["C/E", "Dm7/A", "G7"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes).toHaveLength(3);
  });

  it("half-diminished ø parses as m7b5 after cleaning", () => {
    const result = loadProgressionPipeline({
      chords: ["Bø7", "E7", "Am"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes[0].chord.extension).toBe("m7b5");
    expect(s.shapes[0].chord.quality).toBe("dim");
  });

  it("triangle Δ parses as maj7 after cleaning", () => {
    const result = loadProgressionPipeline({
      chords: ["CΔ7"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes[0].chord.extension).toBe("maj7");
  });

  it("dash-as-minor parses after cleaning", () => {
    const result = loadProgressionPipeline({
      chords: ["D-7", "G7", "C"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes[0].chord.quality).toBe("min");
    expect(s.shapes[0].chord.extension).toBe("7");
  });

  it("sus chord cleaned to bare triad with warning in result", () => {
    const result = loadProgressionPipeline({
      chords: ["Csus4", "G", "Am"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes[0].chord.quality).toBe("maj");
    expect(s.shapes[0].chord.extension).toBeNull();
    expect(s.warnings.length).toBeGreaterThan(0);
    expect(s.warnings[0]).toContain("sus");
  });

  it("parenthesized alterations stripped and chord parses", () => {
    const result = loadProgressionPipeline({
      chords: ["C7(b9)", "F7(#11)"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes[0].chord.extension).toBe("7");
    expect(s.shapes[1].chord.extension).toBe("7");
  });

  it("Autumn Leaves with Am7b5 parses via Layer 2 (no cleaning needed)", () => {
    const result = loadProgressionPipeline({
      chords: [
        "Cm7", "F7", "Bbmaj7", "Ebmaj7",
        "Am7b5", "D7", "Gm", "Gm",
      ],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    // Am7b5 is the 5th unique chord after collapse
    // Cm7, F7, Bbmaj7, Ebmaj7, Am7b5, D7, Gm
    const am7b5Shape = s.shapes[4];
    expect(am7b5Shape.chord.quality).toBe("dim");
    expect(am7b5Shape.chord.extension).toBe("m7b5");
    expect(am7b5Shape.chord.root_pc).toBe(9); // A = 9
  });

  it("no warnings when no cleaning needed", () => {
    const result = loadProgressionPipeline({
      chords: ["Dm7", "G7", "Cmaj7"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.warnings).toEqual([]);
  });

  it("6/9 extension preserved through cleaning (not treated as slash)", () => {
    const result = loadProgressionPipeline({
      chords: ["C6/9"],
        focus: defaultFocus,
      indices,
    });
    expect(result.ok).toBe(true);
    const s = result as PipelineSuccess;
    expect(s.shapes[0].chord.extension).toBe("6/9");
  });
});
