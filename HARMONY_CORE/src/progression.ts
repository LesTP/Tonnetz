import type { Chord, NodeCoord, Shape, WindowIndices } from "./types.js";
import { placeMainTriad, decomposeChordToShape, triCentroid } from "./placement.js";

// If the reuse candidate is more than this factor further from the chain focus
// than the proximity candidate, proximity wins. 1.5 = accept up to 50% more
// travel to reuse a prior placement.
const REUSE_THRESHOLD = 1.5;

function dist2(a: NodeCoord, b: NodeCoord): number {
  const du = a.u - b.u;
  const dv = a.v - b.v;
  return du * du + dv * dv;
}

/**
 * Map a chord progression to a sequence of Tonnetz shapes using chain focus (HC-D11).
 *
 * Each chord is placed relative to the previous shape's centroid.
 * The first chord uses initialFocus.
 *
 * When a root PC has been placed before, a distance-gated reuse heuristic
 * compares the reuse candidate (nearest to prior placement) against the
 * proximity candidate (nearest to chain focus). Reuse wins if it is at most
 * REUSE_THRESHOLD× further from the chain focus. This avoids octave jumps
 * for repeated chords (Canon in D) without causing long visual leaps when
 * the progression has moved far from the original placement (Rhythm Changes).
 */
export function mapProgressionToShapes(
  chords: Chord[],
  initialFocus: NodeCoord,
  indices: WindowIndices,
): Shape[] {
  let focus = initialFocus;
  const result: Shape[] = [];
  const placedRoots = new Map<number, NodeCoord>();

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
    focus = shape.centroid_uv;
  }

  return result;
}
