import type { Chord, NodeCoord, Shape, WindowIndices } from "./types.js";
import { placeMainTriad, decomposeChordToShape } from "./placement.js";

/**
 * Map a chord progression to a sequence of Tonnetz shapes using chain focus (HC-D11).
 *
 * Each chord is placed relative to the previous shape's centroid.
 * The first chord uses initialFocus.
 */
export function mapProgressionToShapes(
  chords: Chord[],
  initialFocus: NodeCoord,
  indices: WindowIndices,
): Shape[] {
  let focus = initialFocus;
  const result: Shape[] = [];

  for (const chord of chords) {
    const mainTri = placeMainTriad(chord, focus, indices);
    const shape = decomposeChordToShape(chord, mainTri, focus, indices);
    result.push(shape);
    focus = shape.centroid_uv;
  }

  return result;
}
