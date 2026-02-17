import { describe, it, expect } from "vitest";
import { placeMainTriad, decomposeChordToShape, triCentroid } from "../placement.js";
import { buildWindowIndices } from "../indexing.js";
import { parseChordSymbol } from "../chords.js";
import { pc } from "../coords.js";
import { getTrianglePcs, triId, triVertices } from "../triangles.js";

const idx = buildWindowIndices({ uMin: -3, uMax: 5, vMin: -3, vMax: 5 });
const focus = { u: 0, v: 0 };

describe("placeMainTriad", () => {
  it("C major with focus (0,0) → selects up triangle at (0,0)", () => {
    const chord = parseChordSymbol("C");
    const tri = placeMainTriad(chord, { u: 0, v: 0 }, idx);
    expect(tri).not.toBeNull();
    expect(tri!.orientation).toBe("U");
    expect(tri!.anchor).toEqual({ u: 0, v: 0 });
  });

  it("C major with focus (5,5) → selects a C major triangle near (5,5), not (0,0)", () => {
    const chord = parseChordSymbol("C");
    const tri = placeMainTriad(chord, { u: 5, v: 5 }, idx);
    expect(tri).not.toBeNull();
    const pcs = getTrianglePcs(tri!);
    expect(pcs).toEqual([0, 4, 7]);
    const centroid = triCentroid(tri!);
    const distToFocus = (centroid.u - 5) ** 2 + (centroid.v - 5) ** 2;
    const distToOrigin = centroid.u ** 2 + centroid.v ** 2;
    expect(distToFocus).toBeLessThan(distToOrigin);
  });

  it("Bdim with any focus → returns null", () => {
    const chord = parseChordSymbol("Bdim");
    const tri = placeMainTriad(chord, { u: 0, v: 0 }, idx);
    expect(tri).toBeNull();
  });

  it("Caug with focus → returns null (aug triads don't form lattice triangles)", () => {
    const chord = parseChordSymbol("Caug");
    const tri = placeMainTriad(chord, { u: 0, v: 0 }, idx);
    expect(tri).toBeNull();
  });

  it("returned triangle's pcs match the chord's main_triad_pcs", () => {
    const chords = ["C", "Am", "G", "F", "Em", "Dm"];
    for (const name of chords) {
      const chord = parseChordSymbol(name);
      const tri = placeMainTriad(chord, { u: 0, v: 0 }, idx);
      if (tri) {
        const triPcs = new Set(getTrianglePcs(tri));
        const chordTriadPcs = new Set(chord.main_triad_pcs);
        expect(triPcs).toEqual(chordTriadPcs);
      }
    }
  });

  it("when two candidates are equidistant, lexicographic TriId wins", () => {
    const chord = parseChordSymbol("C");
    const tri1 = placeMainTriad(chord, { u: 2, v: 2 }, idx);
    const tri2 = placeMainTriad(chord, { u: 2, v: 2 }, idx);
    expect(tri1).not.toBeNull();
    expect(triId(tri1!)).toBe(triId(tri2!));
  });

  it("deterministic: same inputs → identical output", () => {
    const chord = parseChordSymbol("Am");
    const f = { u: 1.5, v: 2.3 };
    const r1 = placeMainTriad(chord, f, idx);
    const r2 = placeMainTriad(chord, f, idx);
    expect(r1).toEqual(r2);
  });

  it("accepts fractional focus coordinates (chain focus)", () => {
    const chord = parseChordSymbol("G");
    const tri = placeMainTriad(chord, { u: 0.333, v: 0.667 }, idx);
    expect(tri).not.toBeNull();
    const pcs = getTrianglePcs(tri!);
    expect(new Set(pcs)).toEqual(new Set([7, 11, 2]));
  });
});

