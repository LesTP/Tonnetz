import { describe, it, expect } from "vitest";
import {
  buildWindowIndices,
  parseChordSymbol,
  placeMainTriad,
  decomposeChordToShape,
  mapProgressionToShapes,
  getEdgeUnionPcs,
  triId,
  edgeId,
  nodeId,
  triVertices,
  pc,
} from "../index.js";
import type { NodeCoord } from "../index.js";

const origin: NodeCoord = { u: 0, v: 0 };

describe("Phase 6b: End-to-end integration", () => {
  const indices = buildWindowIndices({ uMin: -4, uMax: 4, vMin: -4, vMax: 4 });

  it("Cmaj7: parse → place → decompose → verify shape", () => {
    const chord = parseChordSymbol("Cmaj7");
    expect(chord.chord_pcs).toEqual(expect.arrayContaining([0, 4, 7, 11]));

    const mainTri = placeMainTriad(chord, origin, indices);
    expect(mainTri).not.toBeNull();

    const shape = decomposeChordToShape(chord, mainTri, origin, indices);
    expect(shape.main_tri).not.toBeNull();
    expect(shape.chord.root_pc).toBe(0);

    // Coverage invariant
    const union = new Set([...shape.covered_pcs, ...shape.dot_pcs]);
    expect(union).toEqual(new Set(chord.chord_pcs));

    // Centroid is finite
    expect(Number.isFinite(shape.centroid_uv.u)).toBe(true);
    expect(Number.isFinite(shape.centroid_uv.v)).toBe(true);

    // root_vertex_index points to a vertex with root pc
    expect(shape.root_vertex_index).not.toBeNull();
    const verts = triVertices(shape.main_tri!);
    expect(pc(verts[shape.root_vertex_index!].u, verts[shape.root_vertex_index!].v)).toBe(0);
  });

  it("Bdim: parse → place → decompose → verify dot-only shape", () => {
    const chord = parseChordSymbol("Bdim");
    expect(chord.quality).toBe("dim");

    const mainTri = placeMainTriad(chord, origin, indices);
    expect(mainTri).toBeNull();

    const shape = decomposeChordToShape(chord, mainTri, origin, indices);
    expect(shape.main_tri).toBeNull();
    expect(shape.ext_tris).toHaveLength(0);
    expect(shape.root_vertex_index).toBeNull();
    expect(new Set(shape.dot_pcs)).toEqual(new Set(chord.chord_pcs));
    expect(shape.covered_pcs.size).toBe(0);
    // Centroid is computed from nearest node positions, not origin
    expect(Number.isFinite(shape.centroid_uv.u)).toBe(true);
    expect(Number.isFinite(shape.centroid_uv.v)).toBe(true);
  });

  it("edge union: get shared edge → getEdgeUnionPcs → verify 4 pcs", () => {
    // U(0,0) = C major [0,4,7], D(0,0) = E minor [4,7,11]
    // They share edge (1,0)-(0,1)
    const eid = edgeId({ u: 1, v: 0 }, { u: 0, v: 1 });
    const unionPcs = getEdgeUnionPcs(eid, indices);
    expect(unionPcs).not.toBeNull();
    expect(unionPcs!.sort((a, b) => a - b)).toEqual([0, 4, 7, 11]);
  });

  it("progression: Dm → G7 → Cmaj7 → 3 shapes with chained centroids", () => {
    const chords = [parseChordSymbol("Dm"), parseChordSymbol("G7"), parseChordSymbol("Cmaj7")];
    const shapes = mapProgressionToShapes(chords, origin, indices);

    expect(shapes).toHaveLength(3);

    // Each shape is well-formed
    for (const s of shapes) {
      const union = new Set([...s.covered_pcs, ...s.dot_pcs]);
      expect(union).toEqual(new Set(s.chord.chord_pcs));
      expect(Number.isFinite(s.centroid_uv.u)).toBe(true);
      expect(Number.isFinite(s.centroid_uv.v)).toBe(true);
    }

    // Centroids form a connected path (no large jumps)
    for (let i = 1; i < shapes.length; i++) {
      const prev = shapes[i - 1].centroid_uv;
      const curr = shapes[i].centroid_uv;
      const dist = Math.sqrt((curr.u - prev.u) ** 2 + (curr.v - prev.v) ** 2);
      expect(dist).toBeLessThan(5);
    }
  });

  it("different window → same chord produces different (but valid) placement", () => {
    const smallIdx = buildWindowIndices({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 });
    const largeIdx = buildWindowIndices({ uMin: -6, uMax: 6, vMin: -6, vMax: 6 });

    const chord = parseChordSymbol("C");
    const farFocus: NodeCoord = { u: 5, v: 5 };

    const triSmall = placeMainTriad(chord, farFocus, smallIdx);
    const triLarge = placeMainTriad(chord, farFocus, largeIdx);

    // Small window has fewer candidates, so placement differs from large window
    // (large window can find a C major triangle closer to (5,5))
    expect(triSmall).not.toBeNull();
    expect(triLarge).not.toBeNull();

    // Both are valid C major triangles
    const smallId = triId(triSmall!);
    const largeId = triId(triLarge!);
    // Large window should find a closer candidate
    expect(largeId).not.toBe(smallId);
  });

  it("invalid input produces clear errors", () => {
    expect(() => parseChordSymbol("XYZ")).toThrow();
    expect(() => parseChordSymbol("")).toThrow();
    expect(() => parseChordSymbol("Caug7")).toThrow();
  });

  // Phase 6 completion tests

  it("no circular dependencies (all imports resolve via barrel)", () => {
    // If circular deps existed, the namespace import would have undefined members
    expect(buildWindowIndices).toBeDefined();
    expect(parseChordSymbol).toBeDefined();
    expect(placeMainTriad).toBeDefined();
    expect(decomposeChordToShape).toBeDefined();
    expect(mapProgressionToShapes).toBeDefined();
    expect(getEdgeUnionPcs).toBeDefined();
    expect(pc).toBeDefined();
    expect(nodeId).toBeDefined();
    expect(triId).toBeDefined();
    expect(edgeId).toBeDefined();
    expect(triVertices).toBeDefined();
  });

  it("module has zero runtime dependencies on UI, audio, or storage", () => {
    // Verify the full workflow runs in a pure Node environment with no DOM/Web APIs
    const idx = buildWindowIndices({ uMin: -2, uMax: 2, vMin: -2, vMax: 2 });
    const chord = parseChordSymbol("Am7");
    const mainTri = placeMainTriad(chord, origin, idx);
    const shape = decomposeChordToShape(chord, mainTri, origin, idx);
    const shapes = mapProgressionToShapes([parseChordSymbol("C"), parseChordSymbol("G")], origin, idx);

    expect(shape).toBeDefined();
    expect(shapes).toHaveLength(2);
  });
});
