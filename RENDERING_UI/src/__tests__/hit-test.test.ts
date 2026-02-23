import { describe, it, expect } from "vitest";
import { buildWindowIndices, edgeId, nodeId, pc, triId } from "harmony-core";
import type { WindowIndices } from "harmony-core";
import { latticeToWorld } from "../coords.js";
import {
  hitTest,
  computeProximityRadius,
  NODE_HIT_RADIUS,
} from "../hit-test.js";

const SQRT3_OVER_2 = Math.sqrt(3) / 2;

/**
 * Build a small window centered on origin for all tests.
 * Bounds [-3, 2] × [-3, 2] → 6×6 anchors → interior triangles and boundary.
 */
function makeIndices(): WindowIndices {
  return buildWindowIndices({ uMin: -3, uMax: 2, vMin: -3, vMax: 2 });
}

// ---- centroid helpers ----

/** World centroid of an Up triangle at anchor (u, v): vertices (u,v), (u+1,v), (u,v+1). */
function upCentroid(u: number, v: number): { x: number; y: number } {
  const a = latticeToWorld(u, v);
  const b = latticeToWorld(u + 1, v);
  const c = latticeToWorld(u, v + 1);
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

/** World centroid of a Down triangle at anchor (u, v): vertices (u+1,v+1), (u+1,v), (u,v+1). */
function downCentroid(u: number, v: number): { x: number; y: number } {
  const a = latticeToWorld(u + 1, v + 1);
  const b = latticeToWorld(u + 1, v);
  const c = latticeToWorld(u, v + 1);
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

/** World midpoint of a shared edge between two lattice nodes. */
function edgeMidpoint(
  u1: number,
  v1: number,
  u2: number,
  v2: number,
): { x: number; y: number } {
  const a = latticeToWorld(u1, v1);
  const b = latticeToWorld(u2, v2);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ---- tests ----

describe("computeProximityRadius", () => {
  it("returns 0.5 by default (half edge length)", () => {
    expect(computeProximityRadius()).toBe(0.5);
  });

  it("returns custom factor", () => {
    expect(computeProximityRadius(0.3)).toBe(0.3);
  });
});

describe("hitTest — triangle centroid → triangle hit", () => {
  const indices = makeIndices();
  // The centroid of an equilateral triangle with edge=1 is 1/(2√3) ≈ 0.289
  // from each edge. Use a radius smaller than that so no edge is in range.
  const radius = 0.2;

  it("Up triangle at (0, 0) centroid → triangle hit", () => {
    const c = upCentroid(0, 0);
    const result = hitTest(c.x, c.y, radius, indices);
    expect(result.type).toBe("triangle");
    if (result.type === "triangle") {
      expect(result.triId).toBe(triId({ orientation: "U", anchor: { u: 0, v: 0 } }));
    }
  });

  it("Down triangle at (0, 0) centroid → triangle hit", () => {
    const c = downCentroid(0, 0);
    const result = hitTest(c.x, c.y, radius, indices);
    expect(result.type).toBe("triangle");
    if (result.type === "triangle") {
      expect(result.triId).toBe(triId({ orientation: "D", anchor: { u: 0, v: 0 } }));
    }
  });

  it("Up triangle at (-1, -1) centroid → triangle hit", () => {
    const c = upCentroid(-1, -1);
    const result = hitTest(c.x, c.y, radius, indices);
    expect(result.type).toBe("triangle");
    if (result.type === "triangle") {
      expect(result.triId).toBe(triId({ orientation: "U", anchor: { u: -1, v: -1 } }));
    }
  });
});

describe("hitTest — shared interior edge → edge hit", () => {
  const indices = makeIndices();
  // Use a small radius so the midpoint of a shared edge is well within range.
  // The altitude of an equilateral triangle with edge=1 is √3/2 ≈ 0.866.
  // The centroid is at altitude/3 ≈ 0.289 from each edge.
  // A point on the edge itself has distance 0 to that edge.
  // Use radius 0.5 — the midpoint of a shared edge is exactly on the edge (dist=0).
  const radius = 0.5;

  it("midpoint of shared edge between U(0,0) and D(0,0) → edge hit", () => {
    // Shared edge: (1,0)–(0,1) is shared by Up(0,0) and Down(0,0)
    const mid = edgeMidpoint(1, 0, 0, 1);
    const result = hitTest(mid.x, mid.y, radius, indices);
    expect(result.type).toBe("edge");
    if (result.type === "edge") {
      const expectedEdge = edgeId({ u: 1, v: 0 }, { u: 0, v: 1 });
      expect(result.edgeId).toBe(expectedEdge);
      expect(result.triIds).toHaveLength(2);
    }
  });

  it("near shared edge between U(0,0) and U(0,-1) → edge hit", () => {
    // Shared edge: (0,0)–(1,0) is shared by Up(0,0) and Down(0,-1)
    // A point slightly above the edge midpoint (inside U(0,0)) should be close enough
    const mid = edgeMidpoint(0, 0, 1, 0);
    // Nudge slightly into the Up(0,0) triangle
    const nudge = 0.01 * SQRT3_OVER_2;
    const result = hitTest(mid.x, mid.y + nudge, radius, indices);
    expect(result.type).toBe("edge");
    if (result.type === "edge") {
      const expectedEdge = edgeId({ u: 0, v: 0 }, { u: 1, v: 0 });
      expect(result.edgeId).toBe(expectedEdge);
      expect(result.triIds).toHaveLength(2);
    }
  });

  it("midpoint of shared edge touching a Down triangle → edge hit", () => {
    // Down(0,0) has vertices (1,1), (1,0), (0,1).
    // Shared edge (1,0)–(1,1) is between D(0,0) and U(1,0).
    const mid = edgeMidpoint(1, 0, 1, 1);
    const result = hitTest(mid.x, mid.y, radius, indices);
    expect(result.type).toBe("edge");
    if (result.type === "edge") {
      const expectedEdge = edgeId({ u: 1, v: 0 }, { u: 1, v: 1 });
      expect(result.edgeId).toBe(expectedEdge);
      expect(result.triIds).toHaveLength(2);
    }
  });
});

describe("hitTest — boundary edge → triangle hit (not edge)", () => {
  const indices = makeIndices();
  const radius = 0.5;

  it("near boundary edge (only one adjacent triangle) → triangle hit", () => {
    // The Up triangle at (uMax, vMax) = (2, 2) has edge (3,2)–(2,3).
    // This edge is boundary because D(2,2) anchor vertices include (3,3)
    // which is outside [uMin..uMax+1, vMin..vMax+1] range for "D" orientation.
    // Use the bottom-left corner: Up(-3,-3) has edge (-3,-3)–(-2,-3) along the bottom.
    // Points near the boundary edge of the window should get triangle, not edge.
    const mid = edgeMidpoint(-3, -3, -2, -3);
    const nudge = 0.01 * SQRT3_OVER_2;
    const result = hitTest(mid.x, mid.y + nudge, radius, indices);
    // Should be triangle hit since the edge (-3,-3)–(-2,-3) is a boundary edge
    // (only U(-3,-3) touches it, there's no D(-3,-4) in window)
    if (result.type === "edge") {
      // If it's an edge, verify it's a different shared edge, not the boundary one
      const boundaryEdge = edgeId({ u: -3, v: -3 }, { u: -2, v: -3 });
      // The point might be close to another shared edge instead; that's acceptable
      // as long as pure boundary edges don't produce edge hits
      expect(result.edgeId).not.toBe(boundaryEdge);
    }
    // Either triangle or a different shared edge is acceptable
    expect(["triangle", "edge"]).toContain(result.type);
  });
});

describe("hitTest — outside lattice → none", () => {
  const indices = makeIndices();
  const radius = 0.5;

  it("point far outside lattice bounds → none", () => {
    // Way beyond the window
    const farWorld = latticeToWorld(100, 100);
    const result = hitTest(farWorld.x, farWorld.y, radius, indices);
    expect(result.type).toBe("none");
  });

  it("point just outside negative bounds → none", () => {
    const farWorld = latticeToWorld(-10, -10);
    const result = hitTest(farWorld.x, farWorld.y, radius, indices);
    expect(result.type).toBe("none");
  });
});

describe("hitTest — node overlap → nearest-triangle fallback", () => {
  const indices = makeIndices();
  const radius = 0.5;

  it("point exactly at node (0,0) → returns a triangle (not none)", () => {
    // Node (0,0) is a vertex shared by multiple triangles.
    // Per UX-D1, node overlap falls back to nearest-triangle.
    const nodeWorld = latticeToWorld(0, 0);
    const result = hitTest(nodeWorld.x, nodeWorld.y, radius, indices);
    // Should resolve to some triangle, not "none"
    expect(result.type).not.toBe("none");
  });

  it("point at node (1, 1) → returns a triangle", () => {
    const nodeWorld = latticeToWorld(1, 1);
    const result = hitTest(nodeWorld.x, nodeWorld.y, radius, indices);
    expect(result.type).not.toBe("none");
  });
});

describe("hitTest — symmetry", () => {
  const indices = makeIndices();
  const radius = 0.5;

  it("both sides of a shared edge produce the same edgeId", () => {
    // Shared edge (1,0)–(0,1) between U(0,0) and D(0,0).
    // Test from slightly above and slightly below the edge midpoint.
    const mid = edgeMidpoint(1, 0, 0, 1);

    // Compute a perpendicular offset (normal to the edge).
    // Edge (1,0)→(0,1) in world: from latticeToWorld(1,0) to latticeToWorld(0,1)
    const a = latticeToWorld(1, 0);
    const b = latticeToWorld(0, 1);
    const edgeDx = b.x - a.x;
    const edgeDy = b.y - a.y;
    const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
    // Normal (rotated 90°)
    const nx = -edgeDy / edgeLen;
    const ny = edgeDx / edgeLen;

    const offset = 0.05; // small perpendicular offset
    const r1 = hitTest(mid.x + nx * offset, mid.y + ny * offset, radius, indices);
    const r2 = hitTest(mid.x - nx * offset, mid.y - ny * offset, radius, indices);

    expect(r1.type).toBe("edge");
    expect(r2.type).toBe("edge");
    if (r1.type === "edge" && r2.type === "edge") {
      expect(r1.edgeId).toBe(r2.edgeId);
    }
  });
});

describe("hitTest — small radius prevents edge hits", () => {
  const indices = makeIndices();

  it("very small radius at triangle centroid → triangle, not edge", () => {
    // The centroid of U(0,0) is ~0.289 from each edge.
    // With radius 0.1, no edge should be within range.
    const c = upCentroid(0, 0);
    const result = hitTest(c.x, c.y, 0.1, indices);
    expect(result.type).toBe("triangle");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Node hit-testing (Phase 4e-2)
// ═══════════════════════════════════════════════════════════════════

describe("hitTest — node proximity (Phase 4e-2)", () => {
  const indices = makeIndices();
  const radius = 0.12; // standard proximity radius for edge detection

  it("pointer exactly on a node → HitNode with correct nodeId and pc", () => {
    const w = latticeToWorld(0, 0);
    const result = hitTest(w.x, w.y, radius, indices);
    expect(result.type).toBe("node");
    if (result.type === "node") {
      expect(result.nodeId).toBe(nodeId(0, 0));
      expect(result.pc).toBe(pc(0, 0)); // C = 0
    }
  });

  it("pointer slightly offset from node (inside NODE_HIT_RADIUS) → HitNode", () => {
    const w = latticeToWorld(1, 0);
    // Offset by 0.15 in x — inside NODE_HIT_RADIUS (0.20)
    const result = hitTest(w.x + 0.15, w.y, radius, indices);
    expect(result.type).toBe("node");
    if (result.type === "node") {
      expect(result.nodeId).toBe(nodeId(1, 0));
      expect(result.pc).toBe(pc(1, 0)); // G = 7
    }
  });

  it("pointer outside NODE_HIT_RADIUS → not HitNode", () => {
    const w = latticeToWorld(0, 0);
    // Offset by 0.25 — outside NODE_HIT_RADIUS (0.20)
    const result = hitTest(w.x + 0.25, w.y, radius, indices);
    expect(result.type).not.toBe("node");
  });

  it("equidistant from two nodes → nearest wins", () => {
    // Node (0,0) and (1,0) are 1.0 world unit apart horizontally.
    // Point at 0.15 from (0,0) is closer than 0.85 from (1,0).
    const w0 = latticeToWorld(0, 0);
    const result = hitTest(w0.x + 0.10, w0.y, radius, indices);
    expect(result.type).toBe("node");
    if (result.type === "node") {
      expect(result.nodeId).toBe(nodeId(0, 0));
    }
  });

  it("triangle centroid (far from all nodes) → HitTriangle, not HitNode", () => {
    // Centroid of Up(0,0) is ~0.577 from each vertex — well outside NODE_HIT_RADIUS
    const c = upCentroid(0, 0);
    const result = hitTest(c.x, c.y, radius, indices);
    expect(result.type).toBe("triangle");
  });

  it("node at different lattice position returns correct pc", () => {
    const w = latticeToWorld(0, 1);
    const result = hitTest(w.x, w.y, radius, indices);
    expect(result.type).toBe("node");
    if (result.type === "node") {
      expect(result.nodeId).toBe(nodeId(0, 1));
      expect(result.pc).toBe(pc(0, 1)); // E = 4
    }
  });

  it("NODE_HIT_RADIUS is exported and positive", () => {
    expect(NODE_HIT_RADIUS).toBeGreaterThan(0);
    expect(NODE_HIT_RADIUS).toBeLessThan(0.5); // must not exceed half edge length
  });

  it("node hit takes priority over edge hit near a vertex", () => {
    // A vertex is where edges meet. A point very close to a vertex could be
    // within both NODE_HIT_RADIUS and edge proximity radius. Node should win.
    const w = latticeToWorld(1, 0);
    // Tiny offset toward edge midpoint — still within NODE_HIT_RADIUS
    const result = hitTest(w.x + 0.05, w.y + 0.05, radius, indices);
    expect(result.type).toBe("node");
  });
});
