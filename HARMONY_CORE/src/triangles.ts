import type { NodeCoord, TriId, TriRef } from "./types.js";
import { pc } from "./coords.js";

/**
 * Construct a branded TriId from a TriRef.
 * Format: "T:U:u,v" or "T:D:u,v"
 */
export function triId(tri: TriRef): TriId {
  return `T:${tri.orientation}:${tri.anchor.u},${tri.anchor.v}` as TriId;
}

/**
 * Compute the three vertices of a triangle (HC-D2).
 *
 * Up triangle (U) at anchor (u,v): (u,v), (u+1,v), (u,v+1)
 * Down triangle (D) at anchor (u,v): (u+1,v+1), (u+1,v), (u,v+1)
 */
export function triVertices(tri: TriRef): [NodeCoord, NodeCoord, NodeCoord] {
  const { u, v } = tri.anchor;
  if (tri.orientation === "U") {
    return [
      { u, v },
      { u: u + 1, v },
      { u, v: v + 1 },
    ];
  }
  return [
    { u: u + 1, v: v + 1 },
    { u: u + 1, v },
    { u, v: v + 1 },
  ];
}

/**
 * Compute the sorted pitch-class set of a triangle's three vertices.
 *
 * Returns a tuple sorted in ascending pc order (0-11). The returned array
 * is newly allocated per call; callers may rely on the sort guarantee but
 * should not mutate the result if immutability is expected elsewhere.
 */
export function getTrianglePcs(tri: TriRef): [number, number, number] {
  const verts = triVertices(tri);
  const pcs = verts.map((c) => pc(c.u, c.v)) as [number, number, number];
  pcs.sort((a, b) => a - b);
  return pcs;
}
