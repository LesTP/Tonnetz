/**
 * Harmony Core — Tonnetz harmonic logic module.
 * Public API surface per ARCH_HARMONY_CORE.md Section 11.
 */

// Types
export type {
  NodeCoord,
  NodeId,
  TriId,
  EdgeId,
  Orientation,
  TriRef,
  WindowBounds,
  WindowIndices,
  Quality,
  Extension,
  Chord,
  Shape,
} from "./types.js";

// Coordinate system
export { pc, parseNodeId } from "./coords.js";

// Node / triangle / edge ID construction (needed by consumers for index lookups)
export { nodeId } from "./coords.js";
export { triId, triVertices, getTrianglePcs } from "./triangles.js";
export { edgeId, parseEdgeId } from "./edges.js";

// Window indexing
export {
  buildWindowIndices,
  getAdjacentTriangles,
  getEdgeUnionPcs,
} from "./indexing.js";

// Chord parsing
export { parseChordSymbol, computeChordPcs } from "./chords.js";

// Placement & decomposition
export { placeMainTriad, decomposeChordToShape } from "./placement.js";

// Progression mapping
export { mapProgressionToShapes } from "./progression.js";
