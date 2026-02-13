import type { EdgeId, TriRef } from "./types.js";
import { nodeId } from "./coords.js";
import { triVertices } from "./triangles.js";

/**
 * Construct a canonical branded EdgeId from two node coordinates.
 * Lexicographic ordering of NodeId strings ensures canonical form.
 * Format: "E:N:a,b|N:c,d" where "N:a,b" <= "N:c,d"
 */
export function edgeId(
  a: { u: number; v: number },
  b: { u: number; v: number },
): EdgeId {
  const idA = nodeId(a.u, a.v);
  const idB = nodeId(b.u, b.v);
  return (idA <= idB ? `E:${idA}|${idB}` : `E:${idB}|${idA}`) as EdgeId;
}

/**
 * Return the 3 edges of a triangle as canonical EdgeIds.
 * Edge order: [v0-v1, v1-v2, v2-v0]
 */
export function triEdges(tri: TriRef): [EdgeId, EdgeId, EdgeId] {
  const [v0, v1, v2] = triVertices(tri);
  return [edgeId(v0, v1), edgeId(v1, v2), edgeId(v2, v0)];
}
