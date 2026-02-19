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

const SQRT3_2 = Math.sqrt(3) / 2;

/**
 * Squared Euclidean distance in world coordinates (equilateral layout).
 * Uses world transform (x = u + v*0.5, y = v * √3/2) so distance
 * matches the visual on screen. Lattice dist2 was subtly wrong —
 * it distorted diagonal distances relative to horizontal ones.
 */
function dist2(a: NodeCoord, b: NodeCoord): number {
  const dx = (a.u - b.u) + (a.v - b.v) * 0.5;
  const dy = (a.v - b.v) * SQRT3_2;
  return dx * dx + dy * dy;
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
 * - Selects nearest to focus (world-coordinate distance); tie-break: lexicographic TriId
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
    // Resolve node positions via GREEDY CHAIN (matches grid-highlighter algorithm).
    // 1. Find root node nearest to focus
    // 2. For each remaining pc, find node nearest to ANY already-placed node
    // This produces the same tight cluster the grid-highlighter displays.
    const SQRT3_2 = Math.sqrt(3) / 2;

    function worldDist2(a: NodeCoord, b: NodeCoord): number {
      const ax = a.u + a.v * 0.5, ay = a.v * SQRT3_2;
      const bx = b.u + b.v * 0.5, by = b.v * SQRT3_2;
      return (ax - bx) ** 2 + (ay - by) ** 2;
    }

    // Collect all nodes grouped by pc for efficient lookup
    const nodesByPc = new Map<number, NodeCoord[]>();
    const targetPcs = new Set(chord.chord_pcs);
    for (const targetPc of targetPcs) {
      nodesByPc.set(targetPc, []);
    }
    for (const nid of indices.nodeToTris.keys()) {
      const coord = parseNodeId(nid);
      const nodePc = pc(coord.u, coord.v);
      const arr = nodesByPc.get(nodePc);
      if (arr) arr.push(coord);
    }

    // Step 1: root node nearest to focus
    let rootCoord: NodeCoord = focus;
    let rootDist = Infinity;
    for (const coord of nodesByPc.get(chord.root_pc) ?? []) {
      const d = worldDist2(coord, focus);
      if (d < rootDist) { rootDist = d; rootCoord = coord; }
    }

    // Step 2: greedy chain — each remaining pc nearest to any placed node
    const placed: NodeCoord[] = [rootCoord];
    const remainingPcs = [...targetPcs].filter((p) => p !== chord.root_pc);

    for (const targetPc of remainingPcs) {
      let bestCoord: NodeCoord = rootCoord;
      let bestDist = Infinity;
      for (const candidate of nodesByPc.get(targetPc) ?? []) {
        // Distance to nearest already-placed node
        for (const p of placed) {
          const d = worldDist2(candidate, p);
          if (d < bestDist) { bestDist = d; bestCoord = candidate; }
        }
      }
      placed.push(bestCoord);
    }

    // Tonal centroid = mean of placed nodes
    let sumU = 0, sumV = 0;
    for (const p of placed) { sumU += p.u; sumV += p.v; }
    const tonalCentroid: NodeCoord = { u: sumU / placed.length, v: sumV / placed.length };

    return {
      chord,
      main_tri: null,
      ext_tris: [],
      dot_pcs: [...chord.chord_pcs],
      covered_pcs: new Set(),
      root_vertex_index: null,
      centroid_uv: rootCoord,
      tonal_centroid_uv: tonalCentroid,
      placed_nodes: placed,
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
  const rootVertex = rootIdx >= 0 ? mainVerts[rootIdx] : clusterCentroid(cluster);

  // Build placed_nodes: all unique cluster vertices + dot node coordinates
  const placedNodes: NodeCoord[] = [];
  for (const tri of cluster) {
    for (const v of triVertices(tri)) {
      if (!placedNodes.some((e) => e.u === v.u && e.v === v.v)) placedNodes.push(v);
    }
  }

  let tonalCentroid: NodeCoord;
  if (dot_pcs.length === 0) {
    // No dots — tonal centroid is just mean of triangle vertices
    let sumU = 0, sumV = 0;
    for (const p of placedNodes) { sumU += p.u; sumV += p.v; }
    tonalCentroid = { u: sumU / placedNodes.length, v: sumV / placedNodes.length };
  } else {
    // Find nearest lattice node for each dot_pc relative to cluster center
    const SQRT3_2 = Math.sqrt(3) / 2;
    const clusterCenter = clusterCentroid(cluster);
    const refWx = clusterCenter.u + clusterCenter.v * 0.5;
    const refWy = clusterCenter.v * SQRT3_2;

    for (const dotPc of dot_pcs) {
      let bestCoord: NodeCoord = clusterCenter;
      let bestDist = Infinity;
      for (const nid of indices.nodeToTris.keys()) {
        const coord = parseNodeId(nid);
        if (pc(coord.u, coord.v) !== dotPc) continue;
        const wx = coord.u + coord.v * 0.5;
        const wy = coord.v * SQRT3_2;
        const d = (wx - refWx) ** 2 + (wy - refWy) ** 2;
        if (d < bestDist) { bestDist = d; bestCoord = coord; }
      }
      if (!placedNodes.some((e) => e.u === bestCoord.u && e.v === bestCoord.v)) {
        placedNodes.push(bestCoord);
      }
    }

    let sumU = 0, sumV = 0;
    for (const p of placedNodes) { sumU += p.u; sumV += p.v; }
    tonalCentroid = { u: sumU / placedNodes.length, v: sumV / placedNodes.length };
  }

  return {
    chord,
    main_tri: mainTri,
    ext_tris,
    dot_pcs,
    covered_pcs: covered,
    root_vertex_index: (rootIdx >= 0 ? rootIdx : null) as 0 | 1 | 2 | null,
    centroid_uv: rootVertex,
    tonal_centroid_uv: tonalCentroid,
    placed_nodes: placedNodes,
  };
}
