import { describe, it, expect } from "vitest";
import type { NodeCoord, TriRef, WindowIndices } from "harmony-core";
import { buildWindowIndices, pc, triVertices } from "harmony-core";

describe("scaffolding smoke test", () => {
  it("imports Harmony Core types without error", () => {
    const coord: NodeCoord = { u: 0, v: 0 };
    expect(coord.u).toBe(0);
    expect(coord.v).toBe(0);
  });

  it("imports Harmony Core functions and computes pitch class", () => {
    expect(pc(0, 0)).toBe(0); // C
    expect(pc(1, 0)).toBe(7); // G
    expect(pc(0, 1)).toBe(4); // E
  });

  it("builds window indices from Harmony Core", () => {
    const indices: WindowIndices = buildWindowIndices({
      uMin: 0,
      uMax: 0,
      vMin: 0,
      vMax: 0,
    });
    // 1×1 anchor window: 1 up + 1 down = 2 triangles
    expect(indices.triIdToRef.size).toBe(2);
  });

  it("builds correct triangle count for 2×2 window", () => {
    const indices = buildWindowIndices({
      uMin: 0,
      uMax: 1,
      vMin: 0,
      vMax: 1,
    });
    // 2 anchors per axis × 2 orientations = 8 triangles
    expect(indices.triIdToRef.size).toBe(8);
  });

  it("accesses TriRef and triVertices", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
    const verts = triVertices(tri);
    expect(verts).toHaveLength(3);
  });
});
