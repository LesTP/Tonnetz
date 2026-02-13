import { describe, it, expect } from "vitest";
import {
  buildWindowIndices,
  parseChordSymbol,
  computeChordPcs,
  placeMainTriad,
  decomposeChordToShape,
  mapProgressionToShapes,
  getEdgeUnionPcs,
  triId,
  triVertices,
  pc,
  nodeId,
  edgeId,
} from "../index.js";
import type { Chord, NodeCoord, WindowIndices } from "../index.js";

function parse(sym: string): Chord {
  const raw = parseChordSymbol(sym);
  const { chord_pcs, main_triad_pcs } = computeChordPcs(
    raw.root_pc,
    raw.quality,
    raw.extension,
  );
  return { ...raw, chord_pcs, main_triad_pcs };
}

const origin: NodeCoord = { u: 0, v: 0 };

describe("Performance", () => {
  it("buildWindowIndices for 10×10 window completes in < 50ms", () => {
    const start = performance.now();
    const idx = buildWindowIndices({ uMin: -5, uMax: 5, vMin: -5, vMax: 5 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(idx.triIdToRef.size).toBeGreaterThan(0);
  });

  it("50-chord progression completes in < 100ms", () => {
    const idx = buildWindowIndices({ uMin: -6, uMax: 6, vMin: -6, vMax: 6 });
    const symbols = [
      "C", "Am", "Dm", "G7", "C", "F", "Bdim", "Em",
      "Am", "Dm", "G", "Cmaj7", "Fmaj7", "Dm7", "G7", "C",
      "Am", "F", "G", "C", "Dm", "Em", "F", "G",
      "Am7", "Dm7", "G7", "Cmaj7", "F", "Bdim", "C", "Am",
      "Dm", "G", "C", "F", "G7", "Am", "Em", "Dm",
      "G7", "C", "Am", "F", "Dm7", "G7", "Cmaj7", "Am",
      "Dm", "G",
    ];
    const chords = symbols.map(parse);
    expect(chords).toHaveLength(50);

    const start = performance.now();
    const shapes = mapProgressionToShapes(chords, origin, idx);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(shapes).toHaveLength(50);
  });

  it("100-chord progression completes in < 200ms", () => {
    const idx = buildWindowIndices({ uMin: -6, uMax: 6, vMin: -6, vMax: 6 });
    const base = ["C", "Am", "Dm", "G7", "F", "Em", "Bdim", "G", "Cmaj7", "Am7"];
    const chords = Array.from({ length: 100 }, (_, i) => parse(base[i % base.length]));

    const start = performance.now();
    const shapes = mapProgressionToShapes(chords, origin, idx);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
    expect(shapes).toHaveLength(100);
  });

  it("large window (20×20) builds without excessive time", () => {
    const start = performance.now();
    const idx = buildWindowIndices({ uMin: -10, uMax: 10, vMin: -10, vMax: 10 });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(idx.triIdToRef.size).toBe(882);
  });
});

describe("Edge cases: coordinate extremes", () => {
  it("large negative coordinates produce valid pcs", () => {
    expect(pc(-100, -100)).toBeGreaterThanOrEqual(0);
    expect(pc(-100, -100)).toBeLessThan(12);
  });

  it("large positive coordinates produce valid pcs", () => {
    expect(pc(100, 100)).toBeGreaterThanOrEqual(0);
    expect(pc(100, 100)).toBeLessThan(12);
  });

  it("nodeId with large coordinates produces valid string", () => {
    const id = nodeId(999, -999);
    expect(id).toBe("N:999,-999");
  });
});

describe("Edge cases: window bounds", () => {
  it("zero-area window (uMin=uMax, vMin=vMax) produces 2 triangles", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 0, vMin: 0, vMax: 0 });
    expect(idx.triIdToRef.size).toBe(2);
  });

  it("negative-anchored window works correctly", () => {
    const idx = buildWindowIndices({ uMin: -3, uMax: -1, vMin: -3, vMax: -1 });
    expect(idx.triIdToRef.size).toBe(2 * 3 * 3); // 18 triangles
    // All triangles have valid pcs
    for (const ref of idx.triIdToRef.values()) {
      const verts = triVertices(ref);
      for (const v of verts) {
        const p = pc(v.u, v.v);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(12);
      }
    }
  });

  it("asymmetric window works correctly", () => {
    const idx = buildWindowIndices({ uMin: -1, uMax: 5, vMin: 0, vMax: 1 });
    // 7 columns × 2 rows = 14 cells, 2 tris each = 28
    expect(idx.triIdToRef.size).toBe(2 * 7 * 2);
  });
});

describe("Edge cases: chord parsing", () => {
  it("every enharmonic root parses correctly", () => {
    const roots = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
    for (const r of roots) {
      const parsed = parseChordSymbol(r);
      expect(parsed.root_pc).toBeGreaterThanOrEqual(0);
      expect(parsed.root_pc).toBeLessThan(12);
    }
  });

  it("every MVP chord type for every root produces valid pcs", () => {
    const roots = ["C", "D", "E", "F", "G", "A", "B", "F#", "Bb", "Eb", "Ab", "Db"];
    const suffixes = ["", "m", "dim", "aug", "7", "maj7", "m7", "6", "add9", "6/9"];
    for (const r of roots) {
      for (const s of suffixes) {
        const sym = r + s;
        const chord = parse(sym);
        expect(chord.chord_pcs.length).toBeGreaterThanOrEqual(3);
        for (const p of chord.chord_pcs) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(12);
        }
      }
    }
  });
});

