import type { Shape, TriRef, WindowIndices, NodeCoord } from "harmony-core";
import { triVertices, pc, parseNodeId } from "harmony-core";
import { latticeToWorld, triPolygonPoints } from "./coords.js";
import type { WorldPoint } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

// --- Visual constants ---

/** Main triangle fill color (semi-transparent blue). */
const MAIN_TRI_FILL = "rgba(100, 149, 237, 0.4)";

/** Extension triangle fill color (lighter). */
const EXT_TRI_FILL = "rgba(100, 149, 237, 0.2)";

/** Root vertex marker radius (world units). */
const ROOT_MARKER_RADIUS = 0.12;

/** Root vertex marker fill color. */
const ROOT_MARKER_FILL = "#e63946";

/** Dot cluster dot radius (world units). */
const DOT_RADIUS = 0.1;

/** Dot fill color. */
const DOT_FILL = "#457b9d";

/** Stroke width for triangle fills. */
const TRI_STROKE_WIDTH = 0.02;

/** Triangle stroke color. */
const TRI_STROKE = "rgba(100, 149, 237, 0.8)";

// --- Types ---

/** Handle for clearing a rendered shape. */
export interface ShapeHandle {
  /** Remove all rendered elements for this shape. */
  clear(): void;
}

/** Options for shape rendering. */
export interface ShapeRenderOptions {
  /** Main triangle fill color (default: semi-transparent blue). */
  mainTriFill?: string;
  /** Extension triangle fill color (default: lighter blue). */
  extTriFill?: string;
  /** Root marker fill color (default: red). */
  rootMarkerFill?: string;
  /** Dot fill color (default: blue). */
  dotFill?: string;
  /** Whether to show root marker (default: true). */
  showRootMarker?: boolean;
}

// --- Internal helpers ---

/**
 * Get the world position of a specific vertex of a triangle.
 * @param tri Triangle reference
 * @param vertexIndex 0, 1, or 2
 */
function getTriVertexWorld(tri: TriRef, vertexIndex: 0 | 1 | 2): WorldPoint {
  const verts = triVertices(tri);
  const v = verts[vertexIndex];
  return latticeToWorld(v.u, v.v);
}

/**
 * Find the nearest node in the window that has a given pitch class.
 * Returns the first match found (for MVP simplicity).
 *
 * @param targetPc Pitch class to find (0-11)
 * @param _centroid Shape centroid for proximity (currently unused, uses first match)
 * @param indices Window indices containing nodeToTris
 */
function findNodeForPc(
  targetPc: number,
  _centroid: NodeCoord,
  indices: WindowIndices,
): NodeCoord | null {
  for (const nid of indices.nodeToTris.keys()) {
    const coord = parseNodeId(nid);
    if (coord === null) continue;

    if (pc(coord.u, coord.v) === targetPc) {
      return coord;
    }
  }
  return null;
}

// --- Public API ---

/**
 * Render a Shape object to the chord and dot layers.
 *
 * Creates:
 * - Filled polygon for main_tri (if present)
 * - Filled polygons for ext_tris
 * - Root vertex marker at root_vertex_index position (if present)
 * - Dot circles for dot_pcs
 *
 * Returns a handle for clearing all rendered elements.
 *
 * @param layerChords The SVG group for chord triangles (layer-chords)
 * @param layerDots The SVG group for dot clusters (layer-dots)
 * @param shape The Shape to render
 * @param indices Window indices for node lookups
 * @param options Optional rendering customization
 */
export function renderShape(
  layerChords: SVGGElement,
  layerDots: SVGGElement,
  shape: Shape,
  indices: WindowIndices,
  options?: ShapeRenderOptions,
): ShapeHandle {
  const elements: SVGElement[] = [];

  const mainFill = options?.mainTriFill ?? MAIN_TRI_FILL;
  const extFill = options?.extTriFill ?? EXT_TRI_FILL;
  const rootFill = options?.rootMarkerFill ?? ROOT_MARKER_FILL;
  const dotFill = options?.dotFill ?? DOT_FILL;
  const showRoot = options?.showRootMarker !== false;

  // Use DocumentFragment for batched DOM insertion (avoid multiple reflows)
  const chordFrag = document.createDocumentFragment();
  const dotFrag = document.createDocumentFragment();

  // --- Render main triangle ---
  if (shape.main_tri !== null) {
    const mainPoly = svgEl("polygon", {
      points: triPolygonPoints(shape.main_tri),
      fill: mainFill,
      stroke: TRI_STROKE,
      "stroke-width": TRI_STROKE_WIDTH,
      "data-shape-element": "main-tri",
    });
    chordFrag.appendChild(mainPoly);
    elements.push(mainPoly as SVGElement);
  }

  // --- Render extension triangles ---
  for (const extTri of shape.ext_tris) {
    const extPoly = svgEl("polygon", {
      points: triPolygonPoints(extTri),
      fill: extFill,
      stroke: TRI_STROKE,
      "stroke-width": TRI_STROKE_WIDTH,
      "data-shape-element": "ext-tri",
    });
    chordFrag.appendChild(extPoly);
    elements.push(extPoly as SVGElement);
  }

  // --- Render root vertex marker ---
  if (showRoot && shape.main_tri !== null && shape.root_vertex_index !== null) {
    const rootPos = getTriVertexWorld(shape.main_tri, shape.root_vertex_index);
    const rootMarker = svgEl("circle", {
      cx: rootPos.x,
      cy: rootPos.y,
      r: ROOT_MARKER_RADIUS,
      fill: rootFill,
      "data-shape-element": "root-marker",
    });
    chordFrag.appendChild(rootMarker);
    elements.push(rootMarker as SVGElement);
  }

  // --- Render dot clusters ---
  for (const dotPc of shape.dot_pcs) {
    const nodeCoord = findNodeForPc(dotPc, shape.centroid_uv, indices);
    if (nodeCoord === null) continue;

    const w = latticeToWorld(nodeCoord.u, nodeCoord.v);
    const dot = svgEl("circle", {
      cx: w.x,
      cy: w.y,
      r: DOT_RADIUS,
      fill: dotFill,
      "data-shape-element": "dot",
      "data-pc": dotPc,
    });
    dotFrag.appendChild(dot);
    elements.push(dot as SVGElement);
  }

  // Single DOM insertion per layer (batched)
  layerChords.appendChild(chordFrag);
  layerDots.appendChild(dotFrag);

  return {
    clear(): void {
      for (const el of elements) {
        el.remove();
      }
      elements.length = 0;
    },
  };
}

/**
 * Clear a rendered shape by removing all its elements.
 * Convenience wrapper for handle.clear().
 */
export function clearShape(handle: ShapeHandle): void {
  handle.clear();
}
