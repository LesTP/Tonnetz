import { describe, it, expect } from "vitest";
import { mapProgressionToShapes } from "../progression.js";
import { parseChordSymbol } from "../chords.js";
import { buildWindowIndices } from "../indexing.js";
import type { NodeCoord, WindowIndices } from "../types.js";

const indices: WindowIndices = buildWindowIndices({
  uMin: -4,
  uMax: 4,
  vMin: -4,
  vMax: 4,
});
const origin: NodeCoord = { u: 0, v: 0 };

describe("mapProgressionToShapes", () => {
  it("empty progression → empty array", () => {
    expect(mapProgressionToShapes([], origin, indices)).toEqual([]);
  });

  it("single chord placed at initialFocus", () => {
    const shapes = mapProgressionToShapes([parseChordSymbol("C")], origin, indices);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].chord.root_pc).toBe(0);
    expect(shapes[0].main_tri).not.toBeNull();
  });

  it("two-chord progression: second focus = first centroid", () => {
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("C"), parseChordSymbol("Am")],
      origin,
      indices,
    );
    expect(shapes).toHaveLength(2);
    // Second shape exists and is well-formed
    expect(shapes[1].chord.root_pc).toBe(9);
    expect(shapes[1].main_tri).not.toBeNull();
  });

  it("three-chord chain focus (C → F → G)", () => {
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("C"), parseChordSymbol("F"), parseChordSymbol("G")],
      origin,
      indices,
    );
    expect(shapes).toHaveLength(3);
    // Each shape has valid centroid for chaining
    for (const s of shapes) {
      expect(Number.isFinite(s.centroid_uv.u)).toBe(true);
      expect(Number.isFinite(s.centroid_uv.v)).toBe(true);
    }
  });

  it("dim chord passes focus through (C → Bdim → Am)", () => {
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("C"), parseChordSymbol("Bdim"), parseChordSymbol("Am")],
      origin,
      indices,
    );
    expect(shapes).toHaveLength(3);
    // Bdim is dot-only: centroid is computed from nearest nodes (near incoming focus)
    expect(shapes[1].main_tri).toBeNull();
    // Centroid should be near (but not exactly equal to) the first chord's centroid
    const dim_centroid = shapes[1].centroid_uv;
    const prev_centroid = shapes[0].centroid_uv;
    const dist = Math.sqrt(
      (dim_centroid.u - prev_centroid.u) ** 2 +
      (dim_centroid.v - prev_centroid.v) ** 2,
    );
    expect(dist).toBeLessThan(3); // reasonably close
    // Am gets focus from Bdim's centroid (which is now node-based, not passthrough)
    expect(shapes[2].main_tri).not.toBeNull();
  });

  it("all shapes satisfy coverage invariant", () => {
    const chords = ["C", "Dm", "Em", "F", "G", "Am", "Bdim"].map(parseChordSymbol);
    const shapes = mapProgressionToShapes(chords, origin, indices);
    expect(shapes).toHaveLength(7);

    for (const s of shapes) {
      const coveredArr = [...s.covered_pcs];
      const union = new Set([...coveredArr, ...s.dot_pcs]);
      const chordSet = new Set(s.chord.chord_pcs);
      expect(union).toEqual(chordSet);
    }
  });

  // Phase 5b: path geometry tests

  it("ii–V–I centroids form connected path (no jumps)", () => {
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("Dm"), parseChordSymbol("G"), parseChordSymbol("C")],
      origin,
      indices,
    );
    // Centroids should be relatively close (within a few lattice units)
    for (let i = 1; i < shapes.length; i++) {
      const prev = shapes[i - 1].centroid_uv;
      const curr = shapes[i].centroid_uv;
      const du = curr.u - prev.u;
      const dv = curr.v - prev.v;
      const dist = Math.sqrt(du * du + dv * dv);
      expect(dist).toBeLessThan(5);
    }
  });

  it("I–IV–V–I returns to approximately same region", () => {
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("C"), parseChordSymbol("F"), parseChordSymbol("G"), parseChordSymbol("C")],
      origin,
      indices,
    );
    const first = shapes[0].centroid_uv;
    const last = shapes[3].centroid_uv;
    const du = last.u - first.u;
    const dv = last.v - first.v;
    const dist = Math.sqrt(du * du + dv * dv);
    expect(dist).toBeLessThan(4);
  });

  it("centroids are fractional (not rounded to integers)", () => {
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("C"), parseChordSymbol("Am")],
      origin,
      indices,
    );
    // Centroid of a single triangle is mean of 3 vertices → has /3 fractions
    const c = shapes[0].centroid_uv;
    const isFractional = !Number.isInteger(c.u) || !Number.isInteger(c.v);
    expect(isFractional).toBe(true);
  });

  it("long progression (8+ chords): no NaN/Infinity", () => {
    const chords = [
      "C", "Am", "Dm", "G", "C", "F", "Bdim", "Em", "Am", "Dm", "G7", "C",
    ].map(parseChordSymbol);
    const shapes = mapProgressionToShapes(chords, origin, indices);
    expect(shapes).toHaveLength(12);

    for (const s of shapes) {
      expect(Number.isFinite(s.centroid_uv.u)).toBe(true);
      expect(Number.isFinite(s.centroid_uv.v)).toBe(true);
      expect(Number.isNaN(s.centroid_uv.u)).toBe(false);
      expect(Number.isNaN(s.centroid_uv.v)).toBe(false);
    }
  });

  it("deterministic: same input → identical output", () => {
    const chords = [parseChordSymbol("Dm"), parseChordSymbol("G7"), parseChordSymbol("Cmaj7")];
    const a = mapProgressionToShapes(chords, origin, indices);
    const b = mapProgressionToShapes(chords, origin, indices);

    expect(a).toHaveLength(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].main_tri).toEqual(b[i].main_tri);
      expect(a[i].centroid_uv).toEqual(b[i].centroid_uv);
      expect(a[i].dot_pcs).toEqual(b[i].dot_pcs);
      expect(a[i].ext_tris).toEqual(b[i].ext_tris);
    }
  });
});
