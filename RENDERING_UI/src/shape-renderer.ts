import type { Shape, TriRef, WindowIndices, NodeCoord } from "harmony-core";
import { triVertices, pc, parseNodeId } from "harmony-core";
import { latticeToWorld, triPolygonPoints } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

// --- Visual constants ---

/** Main triangle fill colors by orientation (major=Up=red, minor=Down=blue). */
const MAIN_TRI_FILL_MAJOR = "rgba(220, 60, 60, 0.55)";
const MAIN_TRI_FILL_MINOR = "rgba(60, 120, 230, 0.55)";

/** Extension triangle fill colors (half intensity). */
const EXT_TRI_FILL_MAJOR = "rgba(220, 60, 60, 0.28)";
const EXT_TRI_FILL_MINOR = "rgba(60, 120, 230, 0.28)";

/** Vertex marker radius — matches grid NODE_RADIUS so the ring wraps the node circle. */
const VERTEX_MARKER_RADIUS = 0.15;

/** Vertex marker stroke width (world units). */
const VERTEX_MARKER_STROKE_WIDTH = 0.035;

/** Root vertex outline colors (dark, by orientation). */
const ROOT_OUTLINE_MAJOR = "#8b1a1a";
const ROOT_OUTLINE_MINOR = "#1a3c8b";

/** Non-root vertex outline colors (light, by orientation). */
const VERTEX_OUTLINE_MAJOR = "rgba(220, 60, 60, 0.45)";
const VERTEX_OUTLINE_MINOR = "rgba(60, 120, 230, 0.45)";

/** Dot cluster dot radius (world units). */
const DOT_RADIUS = 0.1;

/** Dot fill color. */
const DOT_FILL = "#457b9d";

/** Stroke width for triangle fills. */
const TRI_STROKE_WIDTH = 0.02;

/** Triangle stroke colors by orientation (major=Up=red, minor=Down=blue). */
const TRI_STROKE_MAJOR = "rgba(200, 40, 40, 0.8)";
const TRI_STROKE_MINOR = "rgba(40, 90, 200, 0.8)";

// --- Helpers for orientation-based colors ---

function mainTriFill(tri: TriRef): string {
  return tri.orientation === "U" ? MAIN_TRI_FILL_MAJOR : MAIN_TRI_FILL_MINOR;
}

function extTriFill(tri: TriRef): string {
  return tri.orientation === "U" ? EXT_TRI_FILL_MAJOR : EXT_TRI_FILL_MINOR;
}

function triStroke(tri: TriRef): string {
  return tri.orientation === "U" ? TRI_STROKE_MAJOR : TRI_STROKE_MINOR;
}

// --- Types ---

/** Handle for clearing a rendered shape. */
export interface ShapeHandle {
  /** Remove all rendered elements for this shape. */
  clear(): void;
}

/** Options for shape rendering. */
export interface ShapeRenderOptions {
  /** Main triangle fill color (default: orientation-based). */
  mainTriFill?: string;
  /** Extension triangle fill color (default: orientation-based, lighter). */
  extTriFill?: string;
  /** Dot fill color (default: blue). */
  dotFill?: string;
  /** Whether to show vertex markers (default: true). */
  showRootMarker?: boolean;
}

// --- Internal helpers ---

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

  const dotFillColor = options?.dotFill ?? DOT_FILL;
  const showRoot = options?.showRootMarker !== false;
  const mainOrientation = shape.main_tri?.orientation ?? "U";

  // Use DocumentFragment for batched DOM insertion (avoid multiple reflows)
  const chordFrag = document.createDocumentFragment();
  const dotFrag = document.createDocumentFragment();

  // --- Render main triangle ---
  if (shape.main_tri !== null) {
    const fill = options?.mainTriFill ?? mainTriFill(shape.main_tri);
    const stroke = triStroke(shape.main_tri);
    const mainPoly = svgEl("polygon", {
      points: triPolygonPoints(shape.main_tri),
      fill,
      stroke,
      "stroke-width": TRI_STROKE_WIDTH,
      "data-shape-element": "main-tri",
    });
    chordFrag.appendChild(mainPoly);
    elements.push(mainPoly as SVGElement);
  }

  // --- Render extension triangles ---
  for (const ext of shape.ext_tris) {
    const fill = options?.extTriFill ?? extTriFill(ext);
    const stroke = triStroke(ext);
    const extPoly = svgEl("polygon", {
      points: triPolygonPoints(ext),
      fill,
      stroke,
      "stroke-width": TRI_STROKE_WIDTH,
      "data-shape-element": "ext-tri",
    });
    chordFrag.appendChild(extPoly);
    elements.push(extPoly as SVGElement);
  }

  // --- Render vertex markers (outline circles at all triangle vertices) ---
  // Main triangle: all vertices with root=dark, others=light outline
  if (showRoot && shape.main_tri !== null) {
    const isMajor = mainOrientation === "U";
    const rootStroke = isMajor ? ROOT_OUTLINE_MAJOR : ROOT_OUTLINE_MINOR;
    const otherStroke = isMajor ? VERTEX_OUTLINE_MAJOR : VERTEX_OUTLINE_MINOR;
    const verts = triVertices(shape.main_tri);

    for (let i = 0; i < 3; i++) {
      const w = latticeToWorld(verts[i].u, verts[i].v);
      const isRoot = shape.root_vertex_index !== null && i === shape.root_vertex_index;
      const marker = svgEl("circle", {
        cx: w.x,
        cy: w.y,
        r: VERTEX_MARKER_RADIUS,
        fill: "none",
        stroke: isRoot ? rootStroke : otherStroke,
        "stroke-width": VERTEX_MARKER_STROKE_WIDTH,
        "data-shape-element": isRoot ? "root-marker" : "vertex-marker",
      });
      chordFrag.appendChild(marker);
      elements.push(marker as SVGElement);
    }

    // Extension triangle vertices — use main triad's color palette
    for (const ext of shape.ext_tris) {
      const extVerts = triVertices(ext);
      for (let i = 0; i < 3; i++) {
        const w = latticeToWorld(extVerts[i].u, extVerts[i].v);
        const marker = svgEl("circle", {
          cx: w.x,
          cy: w.y,
          r: VERTEX_MARKER_RADIUS,
          fill: "none",
          stroke: otherStroke,
          "stroke-width": VERTEX_MARKER_STROKE_WIDTH,
          "data-shape-element": "vertex-marker",
        });
        chordFrag.appendChild(marker);
        elements.push(marker as SVGElement);
      }
    }
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
      fill: dotFillColor,
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
