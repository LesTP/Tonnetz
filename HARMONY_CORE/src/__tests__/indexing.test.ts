import { describe, it, expect } from "vitest";
import {
  buildWindowIndices,
  getAdjacentTriangles,
  getEdgeUnionPcs,
} from "../indexing.js";
import { triId, getTrianglePcs } from "../triangles.js";
import { edgeId, triEdges } from "../edges.js";
import { nodeId } from "../coords.js";
import type { TriRef, WindowBounds } from "../types.js";

describe("buildWindowIndices", () => {
  it("1×1 window produces exactly 2 triangles (one U, one D)", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 0, vMin: 0, vMax: 0 });
    expect(idx.triIdToRef.size).toBe(2);
    expect(idx.triIdToRef.has(triId({ orientation: "U", anchor: { u: 0, v: 0 } }))).toBe(true);
    expect(idx.triIdToRef.has(triId({ orientation: "D", anchor: { u: 0, v: 0 } }))).toBe(true);
  });

  it("2×2 window produces 8 triangles", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 });
    expect(idx.triIdToRef.size).toBe(8);
  });

  it("edgeToTris: shared internal edges map to exactly 2 triangles", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 2, vMin: 0, vMax: 2 });
    // Edge between U(0,0) and D(0,0) is shared: vertices (1,0)-(0,1)
    // This edge is internal in a 3×3 window
    let foundInternal = false;
    for (const [, tris] of idx.edgeToTris) {
      if (tris.length === 2) {
        foundInternal = true;
        break;
      }
    }
    expect(foundInternal).toBe(true);
  });

  it("edgeToTris: boundary edges map to exactly 1 triangle", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 0, vMin: 0, vMax: 0 });
    let foundBoundary = false;
    for (const [, tris] of idx.edgeToTris) {
      if (tris.length === 1) {
        foundBoundary = true;
        break;
      }
    }
    expect(foundBoundary).toBe(true);
  });

  it("nodeToTris: corner node maps to fewer triangles than center node", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 2, vMin: 0, vMax: 2 });
    const cornerCount = idx.nodeToTris.get(nodeId(0, 0))?.length ?? 0;
    const centerCount = idx.nodeToTris.get(nodeId(1, 1))?.length ?? 0;
    expect(cornerCount).toBeLessThan(centerCount);
  });

  it('sigToTris: C major signature "0-4-7" maps to triangles with those pcs', () => {
    const idx = buildWindowIndices({ uMin: -2, uMax: 2, vMin: -2, vMax: 2 });
    const cMajTris = idx.sigToTris.get("0-4-7");
    expect(cMajTris).toBeDefined();
    expect(cMajTris!.length).toBeGreaterThan(0);
    for (const tid of cMajTris!) {
      const ref = idx.triIdToRef.get(tid)!;
      expect(getTrianglePcs(ref)).toEqual([0, 4, 7]);
    }
  });

  it("every triangle in window appears in all three indices", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 });

    for (const [tid, ref] of idx.triIdToRef) {
      // Must appear in nodeToTris for each of its vertices
      let foundInNodes = false;
      for (const [, tris] of idx.nodeToTris) {
        if (tris.includes(tid)) {
          foundInNodes = true;
          break;
        }
      }
      expect(foundInNodes).toBe(true);

      // Must appear in edgeToTris for each of its edges
      let foundInEdges = false;
      for (const [, tris] of idx.edgeToTris) {
        if (tris.includes(tid)) {
          foundInEdges = true;
          break;
        }
      }
      expect(foundInEdges).toBe(true);

      // Must appear in sigToTris
      const sig = getTrianglePcs(ref).join("-");
      const sigList = idx.sigToTris.get(sig);
      expect(sigList).toBeDefined();
      expect(sigList).toContain(tid);
    }
  });

  it("stores bounds for reference", () => {
    const bounds: WindowBounds = { uMin: -1, uMax: 3, vMin: -2, vMax: 4 };
    const idx = buildWindowIndices(bounds);
    expect(idx.bounds).toEqual(bounds);
  });

  it("triIdToRef allows reverse lookup from TriId to TriRef", () => {
    const idx = buildWindowIndices({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 });
    for (const [tid, ref] of idx.triIdToRef) {
      expect(triId(ref)).toBe(tid);
    }
  });

  it("no edgeToTris entry has more than 2 triangles", () => {
    const idx = buildWindowIndices({ uMin: -3, uMax: 3, vMin: -3, vMax: 3 });
    for (const [, tris] of idx.edgeToTris) {
      expect(tris.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("getEdgeUnionPcs", () => {
  const idx = buildWindowIndices({ uMin: -1, uMax: 3, vMin: -1, vMax: 3 });

  it("shared edge between C major U(0,0) and E minor D(0,0) → union {0, 4, 7, 11}", () => {
    // Shared edge: (1,0)-(0,1)
    const eid = edgeId({ u: 1, v: 0 }, { u: 0, v: 1 });
    const union = getEdgeUnionPcs(eid, idx);
    expect(union).toEqual([0, 4, 7, 11]);
  });

  it("union contains exactly the pcs of both triangles, no duplicates", () => {
    // Pick an arbitrary internal edge
    for (const [eid, tris] of idx.edgeToTris) {
      if (tris.length !== 2) continue;
      const refA = idx.triIdToRef.get(tris[0])!;
      const refB = idx.triIdToRef.get(tris[1])!;
      const pcsA = getTrianglePcs(refA);
      const pcsB = getTrianglePcs(refB);
      const expected = [...new Set([...pcsA, ...pcsB])].sort((a, b) => a - b);

      const union = getEdgeUnionPcs(eid, idx);
      expect(union).toEqual(expected);
      break;
    }
  });

  it("shared pcs appear only once in result", () => {
    const eid = edgeId({ u: 1, v: 0 }, { u: 0, v: 1 });
    const union = getEdgeUnionPcs(eid, idx)!;
    const unique = new Set(union);
    expect(unique.size).toBe(union.length);
  });

  it("boundary edge returns null", () => {
    // In a 1×1 window, most edges are boundary
    const small = buildWindowIndices({ uMin: 0, uMax: 0, vMin: 0, vMax: 0 });
    let foundNull = false;
    for (const [eid, tris] of small.edgeToTris) {
      if (tris.length === 1) {
        expect(getEdgeUnionPcs(eid, small)).toBeNull();
        foundNull = true;
        break;
      }
    }
    expect(foundNull).toBe(true);
  });

  it("result is sorted", () => {
    for (const [eid, tris] of idx.edgeToTris) {
      if (tris.length !== 2) continue;
      const union = getEdgeUnionPcs(eid, idx)!;
      for (let i = 1; i < union.length; i++) {
        expect(union[i]).toBeGreaterThan(union[i - 1]);
      }
      break;
    }
  });
});

describe("getAdjacentTriangles", () => {
  const idx = buildWindowIndices({ uMin: -1, uMax: 3, vMin: -1, vMax: 3 });

  it("interior up triangle has exactly 3 adjacent triangles", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 1, v: 1 } };
    const adj = getAdjacentTriangles(tri, idx);
    expect(adj).toHaveLength(3);
  });

  it("interior down triangle has exactly 3 adjacent triangles", () => {
    const tri: TriRef = { orientation: "D", anchor: { u: 1, v: 1 } };
    const adj = getAdjacentTriangles(tri, idx);
    expect(adj).toHaveLength(3);
  });

  it("triangle at window boundary has fewer than 3 adjacents", () => {
    // Use a small window so boundary triangles exist
    const small = buildWindowIndices({ uMin: 0, uMax: 0, vMin: 0, vMax: 0 });
    // U(0,0) has 2 edges on the boundary (only the hypotenuse is shared with D(0,0))
    const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
    const adj = getAdjacentTriangles(tri, small);
    expect(adj.length).toBeLessThan(3);
  });

  it("a triangle is never adjacent to itself", () => {
    for (const [, ref] of idx.triIdToRef) {
      const adj = getAdjacentTriangles(ref, idx);
      const selfId = triId(ref);
      expect(adj).not.toContain(selfId);
    }
  });

  it("adjacent triangles share exactly one edge", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 1, v: 1 } };
    const adj = getAdjacentTriangles(tri, idx);
    const triEdgeSet = new Set(triEdges(tri));

    for (const adjId of adj) {
      const adjRef = idx.triIdToRef.get(adjId)!;
      const adjEdgeList = triEdges(adjRef);
      const shared = adjEdgeList.filter((e) => triEdgeSet.has(e));
      expect(shared).toHaveLength(1);
    }
  });
});
