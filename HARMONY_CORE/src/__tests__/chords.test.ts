import { describe, it, expect } from "vitest";
import { parseChordSymbol, computeChordPcs } from "../chords.js";
import type { Quality, Extension } from "../types.js";

describe("parseChordSymbol", () => {
  it('"C" → root_pc=0, quality=maj, extension=null', () => {
    const c = parseChordSymbol("C");
    expect(c.root_pc).toBe(0);
    expect(c.quality).toBe("maj");
    expect(c.extension).toBeNull();
  });

  it('"Am" → root_pc=9, quality=min, extension=null', () => {
    const c = parseChordSymbol("Am");
    expect(c.root_pc).toBe(9);
    expect(c.quality).toBe("min");
    expect(c.extension).toBeNull();
  });

  it('"F#dim" → root_pc=6, quality=dim, extension=null', () => {
    const c = parseChordSymbol("F#dim");
    expect(c.root_pc).toBe(6);
    expect(c.quality).toBe("dim");
    expect(c.extension).toBeNull();
  });

  it('"Bb7" → root_pc=10, quality=maj, extension=7', () => {
    const c = parseChordSymbol("Bb7");
    expect(c.root_pc).toBe(10);
    expect(c.quality).toBe("maj");
    expect(c.extension).toBe("7");
  });

  it('"Dmaj7" → root_pc=2, quality=maj, extension=maj7', () => {
    const c = parseChordSymbol("Dmaj7");
    expect(c.root_pc).toBe(2);
    expect(c.quality).toBe("maj");
    expect(c.extension).toBe("maj7");
  });

  it('"Cm7" → root_pc=0, quality=min, extension=7 (m is quality, 7 is extension)', () => {
    const c = parseChordSymbol("Cm7");
    expect(c.root_pc).toBe(0);
    expect(c.quality).toBe("min");
    expect(c.extension).toBe("7");
  });

  it('"Ebadd9" → root_pc=3, quality=maj, extension=add9', () => {
    const c = parseChordSymbol("Ebadd9");
    expect(c.root_pc).toBe(3);
    expect(c.quality).toBe("maj");
    expect(c.extension).toBe("add9");
  });

  it('"G6/9" → root_pc=7, quality=maj, extension=6/9', () => {
    const c = parseChordSymbol("G6/9");
    expect(c.root_pc).toBe(7);
    expect(c.quality).toBe("maj");
    expect(c.extension).toBe("6/9");
  });

  it('"Caug" → root_pc=0, quality=aug, extension=null (plain aug allowed)', () => {
    const c = parseChordSymbol("Caug");
    expect(c.root_pc).toBe(0);
    expect(c.quality).toBe("aug");
    expect(c.extension).toBeNull();
  });

  it('"Caug7" → rejected (augmented extended excluded from MVP)', () => {
    expect(() => parseChordSymbol("Caug7")).toThrow(/augmented extended/i);
  });

  it('invalid input "XYZ" → error', () => {
    expect(() => parseChordSymbol("XYZ")).toThrow(/invalid chord symbol/i);
  });

  it("case handling: lowercase root accepted", () => {
    const c = parseChordSymbol("cm7");
    expect(c.root_pc).toBe(0);
    expect(c.quality).toBe("min");
    expect(c.extension).toBe("7");
  });

  it("all 12 root notes parseable", () => {
    const roots = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
    for (const r of roots) {
      const c = parseChordSymbol(r);
      expect(c.quality).toBe("maj");
      expect(c.extension).toBeNull();
    }
  });
});

describe("computeChordPcs", () => {
  it("C major: chord_pcs = {0,4,7}, main_triad_pcs = {0,4,7}", () => {
    const c = computeChordPcs(0, "maj", null);
    expect(c.main_triad_pcs).toEqual([0, 4, 7]);
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 7]));
  });

  it("A minor: chord_pcs = {9,0,4}, main_triad_pcs = {9,0,4}", () => {
    const c = computeChordPcs(9, "min", null);
    expect(c.main_triad_pcs).toEqual([9, 0, 4]);
    expect(new Set(c.chord_pcs)).toEqual(new Set([9, 0, 4]));
  });

  it("Bdim: chord_pcs = {11,2,5}, main_triad_pcs = {11,2,5}", () => {
    const c = computeChordPcs(11, "dim", null);
    expect(c.main_triad_pcs).toEqual([11, 2, 5]);
    expect(new Set(c.chord_pcs)).toEqual(new Set([11, 2, 5]));
  });

  it("Caug: chord_pcs = {0,4,8}, main_triad_pcs = {0,4,8}", () => {
    const c = computeChordPcs(0, "aug", null);
    expect(c.main_triad_pcs).toEqual([0, 4, 8]);
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 8]));
  });

  it("Cmaj7: chord_pcs = {0,4,7,11}", () => {
    const c = computeChordPcs(0, "maj", "maj7");
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 7, 11]));
    expect(c.main_triad_pcs).toEqual([0, 4, 7]);
  });

  it("C7: chord_pcs = {0,4,7,10}", () => {
    const c = computeChordPcs(0, "maj", "7");
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 7, 10]));
    expect(c.main_triad_pcs).toEqual([0, 4, 7]);
  });

  it("Cm7: chord_pcs = {0,3,7,10}", () => {
    const c = computeChordPcs(0, "min", "7");
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 3, 7, 10]));
    expect(c.main_triad_pcs).toEqual([0, 3, 7]);
  });

  it("C6: chord_pcs = {0,4,7,9}", () => {
    const c = computeChordPcs(0, "maj", "6");
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 7, 9]));
  });

  it("Cadd9: chord_pcs = {0,4,7,2}", () => {
    const c = computeChordPcs(0, "maj", "add9");
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 7, 2]));
  });

  it("C6/9: chord_pcs = {0,4,7,9,2}", () => {
    const c = computeChordPcs(0, "maj", "6/9");
    expect(new Set(c.chord_pcs)).toEqual(new Set([0, 4, 7, 9, 2]));
  });

  it("all pcs are in 0..11", () => {
    const cases: [number, Quality, Extension | null][] = [
      [0, "maj", null], [0, "min", "7"], [0, "maj", "maj7"],
      [6, "dim", null], [3, "aug", null], [7, "maj", "6/9"],
    ];
    for (const [root, qual, ext] of cases) {
      const c = computeChordPcs(root, qual, ext);
      for (const p of c.chord_pcs) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(12);
      }
    }
  });
});

describe("parseChordSymbol → computeChordPcs round-trip", () => {
  it("all 12 roots × maj produce correct pcs", () => {
    const rootNames = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    for (const name of rootNames) {
      const c = parseChordSymbol(name);
      expect(c.main_triad_pcs[0]).toBe(c.root_pc);
      expect(c.chord_pcs).toHaveLength(3);
    }
  });

  it("all 12 roots × min produce correct pcs", () => {
    const rootNames = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    for (const name of rootNames) {
      const c = parseChordSymbol(name + "m");
      expect(c.quality).toBe("min");
      expect(c.main_triad_pcs[0]).toBe(c.root_pc);
      expect(c.chord_pcs).toHaveLength(3);
    }
  });
});
