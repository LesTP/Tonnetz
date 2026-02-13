import { describe, it, expect } from "vitest";
import { triId, triVertices, getTrianglePcs } from "../triangles.js";
import { pc } from "../coords.js";
import type { TriRef } from "../types.js";

describe("triId", () => {
  it('triId U at (2,3) = "T:U:2,3"', () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 2, v: 3 } };
    expect(triId(tri)).toBe("T:U:2,3");
  });

  it('triId D at (-1,0) = "T:D:-1,0"', () => {
    const tri: TriRef = { orientation: "D", anchor: { u: -1, v: 0 } };
    expect(triId(tri)).toBe("T:D:-1,0");
  });
});

describe("triVertices", () => {
  it("up triangle (0,0): vertices (0,0), (1,0), (0,1)", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
    const verts = triVertices(tri);
    expect(verts).toEqual([
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 0, v: 1 },
    ]);
  });

  it("down triangle (0,0): vertices (1,1), (1,0), (0,1)", () => {
    const tri: TriRef = { orientation: "D", anchor: { u: 0, v: 0 } };
    const verts = triVertices(tri);
    expect(verts).toEqual([
      { u: 1, v: 1 },
      { u: 1, v: 0 },
      { u: 0, v: 1 },
    ]);
  });
});

describe("getTrianglePcs", () => {
  it("up triangle (0,0) → sorted [0, 4, 7] (C major)", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
    expect(getTrianglePcs(tri)).toEqual([0, 4, 7]);
  });

  it("down triangle (0,0) → sorted [4, 7, 11] (E minor)", () => {
    const tri: TriRef = { orientation: "D", anchor: { u: 0, v: 0 } };
    expect(getTrianglePcs(tri)).toEqual([4, 7, 11]);
  });

  it("returns exactly 3 pitch classes, each in 0..11", () => {
    const cases: TriRef[] = [
      { orientation: "U", anchor: { u: 0, v: 0 } },
      { orientation: "D", anchor: { u: 0, v: 0 } },
      { orientation: "U", anchor: { u: -2, v: 3 } },
      { orientation: "D", anchor: { u: 5, v: -1 } },
    ];
    for (const tri of cases) {
      const pcs = getTrianglePcs(tri);
      expect(pcs).toHaveLength(3);
      for (const p of pcs) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(12);
      }
    }
  });

  it("triangle pcs match individual node pcs", () => {
    const tri: TriRef = { orientation: "U", anchor: { u: 2, v: 1 } };
    const verts = triVertices(tri);
    const expected = verts.map((c) => pc(c.u, c.v)).sort((a, b) => a - b);
    expect(getTrianglePcs(tri)).toEqual(expected);
  });
});
