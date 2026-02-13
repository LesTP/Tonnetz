/**
 * Lattice coordinate pair.
 *
 * Used for both:
 * - Integer lattice node coordinates (u, v ∈ ℤ) for triangle vertices
 * - Fractional centroid coordinates (u, v ∈ ℝ) for shape focus points
 *
 * The same structure serves both purposes for simplicity. Context determines
 * whether integer or fractional values are expected.
 */
export interface NodeCoord {
  readonly u: number;
  readonly v: number;
}

/**
 * Alias for NodeCoord when used as a fractional centroid/focus point.
 * Semantically indicates the coordinate may have non-integer values.
 */
export type CentroidCoord = NodeCoord;

/** Branded string ID for a lattice node. Format: "N:u,v" */
export type NodeId = string & { readonly __brand: "NodeId" };

/** Branded string ID for a triangle. Format: "T:U:u,v" or "T:D:u,v" */
export type TriId = string & { readonly __brand: "TriId" };

/** Branded string ID for an edge. Format: "E:N:a,b|N:c,d" (canonical order) */
export type EdgeId = string & { readonly __brand: "EdgeId" };

/** Triangle orientation. */
export type Orientation = "U" | "D";

/** Triangle reference (orientation + anchor coordinate). */
export interface TriRef {
  readonly orientation: Orientation;
  readonly anchor: NodeCoord;
}

/** Rectangular lattice window bounds. */
export interface WindowBounds {
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
}

/** Precomputed index maps for an active lattice window. */
export interface WindowIndices {
  readonly bounds: WindowBounds;
  readonly edgeToTris: Map<EdgeId, TriId[]>;
  readonly nodeToTris: Map<NodeId, TriId[]>;
  readonly sigToTris: Map<string, TriId[]>;
  readonly triIdToRef: Map<TriId, TriRef>;
}

/** Chord quality. */
export type Quality = "maj" | "min" | "dim" | "aug";

/** Single chord extension (MVP grammar allows at most one). */
export type Extension = "6" | "7" | "maj7" | "add9" | "6/9";

/** Parsed chord structure. */
export interface Chord {
  readonly root_pc: number;
  readonly quality: Quality;
  readonly extension: Extension | null;
  /**
   * Full pitch-class set for the chord.
   * Order: triad intervals (root, 3rd, 5th) followed by extension intervals.
   * Built from Set spread, so insertion order is preserved but NOT sorted by pc value.
   */
  readonly chord_pcs: number[];
  /**
   * Triad pitch classes in interval order: [root, 3rd, 5th].
   * NOT sorted by pc value — preserves the musical interval structure.
   * e.g., Cmaj = [0, 4, 7], Fmaj = [5, 9, 0] (root=F, 3rd=A, 5th=C)
   */
  readonly main_triad_pcs: [number, number, number];
}

/** Decomposed chord shape on the Tonnetz lattice. */
export interface Shape {
  readonly chord: Chord;
  readonly main_tri: TriRef | null;
  readonly ext_tris: TriRef[];
  readonly dot_pcs: number[];
  readonly covered_pcs: ReadonlySet<number>;
  readonly root_vertex_index: 0 | 1 | 2 | null;
  readonly centroid_uv: NodeCoord;
}