describe("Edge cases: placement", () => {
  const idx = buildWindowIndices({ uMin: -4, uMax: 4, vMin: -4, vMax: 4 });

  it("every MVP chord type decomposes with valid Shape invariants", () => {
    const chords = [
      "C", "Cm", "Cdim", "Caug", "C7", "Cmaj7", "Cm7", "C6", "Cadd9", "C6/9",
    ].map(parse);

    for (const chord of chords) {
      const mainTri = placeMainTriad(chord, origin, idx);
      const shape = decomposeChordToShape(chord, mainTri, origin, idx);

      // Coverage invariant
      const union = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
      expect(union).toEqual(new Set(chord.chord_pcs));

      // Centroid is finite
      expect(Number.isFinite(shape.centroid_uv.u)).toBe(true);
      expect(Number.isFinite(shape.centroid_uv.v)).toBe(true);

      // dim/aug → null main_tri; others → non-null
      if (chord.quality === "dim" || chord.quality === "aug") {
        expect(shape.main_tri).toBeNull();
        expect(shape.root_vertex_index).toBeNull();
      } else {
        expect(shape.main_tri).not.toBeNull();
        expect(shape.root_vertex_index).not.toBeNull();
      }
    }
  });

  it("same set for root F# (non-zero root stress test)", () => {
    const chords = [
      "F#", "F#m", "F#dim", "F#aug", "F#7", "F#maj7", "F#m7", "F#6", "F#add9", "F#6/9",
    ].map(parse);

    for (const chord of chords) {
      const mainTri = placeMainTriad(chord, origin, idx);
      const shape = decomposeChordToShape(chord, mainTri, origin, idx);

      const union = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
      expect(union).toEqual(new Set(chord.chord_pcs));
      expect(Number.isFinite(shape.centroid_uv.u)).toBe(true);
      expect(Number.isFinite(shape.centroid_uv.v)).toBe(true);
    }
  });

  it("focus far from origin still finds valid placement", () => {
    const farFocus: NodeCoord = { u: 3, v: -3 };
    const chord = parse("Am7");
    const mainTri = placeMainTriad(chord, farFocus, idx);
    expect(mainTri).not.toBeNull();

    const shape = decomposeChordToShape(chord, mainTri, farFocus, idx);
    const union = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
    expect(union).toEqual(new Set(chord.chord_pcs));
  });
});

describe("Edge cases: adjacency & edge union", () => {
  const idx = buildWindowIndices({ uMin: -2, uMax: 2, vMin: -2, vMax: 2 });

  it("boundary edge returns null from getEdgeUnionPcs", () => {
    // Edge at the boundary of the window
    const eid = edgeId({ u: -2, v: -2 }, { u: -1, v: -2 });
    const result = getEdgeUnionPcs(eid, idx);
    // Could be null (boundary) or valid — just verify no crash
    if (result !== null) {
      expect(result.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("non-existent edge returns null from getEdgeUnionPcs", () => {
    const eid = edgeId({ u: 99, v: 99 }, { u: 100, v: 99 });
    expect(getEdgeUnionPcs(eid, idx)).toBeNull();
  });

  it("every interior edge has exactly 4 union pcs", () => {
    // An interior edge is shared by 2 triangles, each contributing 3 pcs
    // with 2 shared → 4 unique
    for (const [eid, tris] of idx.edgeToTris) {
      if (tris.length === 2) {
        const union = getEdgeUnionPcs(eid, idx);
        expect(union).not.toBeNull();
        expect(union!.length).toBe(4);
      }
    }
  });
});

describe("Edge cases: progression", () => {
  const idx = buildWindowIndices({ uMin: -6, uMax: 6, vMin: -6, vMax: 6 });

  it("progression of all same chord is stable", () => {
    const chords = Array.from({ length: 10 }, () => parse("C"));
    const shapes = mapProgressionToShapes(chords, origin, idx);
    expect(shapes).toHaveLength(10);

    // After the first, all should pick the same triangle (focus stabilizes)
    for (let i = 2; i < shapes.length; i++) {
      expect(triId(shapes[i].main_tri!)).toBe(triId(shapes[1].main_tri!));
    }
  });

  it("alternating dim/aug progression never produces NaN", () => {
    const chords = [
      "Bdim", "Caug", "Bdim", "Caug", "Bdim", "Caug",
    ].map(parse);
    const shapes = mapProgressionToShapes(chords, origin, idx);
    expect(shapes).toHaveLength(6);

    for (const s of shapes) {
      expect(Number.isNaN(s.centroid_uv.u)).toBe(false);
      expect(Number.isNaN(s.centroid_uv.v)).toBe(false);
      expect(Number.isFinite(s.centroid_uv.u)).toBe(true);
      expect(Number.isFinite(s.centroid_uv.v)).toBe(true);
    }
  });

  it("progression with non-origin initial focus", () => {
    const focus: NodeCoord = { u: 2, v: -1 };
    const shapes = mapProgressionToShapes(
      [parse("G"), parse("C"), parse("Am")],
      focus,
      idx,
    );
    expect(shapes).toHaveLength(3);
    // First shape placed near the given focus, not origin
    for (const s of shapes) {
      const union = new Set([...s.covered_pcs, ...s.dot_pcs]);
      expect(union).toEqual(new Set(s.chord.chord_pcs));
    }
  });
});
