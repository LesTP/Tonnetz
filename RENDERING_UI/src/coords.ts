/** Point in world coordinate space (equilateral triangle layout). */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Point in lattice coordinate space (fractional). */
export interface LatticePoint {
  readonly u: number;
  readonly v: number;
}

const SQRT3_OVER_2 = Math.sqrt(3) / 2;

/**
 * Transform lattice coordinates (u, v) to world coordinates (x, y).
 *
 * Uses equilateral triangle layout (RU-D10):
 *   x = u + v * 0.5
 *   y = v * (√3 / 2)
 *
 * Produces equilateral triangles with unit-length edges.
 */
export function latticeToWorld(u: number, v: number): WorldPoint {
  return {
    x: u + v * 0.5,
    y: v * SQRT3_OVER_2,
  };
}

/**
 * Transform world coordinates (x, y) back to lattice coordinates (u, v).
 *
 * Inverse of latticeToWorld. Returns fractional values — rounding
 * to the nearest lattice point is the caller's responsibility.
 */
export function worldToLattice(x: number, y: number): LatticePoint {
  const v = y / SQRT3_OVER_2;
  const u = x - v * 0.5;
  return { u, v };
}
