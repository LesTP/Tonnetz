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
