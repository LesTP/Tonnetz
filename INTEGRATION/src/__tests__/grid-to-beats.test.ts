/**
 * Tests for grid-to-beats.ts — Phase 2a.
 *
 * Covers:
 * - gridToBeatsPerChord: all four GridValue strings → correct beat values
 * - collapseRepeatedChords: consecutive merging, pass-through, edge cases
 */
import { describe, it, expect } from "vitest";
import { gridToBeatsPerChord, collapseRepeatedChords } from "../grid-to-beats.js";
import type { GridValue } from "persistence-data";

describe("gridToBeatsPerChord", () => {
  it('"1/4" → 1 beat (quarter note grid)', () => {
    expect(gridToBeatsPerChord("1/4")).toBe(1);
  });

  it('"1/8" → 0.5 beats (eighth note grid)', () => {
    expect(gridToBeatsPerChord("1/8")).toBe(0.5);
  });

  it('"1/3" → 4/3 beats (triplet bar subdivision)', () => {
    expect(gridToBeatsPerChord("1/3")).toBeCloseTo(4 / 3, 10);
  });

  it('"1/6" → 2/3 beats (triplet eighth)', () => {
    expect(gridToBeatsPerChord("1/6")).toBeCloseTo(2 / 3, 10);
  });

  it("throws on unknown grid value", () => {
    expect(() => gridToBeatsPerChord("1/5" as GridValue)).toThrow(
      "Unknown grid value",
    );
  });
});

describe("collapseRepeatedChords", () => {
  it("collapses consecutive identical symbols", () => {
    const result = collapseRepeatedChords([
      "Dm7", "Dm7", "G7", "Cmaj7", "Cmaj7",
    ]);
    expect(result).toEqual([
      { symbol: "Dm7", count: 2 },
      { symbol: "G7", count: 1 },
      { symbol: "Cmaj7", count: 2 },
    ]);
  });

  it("passes through when no consecutive repeats", () => {
    const result = collapseRepeatedChords(["Dm7", "G7", "Cmaj7"]);
    expect(result).toEqual([
      { symbol: "Dm7", count: 1 },
      { symbol: "G7", count: 1 },
      { symbol: "Cmaj7", count: 1 },
    ]);
  });

  it("handles all identical chords", () => {
    const result = collapseRepeatedChords(["Am", "Am", "Am", "Am"]);
    expect(result).toEqual([{ symbol: "Am", count: 4 }]);
  });

  it("handles single chord", () => {
    const result = collapseRepeatedChords(["C"]);
    expect(result).toEqual([{ symbol: "C", count: 1 }]);
  });

  it("returns empty array for empty input", () => {
    expect(collapseRepeatedChords([])).toEqual([]);
  });

  it("treats non-consecutive identical symbols as separate entries", () => {
    const result = collapseRepeatedChords(["Am", "Dm", "Am"]);
    expect(result).toEqual([
      { symbol: "Am", count: 1 },
      { symbol: "Dm", count: 1 },
      { symbol: "Am", count: 1 },
    ]);
  });

  it("handles long runs interspersed with singles", () => {
    const result = collapseRepeatedChords([
      "Dm7", "Dm7", "Dm7", "G7", "Cmaj7", "Cmaj7",
    ]);
    expect(result).toEqual([
      { symbol: "Dm7", count: 3 },
      { symbol: "G7", count: 1 },
      { symbol: "Cmaj7", count: 2 },
    ]);
  });
});