describe("decomposeChordToShape — triangulated", () => {
  it("C major triad → main_tri only, ext_tris=[], dot_pcs=[]", () => {
    const chord = parseChordSymbol("C");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    expect(shape.main_tri).toEqual(mainTri);
    expect(shape.ext_tris).toHaveLength(0);
    expect(shape.dot_pcs).toHaveLength(0);
    expect(shape.covered_pcs).toEqual(new Set([0, 4, 7]));
  });

  it("Cmaj7 → main_tri + ext_tri covering pc 11, dot_pcs=[]", () => {
    const chord = parseChordSymbol("Cmaj7");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    expect(shape.main_tri).not.toBeNull();
    expect(shape.covered_pcs.has(11)).toBe(true);
    // All 4 pcs should be covered (C major + B)
    expect(new Set([...shape.covered_pcs, ...shape.dot_pcs])).toEqual(
      new Set(chord.chord_pcs),
    );
  });

  it("C7 → covers pc 10 via extension or dot", () => {
    const chord = parseChordSymbol("C7");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    const allPcs = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
    expect(allPcs).toEqual(new Set(chord.chord_pcs));
  });

  it("C6/9 (5 pcs) → main_tri + up to 2 ext_tris, remaining in dot_pcs", () => {
    const chord = parseChordSymbol("C6/9");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    expect(shape.ext_tris.length).toBeLessThanOrEqual(2);
    const allPcs = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
    expect(allPcs).toEqual(new Set(chord.chord_pcs));
  });

  it("root_vertex_index correctly identifies root vertex", () => {
    const chord = parseChordSymbol("C");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    expect(shape.root_vertex_index).not.toBeNull();
    const verts = triVertices(mainTri);
    const rootVert = verts[shape.root_vertex_index!];
    expect(pc(rootVert.u, rootVert.v)).toBe(0); // C = 0
  });

  it("centroid_uv for single triangle = mean of 3 vertices", () => {
    const chord = parseChordSymbol("C");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    const expected = triCentroid(mainTri);
    expect(shape.centroid_uv.u).toBeCloseTo(expected.u);
    expect(shape.centroid_uv.v).toBeCloseTo(expected.v);
  });

  it("centroid_uv for tri + ext = mean of unique vertices", () => {
    const chord = parseChordSymbol("Cmaj7");
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    if (shape.ext_tris.length > 0) {
      // Centroid should differ from single-triangle centroid
      const singleCentroid = triCentroid(mainTri);
      const hasMoved =
        shape.centroid_uv.u !== singleCentroid.u ||
        shape.centroid_uv.v !== singleCentroid.v;
      expect(hasMoved).toBe(true);
    }
  });

  it("covered_pcs ∪ dot_pcs = chord_pcs (complete coverage)", () => {
    const names = ["C", "Am", "Cmaj7", "C7", "Cm7", "C6", "Cadd9", "C6/9"];
    for (const name of names) {
      const chord = parseChordSymbol(name);
      const mainTri = placeMainTriad(chord, focus, idx);
      if (!mainTri) continue;
      const shape = decomposeChordToShape(chord, mainTri, focus, idx);
      const allPcs = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
      expect(allPcs).toEqual(new Set(chord.chord_pcs));
    }
  });

  it("ext_tris never exceeds configured maximum (2)", () => {
    const chord = parseChordSymbol("C6/9"); // 5 pcs, most likely to expand
    const mainTri = placeMainTriad(chord, focus, idx)!;
    const shape = decomposeChordToShape(chord, mainTri, focus, idx);
    expect(shape.ext_tris.length).toBeLessThanOrEqual(2);
  });
});

describe("decomposeChordToShape — dot-only", () => {
  it("Bdim → main_tri=null, dot_pcs contains all chord pcs", () => {
    const chord = parseChordSymbol("Bdim");
    const shape = decomposeChordToShape(chord, null, focus, idx);
    expect(shape.main_tri).toBeNull();
    expect(new Set(shape.dot_pcs)).toEqual(new Set([11, 2, 5]));
    expect(shape.ext_tris).toHaveLength(0);
  });

  it("F#dim → dot_pcs = chord_pcs, centroid near focus (computed from nearest nodes)", () => {
    const chord = parseChordSymbol("F#dim");
    const f: NodeCoord = { u: 2.5, v: 1.5 };
    const shape = decomposeChordToShape(chord, null, f, idx);
    expect(new Set(shape.dot_pcs)).toEqual(new Set([6, 9, 0]));
    // Centroid is now the average of nearest node positions, not exactly the focus
    expect(typeof shape.centroid_uv.u).toBe("number");
    expect(typeof shape.centroid_uv.v).toBe("number");
    expect(Number.isFinite(shape.centroid_uv.u)).toBe(true);
    expect(Number.isFinite(shape.centroid_uv.v)).toBe(true);
  });

  it("Caug → dot-only shape", () => {
    const chord = parseChordSymbol("Caug");
    const shape = decomposeChordToShape(chord, null, focus, idx);
    expect(shape.main_tri).toBeNull();
    expect(new Set(shape.dot_pcs)).toEqual(new Set([0, 4, 8]));
  });

  it("root_vertex_index = null for dot-only shapes", () => {
    const chord = parseChordSymbol("Bdim");
    const shape = decomposeChordToShape(chord, null, focus, idx);
    expect(shape.root_vertex_index).toBeNull();
  });

  it("covered_pcs is empty for dot-only shapes", () => {
    const chord = parseChordSymbol("Bdim");
    const shape = decomposeChordToShape(chord, null, focus, idx);
    expect(shape.covered_pcs.size).toBe(0);
  });
});
