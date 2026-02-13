/** Lattice node coordinate (integer pair). */
export interface NodeCoord {
  readonly u: number;
  readonly v: number;
}

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
  readonly chord_pcs: number[];
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
