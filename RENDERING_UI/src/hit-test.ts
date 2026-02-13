import type { EdgeId, TriId, TriRef, WindowIndices } from "harmony-core";
import { edgeId, triId, triVertices } from "harmony-core";
import { worldToLattice, latticeToWorld } from "./coords.js";
import type { WorldPoint } from "./coords.js";

// --- Result types ---

export interface HitTriangle {
  readonly type: "triangle";
  readonly triId: TriId;
}

export interface HitEdge {
  readonly type: "edge";
  readonly edgeId: EdgeId;
  readonly triIds: [TriId, TriId];
}

export interface HitNone {
  readonly type: "none";
}

export type HitResult = HitTriangle | HitEdge | HitNone;

// --- Proximity radius ---

/**
 * Compute the proximity-circle radius in world units.
 *
 * This function is intentionally trivial: it returns the `factor` directly.
 * Edge length = 1 world unit in the equilateral layout, so `factor` is already
 * in world units. No zoom scaling is needed — the SVG viewBox handles apparent
 * size (per DEVPLAN W5).
 *
 * The function exists as a named semantic entry point and future extension hook
 * if zoom-dependent radius is ever needed.
 *
 * @param factor — fraction of edge length (default 0.5 per UX-D1)
 */
export function computeProximityRadius(factor: number = 0.5): number {
  return factor; // edge length = 1 world unit
}

// --- Constants ---

/**
 * Edge pairs for triangle hit-testing: indices into triVertices result.
 * (0,1), (1,2), (2,0) — matching triVertices / triEdges order.
 * Module-level constant to avoid per-call allocation.
 */
const EDGE_PAIRS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 0],
] as const;

// --- Internal helpers ---

/**
 * Identify the containing triangle from a world-space point.
 *
 * Uses the regular structure of the equilateral lattice: each integer cell
 * (floor(u), floor(v)) contains exactly one Up and one Down triangle.
 * The fractional offsets determine which one:
 *   fu + fv < 1  →  Up triangle at (anchorU, anchorV)
 *   fu + fv >= 1 →  Down triangle at (anchorU, anchorV)
 *
 * Returns null if the triangle is outside the window bounds.
 */
function containingTriRef(
  worldX: number,
  worldY: number,
  indices: WindowIndices,
): TriRef | null {
  const lp = worldToLattice(worldX, worldY);
  const anchorU = Math.floor(lp.u);
  const anchorV = Math.floor(lp.v);
  const fu = lp.u - anchorU;
  const fv = lp.v - anchorV;

  const orientation = fu + fv < 1 ? "U" : "D";
  const tri: TriRef = { orientation, anchor: { u: anchorU, v: anchorV } };

  const id = triId(tri);
  if (!indices.triIdToRef.has(id)) return null;

  return tri;
}

/**
 * Perpendicular distance from point P to the line segment A→B (world coords).
 */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    // Degenerate segment (A === B)
    return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  }
  // Parameter t clamped to [0, 1] to stay on the segment
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// --- Main hit-test ---

/**
 * Determine what the user is pointing at given a world-space position and
 * proximity radius.
 *
 * Algorithm:
 * 1. Identify the containing triangle via the lattice floor trick.
 * 2. For each of the triangle's 3 edges, compute the point-to-segment distance.
 * 3. If the nearest edge is within `radius` AND is a shared interior edge
 *    (2 triangles in edgeToTris), return an edge hit.
 * 4. Otherwise, if a containing triangle was found, return a triangle hit.
 * 5. If outside the lattice window, return none.
 *
 * Node overlap (pointer near a vertex where 3+ triangles meet) is handled as
 * nearest-triangle for MVP — the containing triangle is returned (UX-D1).
 */
export function hitTest(
  worldX: number,
  worldY: number,
  radius: number,
  indices: WindowIndices,
): HitResult {
  const tri = containingTriRef(worldX, worldY, indices);
  if (tri === null) return { type: "none" };

  const id = triId(tri);
  const verts = triVertices(tri);

  // Convert triangle vertices to world coordinates
  const wv: [WorldPoint, WorldPoint, WorldPoint] = [
    latticeToWorld(verts[0].u, verts[0].v),
    latticeToWorld(verts[1].u, verts[1].v),
    latticeToWorld(verts[2].u, verts[2].v),
  ];

  let nearestDist = Infinity;
  let nearestEdgeId: EdgeId | null = null;
  let nearestEdgeTris: TriId[] | null = null;

  for (const [i, j] of EDGE_PAIRS) {
    const dist = pointToSegmentDistance(
      worldX,
      worldY,
      wv[i].x,
      wv[i].y,
      wv[j].x,
      wv[j].y,
    );

    if (dist < nearestDist) {
      const eid = edgeId(verts[i], verts[j]);
      const tris = indices.edgeToTris.get(eid);
      nearestDist = dist;
      nearestEdgeId = eid;
      nearestEdgeTris = tris ?? null;
    }
  }

  // Edge hit: nearest edge is within radius AND is a shared interior edge
  if (
    nearestDist <= radius &&
    nearestEdgeId !== null &&
    nearestEdgeTris !== null &&
    nearestEdgeTris.length >= 2
  ) {
    return {
      type: "edge",
      edgeId: nearestEdgeId,
      triIds: [nearestEdgeTris[0], nearestEdgeTris[1]],
    };
  }

  // Triangle hit (including node-overlap fallback)
  return { type: "triangle", triId: id };
}
