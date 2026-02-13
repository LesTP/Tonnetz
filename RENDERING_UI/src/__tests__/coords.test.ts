import { describe, it, expect } from "vitest";
import { latticeToWorld, worldToLattice, screenToWorld } from "../coords.js";

const SQRT3_OVER_2 = Math.sqrt(3) / 2;
const SQRT3 = Math.sqrt(3);
const EPSILON = 1e-10;

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe("latticeToWorld", () => {
  it("maps origin (0,0) to world origin", () => {
    const p = latticeToWorld(0, 0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it("maps (1,0) to (1, 0) — pure u movement", () => {
    const p = latticeToWorld(1, 0);
    expect(p.x).toBe(1);
    expect(p.y).toBe(0);
  });

  it("maps (0,1) to (0.5, √3/2) — pure v movement", () => {
    const p = latticeToWorld(0, 1);
    expect(p.x).toBeCloseTo(0.5, 10);
    expect(p.y).toBeCloseTo(SQRT3_OVER_2, 10);
  });

  it("maps (1,1) to (1.5, √3/2)", () => {
    const p = latticeToWorld(1, 1);
    expect(p.x).toBeCloseTo(1.5, 10);
    expect(p.y).toBeCloseTo(SQRT3_OVER_2, 10);
  });

  it("maps (0,2) to (1, √3)", () => {
    const p = latticeToWorld(0, 2);
    expect(p.x).toBeCloseTo(1, 10);
    expect(p.y).toBeCloseTo(SQRT3, 10);
  });

  it("handles negative coordinates: (-1,-1)", () => {
    const p = latticeToWorld(-1, -1);
    expect(p.x).toBeCloseTo(-1.5, 10);
    expect(p.y).toBeCloseTo(-SQRT3_OVER_2, 10);
  });
});

describe("equilateral triangle verification", () => {
  it("edge (0,0)→(1,0) has unit length (u-axis)", () => {
    const a = latticeToWorld(0, 0);
    const b = latticeToWorld(1, 0);
    expect(dist(a, b)).toBeCloseTo(1.0, 10);
  });

  it("edge (0,0)→(0,1) has unit length (v-axis)", () => {
    const a = latticeToWorld(0, 0);
    const b = latticeToWorld(0, 1);
    expect(dist(a, b)).toBeCloseTo(1.0, 10);
  });

  it("edge (1,0)→(0,1) has unit length (diagonal)", () => {
    const a = latticeToWorld(1, 0);
    const b = latticeToWorld(0, 1);
    expect(dist(a, b)).toBeCloseTo(1.0, 10);
  });

  it("all three edge lengths are equal — equilateral confirmed", () => {
    const p0 = latticeToWorld(0, 0);
    const p1 = latticeToWorld(1, 0);
    const p2 = latticeToWorld(0, 1);
    const d01 = dist(p0, p1);
    const d02 = dist(p0, p2);
    const d12 = dist(p1, p2);
    expect(d01).toBeCloseTo(d02, 10);
    expect(d01).toBeCloseTo(d12, 10);
  });
});

describe("worldToLattice", () => {
  it("maps world origin back to (0, 0)", () => {
    const p = worldToLattice(0, 0);
    expect(p.u).toBeCloseTo(0, 10);
    expect(p.v).toBeCloseTo(0, 10);
  });

  it("returns fractional values (not rounded)", () => {
    const p = worldToLattice(0.75, SQRT3_OVER_2 * 0.5);
    expect(Number.isInteger(p.u)).toBe(false);
    expect(Number.isInteger(p.v)).toBe(false);
  });
});

describe("round-trip latticeToWorld → worldToLattice", () => {
  const integerCases: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [3, -2],
    [-4, 5],
    [10, 10],
    [-1, -1],
  ];

  for (const [u, v] of integerCases) {
    it(`round-trips (${u}, ${v}) through world and back`, () => {
      const world = latticeToWorld(u, v);
      const back = worldToLattice(world.x, world.y);
      expect(back.u).toBeCloseTo(u, 10);
      expect(back.v).toBeCloseTo(v, 10);
    });
  }
});

describe("round-trip worldToLattice → latticeToWorld", () => {
  const worldCases: [number, number][] = [
    [0, 0],
    [1.5, 0.8],
    [-2.3, 1.1],
    [0.25, SQRT3],
    [10, 10],
  ];

  for (const [x, y] of worldCases) {
    it(`round-trips world (${x}, ${y}) through lattice and back`, () => {
      const lattice = worldToLattice(x, y);
      const back = latticeToWorld(lattice.u, lattice.v);
      expect(back.x).toBeCloseTo(x, 10);
      expect(back.y).toBeCloseTo(y, 10);
    });
  }
});

describe("screenToWorld", () => {
  it("maps top-left corner to viewBox origin", () => {
    const w = screenToWorld(0, 0, 10, 20, 80, 60, 800, 600);
    expect(w.x).toBeCloseTo(10, 10);
    expect(w.y).toBeCloseTo(20, 10);
  });

  it("maps bottom-right corner to viewBox max", () => {
    const w = screenToWorld(800, 600, 10, 20, 80, 60, 800, 600);
    expect(w.x).toBeCloseTo(90, 10);  // 10 + 80
    expect(w.y).toBeCloseTo(80, 10);  // 20 + 60
  });

  it("maps center of screen to center of viewBox", () => {
    const w = screenToWorld(400, 300, 10, 20, 80, 60, 800, 600);
    expect(w.x).toBeCloseTo(50, 10);  // 10 + 40
    expect(w.y).toBeCloseTo(50, 10);  // 20 + 30
  });

  it("identity viewBox maps 1:1 with screen pixels", () => {
    const w = screenToWorld(123, 456, 0, 0, 800, 600, 800, 600);
    expect(w.x).toBeCloseTo(123, 10);
    expect(w.y).toBeCloseTo(456, 10);
  });

  it("zoomed-in viewBox scales correctly", () => {
    // viewBox is 2×2, centered at origin, on a 400×400 screen
    const w = screenToWorld(200, 200, -1, -1, 2, 2, 400, 400);
    expect(w.x).toBeCloseTo(0, 10);  // center → 0
    expect(w.y).toBeCloseTo(0, 10);  // center → 0
  });
});
