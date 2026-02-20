import type { Chord, NodeCoord, Shape, WindowIndices } from "./types.js";
import { placeMainTriad, decomposeChordToShape, triCentroid } from "./placement.js";

// If the reuse candidate is more than this factor further from the chain focus
// than the proximity candidate, proximity wins. 1.5 = accept up to 50% more
// travel to reuse a prior placement.
const REUSE_THRESHOLD = 1.5;

// Blend factor between previous-triangle centroid and running cluster center.
// 0 = pure running center (max compactness, lags on modulations)
// 1 = pure chain (follows direction, drifts on zigzags)
// 0.61 = slight chain bias — follows modulations (Blue Bossa Ab→Db) while
// maintaining enough cluster gravity for compact turnarounds (Adagio Cm→D7).
// Not exactly 0.6 to avoid landing on a tie boundary between candidates.
const CHAIN_BLEND = 0.61;

const SQRT3_2 = Math.sqrt(3) / 2;

/** Squared Euclidean distance in world coordinates (equilateral layout). */
function dist2(a: NodeCoord, b: NodeCoord): number {
  const dx = (a.u - b.u) + (a.v - b.v) * 0.5;
  const dy = (a.v - b.v) * SQRT3_2;
  return dx * dx + dy * dy;
}

/**
 * Map a chord progression to a sequence of Tonnetz shapes using chain focus (HC-D11).
 *
 * Chain focus is a blend of two signals:
 * - **Chain momentum** (previous triangle centroid): follows the progression direction
 * - **Cluster gravity** (running mean of all placed centroids): keeps placements compact
 *
 * Blended at CHAIN_BLEND (0.5 = equal weight). This prevents drift caused by
 * the chain centroid alone landing on the far side of the lattice from the
 * cluster, while still tracking directional movement in modulating progressions.
 *
 * The root vertex is stored as shape.centroid_uv for path rendering (POL-D15)
 * but is NOT used for placement focus — it's a corner, not a center.
 *
 * When a root PC has been placed before, a distance-gated reuse heuristic
 * compares the reuse candidate (nearest to prior placement) against the
 * proximity candidate (nearest to chain focus). Reuse wins if it is at most
 * REUSE_THRESHOLD× further from the chain focus.
 */
export function mapProgressionToShapes(
  chords: Chord[],
  initialFocus: NodeCoord,
  indices: WindowIndices,
): Shape[] {
  let focus = initialFocus;
  const result: Shape[] = [];
  const placedRoots = new Map<number, NodeCoord>();

  // Running cluster center: mean of all placed triangle centroids
  let clusterSumU = 0;
  let clusterSumV = 0;
  let clusterCount = 0;

  for (const chord of chords) {
    const priorRoot = placedRoots.get(chord.root_pc);
    let mainTri;

    if (priorRoot) {
      const proximityTri = placeMainTriad(chord, focus, indices);
      const reuseTri = placeMainTriad(chord, priorRoot, indices);

      if (proximityTri && reuseTri) {
        const proxDist = dist2(triCentroid(proximityTri), focus);
        const reuseDist = dist2(triCentroid(reuseTri), focus);
        mainTri = reuseDist <= proxDist * REUSE_THRESHOLD ? reuseTri : proximityTri;
      } else {
        mainTri = proximityTri ?? reuseTri;
      }
    } else {
      mainTri = placeMainTriad(chord, focus, indices);
    }

    const shape = decomposeChordToShape(chord, mainTri, focus, indices);
    result.push(shape);
    if (!placedRoots.has(chord.root_pc)) {
      placedRoots.set(chord.root_pc, shape.centroid_uv);
    }

    // Update chain focus: blend previous-tri centroid with running cluster center
    const prevCentroid = mainTri ? triCentroid(mainTri) : shape.centroid_uv;
    clusterSumU += prevCentroid.u;
    clusterSumV += prevCentroid.v;
    clusterCount++;

    if (clusterCount === 1) {
      // First chord: no cluster history, use tri centroid directly
      focus = prevCentroid;
    } else {
      const clusterCenter: NodeCoord = {
        u: clusterSumU / clusterCount,
        v: clusterSumV / clusterCount,
      };
      focus = {
        u: CHAIN_BLEND * prevCentroid.u + (1 - CHAIN_BLEND) * clusterCenter.u,
        v: CHAIN_BLEND * prevCentroid.v + (1 - CHAIN_BLEND) * clusterCenter.v,
      };
    }
  }

  return result;
}
