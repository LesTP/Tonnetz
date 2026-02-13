import { describe, it, expect } from "vitest";
import { edgeId, triEdges, parseEdgeId } from "../edges.js";
import type { EdgeId, TriRef } from "../types.js";

describe("edgeId", () => {
  it("is order-independent", () => {
    const ab = edgeId({ u: 0, v: 0 }, { u: 1, v: 0 });
    const ba = edgeId({ u: 1, v: 0 }, { u: 0, v: 0 });
    expect(ab).toBe(ba);
  });

  it("format is E:N:a,b|N:c,d with N:a,b <= N:c,d lexicographically", () => {
    const id = edgeId({ u: 0, v: 0 }, { u: 1, v: 0 });
    expect(id).toBe("E:N:0,0|N:1,0");
  });

  it("handles negative coordinates", () => {
    const id = edgeId({ u: -1, v: 2 }, { u: 0, v: 0 });
    // "N:-1,2" < "N:0,0" lexicographically (- < 0 in ASCII)
    expect(id).toBe("E:N:-1,2|N:0,0");
  });
});

describe("triEdges", () => {
  it("up triangle (0,0) produces 3 edges connecting its 3 vertices", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
    const edges = triEdges(tri);
    expect(edges).toHaveLength(3);
    // Vertices: (0,0), (1,0), (0,1)
    expect(edges).toContain(edgeId({ u: 0, v: 0 }, { u: 1, v: 0 }));
    expect(edges).toContain(edgeId({ u: 1, v: 0 }, { u: 0, v: 1 }));
    expect(edges).toContain(edgeId({ u: 0, v: 1 }, { u: 0, v: 0 }));
  });

  it("down triangle (0,0) produces 3 edges connecting its 3 vertices", () => {
    const tri: TriRef = { orientation: "D", anchor: { u: 0, v: 0 } };
    const edges = triEdges(tri);
    expect(edges).toHaveLength(3);
    // Vertices: (1,1), (1,0), (0,1)
    expect(edges).toContain(edgeId({ u: 1, v: 1 }, { u: 1, v: 0 }));
    expect(edges).toContain(edgeId({ u: 1, v: 0 }, { u: 0, v: 1 }));
    expect(edges).toContain(edgeId({ u: 0, v: 1 }, { u: 1, v: 1 }));
  });

  it("adjacent U and D triangles share exactly one edge", () => {
    // U(0,0) vertices: (0,0), (1,0), (0,1)
    // D(0,0) vertices: (1,1), (1,0), (0,1)
    // Shared edge: (1,0)-(0,1)
    const upEdges = triEdges({ orientation: "U", anchor: { u: 0, v: 0 } });
    const downEdges = triEdges({ orientation: "D", anchor: { u: 0, v: 0 } });
    const shared = upEdges.filter((e) => downEdges.includes(e));
    expect(shared).toHaveLength(1);
    expect(shared[0]).toBe(edgeId({ u: 1, v: 0 }, { u: 0, v: 1 }));
  });

  it("all 3 edges are distinct", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 3, v: -2 } };
    const edges = triEdges(tri);
    const unique = new Set(edges);
    expect(unique.size).toBe(3);
  });
});

describe("parseEdgeId", () => {
  it("round-trips with edgeId for simple coords", () => {
    const id = edgeId({ u: 0, v: 0 }, { u: 1, v: 0 });
    const [a, b] = parseEdgeId(id);
    // Canonical order: "N:0,0" < "N:1,0"
    expect(a.u).toBe(0);
    expect(a.v).toBe(0);
    expect(b.u).toBe(1);
    expect(b.v).toBe(0);
  });

  it("round-trips with edgeId for negative coords", () => {
    const id = edgeId({ u: -1, v: 2 }, { u: 0, v: 0 });
    const [a, b] = parseEdgeId(id);
    expect(a.u).toBe(-1);
    expect(a.v).toBe(2);
    expect(b.u).toBe(0);
    expect(b.v).toBe(0);
  });

  it("parses raw string correctly", () => {
    const [a, b] = parseEdgeId("E:N:3,4|N:5,6" as EdgeId);
    expect(a.u).toBe(3);
    expect(a.v).toBe(4);
    expect(b.u).toBe(5);
    expect(b.v).toBe(6);
  });

  it("preserves canonical order from edgeId", () => {
    // edgeId with reversed args should still produce same canonical order
    const id = edgeId({ u: 5, v: 6 }, { u: 3, v: 4 });
    const [a, b] = parseEdgeId(id);
    // "N:3,4" < "N:5,6" lexicographically
    expect(a.u).toBe(3);
    expect(a.v).toBe(4);
    expect(b.u).toBe(5);
    expect(b.v).toBe(6);
  });
});
