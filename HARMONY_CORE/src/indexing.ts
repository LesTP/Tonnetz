import type {
  EdgeId,
  NodeId,
  Orientation,
  TriId,
  TriRef,
  WindowBounds,
  WindowIndices,
} from "./types.js";
import { nodeId } from "./coords.js";
import { triId, triVertices, getTrianglePcs } from "./triangles.js";
import { triEdges } from "./edges.js";

const ORIENTATIONS: Orientation[] = ["U", "D"];

/**
 * Build all index maps for a rectangular lattice window.
 *
 * Enumerates every Up and Down triangle whose anchor falls within bounds,
 * then populates edgeToTris, nodeToTris, sigToTris, and triIdToRef.
 */
export function buildWindowIndices(bounds: WindowBounds): WindowIndices {
  const edgeToTris = new Map<EdgeId, TriId[]>();
  const nodeToTris = new Map<NodeId, TriId[]>();
  const sigToTris = new Map<string, TriId[]>();
  const triIdToRef = new Map<TriId, TriRef>();

  for (let u = bounds.uMin; u <= bounds.uMax; u++) {
    for (let v = bounds.vMin; v <= bounds.vMax; v++) {
      for (const orientation of ORIENTATIONS) {
        const tri: TriRef = { orientation, anchor: { u, v } };
        const id = triId(tri);

        triIdToRef.set(id, tri);

        for (const eid of triEdges(tri)) {
          let list = edgeToTris.get(eid);
          if (!list) {
            list = [];
            edgeToTris.set(eid, list);
          }
          list.push(id);
        }

        for (const vert of triVertices(tri)) {
          const nid = nodeId(vert.u, vert.v);
          let list = nodeToTris.get(nid);
          if (!list) {
            list = [];
            nodeToTris.set(nid, list);
          }
          list.push(id);
        }

        const sig = getTrianglePcs(tri).join("-");
        let list = sigToTris.get(sig);
        if (!list) {
          list = [];
          sigToTris.set(sig, list);
        }
        list.push(id);
      }
    }
  }

  return { bounds, edgeToTris, nodeToTris, sigToTris, triIdToRef };
}

/**
 * Return all triangles sharing an edge with the given triangle.
 * Uses the edgeToTris index for O(1) lookup per edge.
 */
export function getAdjacentTriangles(
  tri: TriRef,
  indices: WindowIndices,
): TriId[] {
  const selfId = triId(tri);
  const seen = new Set<TriId>();

  for (const eid of triEdges(tri)) {
    const neighbours = indices.edgeToTris.get(eid);
    if (!neighbours) continue;
    for (const tid of neighbours) {
      if (tid !== selfId) {
        seen.add(tid);
      }
    }
  }

  return [...seen];
}

/**
 * Compute the union of pitch classes of the two triangles sharing an edge (HC-D10).
 * Returns null for boundary edges (shared by only one triangle).
 */
export function getEdgeUnionPcs(
  eid: EdgeId,
  indices: WindowIndices,
): number[] | null {
  const tris = indices.edgeToTris.get(eid);
  if (!tris || tris.length < 2) return null;

  const refA = indices.triIdToRef.get(tris[0])!;
  const refB = indices.triIdToRef.get(tris[1])!;
  const pcsA = getTrianglePcs(refA);
  const pcsB = getTrianglePcs(refB);

  const union = new Set([...pcsA, ...pcsB]);
  return [...union].sort((a, b) => a - b);
}
