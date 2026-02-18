import type { Chord, NodeCoord, Shape, TriId, TriRef, WindowIndices } from "./types.js";
import { pc } from "./coords.js";
import { parseNodeId } from "./coords.js";
import { triId, triVertices, getTrianglePcs } from "./triangles.js";
import { getAdjacentTriangles } from "./indexing.js";

const MAX_EXT_TRIS = 2;

/**
 * Compute the centroid of a triangle (mean of its 3 vertices).
 */
export function triCentroid(tri: TriRef): NodeCoord {
  const [v0, v1, v2] = triVertices(tri);
  return {
    u: (v0.u + v1.u + v2.u) / 3,
    v: (v0.v + v1.v + v2.v) / 3,
  };
}

/**
 * Squared Euclidean distance between two points.
 */
function dist2(a: NodeCoord, b: NodeCoord): number {
  const du = a.u - b.u;
  const dv = a.v - b.v;
  return du * du + dv * dv;
}

/**
 * Compute centroid as mean of all unique vertices across a set of triangles (HC-D9).
 *
 * Optimization: Uses array with coordinate comparison instead of Map<string, NodeCoord>
 * to avoid string allocation. Cluster sizes are tiny (1–3 triangles, 4–6 unique vertices).
 */
function clusterCentroid(tris: TriRef[]): NodeCoord {
  const verts: NodeCoord[] = [];
  for (const tri of tris) {
    for (const v of triVertices(tri)) {
      if (!verts.some((e) => e.u === v.u && e.v === v.v)) verts.push(v);
    }
  }
  let sumU = 0;
  let sumV = 0;
  for (const v of verts) {
    sumU += v.u;
    sumV += v.v;
  }
  return { u: sumU / verts.length, v: sumV / verts.length };
}

/**
 * Place a chord's main triad on the lattice (HC-D6).
 *
 * - Diminished and augmented triads → null (dot-only path, HC-D5)
 * - Finds candidate triangles via sigToTris
 * - Selects nearest to focus; tie-break: lexicographic TriId
 *
 * Note: main_triad_pcs is in interval order [root, 3rd, 5th], not sorted by pc value.
 * The sort here is required because sigToTris keys are built from getTrianglePcs which sorts.
 */
export function placeMainTriad(
  chord: Chord,
  focus: NodeCoord,
  indices: WindowIndices,
): TriRef | null {
  if (chord.quality === "dim" || chord.quality === "aug") return null;

  const sig = [...chord.main_triad_pcs].sort((a, b) => a - b).join("-");
  const candidates = indices.sigToTris.get(sig);
  if (!candidates || candidates.length === 0) return null;

  let bestId: TriId = candidates[0];
  let bestRef: TriRef = indices.triIdToRef.get(bestId)!;
  let bestDist = dist2(triCentroid(bestRef), focus);

  for (let i = 1; i < candidates.length; i++) {
    const cid = candidates[i];
    const cref = indices.triIdToRef.get(cid)!;
    const cdist = dist2(triCentroid(cref), focus);

    if (cdist < bestDist || (cdist === bestDist && cid < bestId)) {
      bestId = cid;
      bestRef = cref;
      bestDist = cdist;
    }
  }

  return bestRef;
}

/**
 * Decompose a chord into a Tonnetz shape (HC-D7, HC-D9).
 *
 * Triangulated path (maj, min): greedy adjacent-triangle expansion from main_tri.
 * Dot-only path (dim, aug): all chord_pcs as dots, centroid = focus.
 */
export function decomposeChordToShape(
  chord: Chord,
  mainTri: TriRef | null,
  focus: NodeCoord,
  indices: WindowIndices,
): Shape {
  // Dot-only path
  if (mainTri === null) {
    // Centroid = nearest lattice node matching the root pitch class.
    // This places the path marker on the root note (musically intuitive)
    // and aligns with the grid-highlighter's greedy chain anchor.
    const SQRT3_2 = Math.sqrt(3) / 2;
    const focusWx = focus.u + focus.v * 0.5;
    const focusWy = focus.v * SQRT3_2;

    let bestCoord: NodeCoord = focus;
    let bestDist = Infinity;
    for (const nid of indices.nodeToTris.keys()) {
      const coord = parseNodeId(nid);
      if (pc(coord.u, coord.v) !== chord.root_pc) continue;
      const wx = coord.u + coord.v * 0.5;
      const wy = coord.v * SQRT3_2;
      const d = (wx - focusWx) ** 2 + (wy - focusWy) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestCoord = coord;
      }
    }

    return {
      chord,
      main_tri: null,
      ext_tris: [],
      dot_pcs: [...chord.chord_pcs],
      covered_pcs: new Set(),
      root_vertex_index: null,
      centroid_uv: bestCoord,
    };
  }

  // Triangulated path
  const chordPcSet = new Set(chord.chord_pcs);
  const cluster: TriRef[] = [mainTri];
  const clusterIds = new Set<TriId>([triId(mainTri)]);
  const covered = new Set(getTrianglePcs(mainTri));
  const ext_tris: TriRef[] = [];
  const mainCentroid = triCentroid(mainTri);

  for (let round = 0; round < MAX_EXT_TRIS; round++) {
    let bestRef: TriRef | null = null;
    let bestId: TriId | null = null;
    let bestNewCount = 0;
    let bestDist = Infinity;

    // Frontier: adjacents of all triangles in cluster
    for (const tri of cluster) {
      const adjIds = getAdjacentTriangles(tri, indices);
      for (const adjId of adjIds) {
        if (clusterIds.has(adjId)) continue;

        const adjRef = indices.triIdToRef.get(adjId)!;
        const adjPcs = getTrianglePcs(adjRef);

        // All pcs must be subset of chord_pcs
        if (!adjPcs.every((p) => chordPcSet.has(p))) continue;

        // Count new (uncovered) pcs
        const newCount = adjPcs.filter((p) => !covered.has(p)).length;
        if (newCount === 0) continue;

        const d = dist2(triCentroid(adjRef), mainCentroid);

        if (
          newCount > bestNewCount ||
          (newCount === bestNewCount && d < bestDist) ||
          (newCount === bestNewCount && d === bestDist && adjId < bestId!)
        ) {
          bestRef = adjRef;
          bestId = adjId;
          bestNewCount = newCount;
          bestDist = d;
        }
      }
    }

    if (!bestRef || !bestId) break;

    ext_tris.push(bestRef);
    cluster.push(bestRef);
    clusterIds.add(bestId);
    for (const p of getTrianglePcs(bestRef)) {
      covered.add(p);
    }
  }

  const dot_pcs = chord.chord_pcs.filter((p) => !covered.has(p));

  // root_vertex_index: which vertex of main_tri has the root pc
  const mainVerts = triVertices(mainTri);
  const rootIdx = mainVerts.findIndex(
    (v) => pc(v.u, v.v) === chord.root_pc,
  );

  // Centroid = root vertex position (not cluster geometric center).
  // This makes the progression path trace root motion, and is consistent
  // with dot-only shapes which also use the root node position.
  const rootVertex = rootIdx >= 0 ? mainVerts[rootIdx] : clusterCentroid(cluster);

  return {
    chord,
    main_tri: mainTri,
    ext_tris,
    dot_pcs,
    covered_pcs: covered,
    root_vertex_index: (rootIdx >= 0 ? rootIdx : null) as 0 | 1 | 2 | null,
    centroid_uv: rootVertex,
  };
}
