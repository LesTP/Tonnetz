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
        grid: "1/4",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.shapes).toHaveLength(3);
      expect(success.events).toHaveLength(3);

      // Each chord = 1 beat at "1/4" grid, no repeats
      expect(success.events[0].startBeat).toBe(0);
      expect(success.events[0].durationBeats).toBe(1);
      expect(success.events[1].startBeat).toBe(1);
      expect(success.events[1].durationBeats).toBe(1);
      expect(success.events[2].startBeat).toBe(2);
      expect(success.events[2].durationBeats).toBe(1);
    });

    it("collapses repeated chords and extends durations", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "Dm7", "G7", "Cmaj7", "Cmaj7"],
        grid: "1/4",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      // 3 unique chords after collapse
      expect(success.shapes).toHaveLength(3);
      expect(success.events).toHaveLength(3);

      // Dm7: 2 slots × 1 beat = 2 beats
      expect(success.events[0].durationBeats).toBe(2);
      expect(success.events[0].startBeat).toBe(0);

      // G7: 1 slot × 1 beat = 1 beat
      expect(success.events[1].durationBeats).toBe(1);
      expect(success.events[1].startBeat).toBe(2);

      // Cmaj7: 2 slots × 1 beat = 2 beats
      expect(success.events[2].durationBeats).toBe(2);
      expect(success.events[2].startBeat).toBe(3);
    });

    it("applies eighth-note grid correctly", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "G7", "Cmaj7"],
        grid: "1/8",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.events[0].durationBeats).toBe(0.5);
      expect(success.events[1].startBeat).toBe(0.5);
      expect(success.events[1].durationBeats).toBe(0.5);
      expect(success.events[2].startBeat).toBe(1);
    });

    it("applies triplet grid correctly", () => {
      const result = loadProgressionPipeline({
        chords: ["Am", "Dm", "Em"],
        grid: "1/3",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      const beatsPerChord = 4 / 3;
      expect(success.events[0].durationBeats).toBeCloseTo(beatsPerChord, 10);
      expect(success.events[1].startBeat).toBeCloseTo(beatsPerChord, 10);
      expect(success.events[2].startBeat).toBeCloseTo(beatsPerChord * 2, 10);
    });

    it("returns empty shapes + events for empty chords array", () => {
      const result = loadProgressionPipeline({
        chords: [],
        grid: "1/4",
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
        grid: "1/4",
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
        grid: "1/4",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.collapsed).toEqual([
        { symbol: "Dm7", count: 2 },
        { symbol: "G7", count: 1 },
      ]);
    });

    it("shapes have expected HC Shape properties", () => {
      const result = loadProgressionPipeline({
        chords: ["C"],
        grid: "1/4",
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

    it("handles single chord with repeated slots", () => {
      const result = loadProgressionPipeline({
        chords: ["Am", "Am", "Am", "Am"],
        grid: "1/4",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(true);
      const success = result as PipelineSuccess;
      expect(success.shapes).toHaveLength(1);
      expect(success.events).toHaveLength(1);
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[0].startBeat).toBe(0);
    });
  });

  describe("error cases", () => {
    it("returns error for invalid chord symbol", () => {
      const result = loadProgressionPipeline({
        chords: ["Dm7", "INVALID", "Cmaj7"],
        grid: "1/4",
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
        grid: "1/4",
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
        grid: "1/4",
        focus: defaultFocus,
        indices,
      });

      expect(result.ok).toBe(false);
      const error = result as PipelineError;
      expect(error.failedSymbols).not.toContain("Dm7");
    });
  });
});
