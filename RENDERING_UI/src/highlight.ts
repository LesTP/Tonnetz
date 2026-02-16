import type { TriRef, TriId, Shape, WindowIndices } from "harmony-core";
import { triVertices } from "harmony-core";
import { triPolygonPoints, latticeToWorld } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

// --- Visual constants ---

/** Bright highlight fill colors by orientation — rich, nearly-opaque for "playing" state (matches shape-renderer). */
const HIGHLIGHT_FILL_MAJOR = "rgba(200, 70, 70, 0.82)";
const HIGHLIGHT_FILL_MINOR = "rgba(80, 130, 210, 0.82)";

/** Extension highlight fill (lighter but clearly active, matches shape-renderer). */
const HIGHLIGHT_EXT_FILL_MAJOR = "rgba(200, 70, 70, 0.45)";
const HIGHLIGHT_EXT_FILL_MINOR = "rgba(80, 130, 210, 0.45)";

/** Default highlight stroke colors — dark, saturated for "playing" state (matches shape-renderer). */
const HIGHLIGHT_STROKE_MAJOR = "rgba(160, 30, 30, 0.9)";
const HIGHLIGHT_STROKE_MINOR = "rgba(30, 70, 170, 0.9)";

/** Default highlight stroke width (world units). */
const DEFAULT_HIGHLIGHT_STROKE_WIDTH = 0.04;

/** Vertex marker radius — matches grid NODE_RADIUS so the ring wraps the node circle. */
const VERTEX_MARKER_RADIUS = 0.15;

/** Vertex marker stroke width (world units). */
const VERTEX_MARKER_STROKE_WIDTH = 0.035;

/** Root vertex outline colors (dark, bold, by orientation). */
const ROOT_OUTLINE_MAJOR = "#7a1515";
const ROOT_OUTLINE_MINOR = "#153a7a";

/** Non-root vertex outline colors (medium, by orientation). */
const VERTEX_OUTLINE_MAJOR = "rgba(200, 70, 70, 0.6)";
const VERTEX_OUTLINE_MINOR = "rgba(80, 130, 210, 0.6)";

// --- Types ---

/** Handle for clearing a highlight. */
export interface HighlightHandle {
  /** Remove the highlight elements. */
  clear(): void;
}

/** Style options for highlights. */
export interface HighlightStyle {
  /** Fill color (default: semi-transparent gold). */
  fill?: string;
  /** Stroke color (default: gold). */
  stroke?: string;
  /** Stroke width in world units (default: 0.04). */
  strokeWidth?: number;
}

// --- Internal helpers ---

/**
 * Create a highlight polygon element for a triangle.
 */
function createHighlightPolygon(
  tri: TriRef,
  style: HighlightStyle,
  isExtension: boolean = false,
): SVGPolygonElement {
  const isMajor = tri.orientation === "U";
  const defaultFill = isExtension
    ? (isMajor ? HIGHLIGHT_EXT_FILL_MAJOR : HIGHLIGHT_EXT_FILL_MINOR)
    : (isMajor ? HIGHLIGHT_FILL_MAJOR : HIGHLIGHT_FILL_MINOR);
  const defaultStroke = isMajor ? HIGHLIGHT_STROKE_MAJOR : HIGHLIGHT_STROKE_MINOR;

  const fill = style.fill ?? defaultFill;
  const stroke = style.stroke ?? defaultStroke;
  const strokeWidth = style.strokeWidth ?? DEFAULT_HIGHLIGHT_STROKE_WIDTH;

  const poly = svgEl("polygon", {
    points: triPolygonPoints(tri),
    fill,
    stroke,
    "stroke-width": strokeWidth,
    "data-highlight": "true",
  }) as SVGPolygonElement;

  return poly;
}

/**
 * Determine the root vertex index for a triangle.
 * Up (major): root at vertex 0 (anchor). Down (minor): root at vertex 2.
 */
function rootVertexIndex(orientation: "U" | "D"): 0 | 2 {
  return orientation === "U" ? 0 : 2;
}

/**
 * Create outline circles at all three vertices of a triangle.
 * Root vertex gets a dark stroke; the other two get a lighter stroke.
 * All circles are stroke-only (transparent fill) so node labels remain visible.
 *
 * @param tri The triangle reference
 * @param colorOrientation Orientation used to pick colors (override for extension triangles
 *        so they match the main triad's palette).
 */
function createVertexMarkers(
  tri: TriRef,
  colorOrientation?: "U" | "D",
): SVGCircleElement[] {
  const orient = colorOrientation ?? tri.orientation;
  const isMajor = orient === "U";
  const rootStroke = isMajor ? ROOT_OUTLINE_MAJOR : ROOT_OUTLINE_MINOR;
  const otherStroke = isMajor ? VERTEX_OUTLINE_MAJOR : VERTEX_OUTLINE_MINOR;

  const verts = triVertices(tri);
  const rootIdx = rootVertexIndex(tri.orientation);

  const circles: SVGCircleElement[] = [];
  for (let i = 0; i < 3; i++) {
    const w = latticeToWorld(verts[i].u, verts[i].v);
    const isRoot = i === rootIdx;
    circles.push(
      svgEl("circle", {
        cx: w.x,
        cy: w.y,
        r: VERTEX_MARKER_RADIUS,
        fill: "none",
        stroke: isRoot ? rootStroke : otherStroke,
        "stroke-width": VERTEX_MARKER_STROKE_WIDTH,
        "data-highlight": "true",
        "data-highlight-element": isRoot ? "root-marker" : "vertex-marker",
      }) as SVGCircleElement,
    );
  }
  return circles;
}

// --- Public API ---

/**
 * Highlight a triangle on the interaction layer.
 *
 * Creates a semi-transparent overlay polygon with outline circles at each
 * vertex (dark outline at root, lighter at other two vertices).
 * Returns a handle for clearing the highlight.
 *
 * @param layer The SVG group for highlights (layer-interaction)
 * @param triId The triangle ID to highlight
 * @param indices Window indices for triangle lookup
 * @param style Optional highlight styling
 * @param colorOrientation Override orientation for color selection (used by
 *        extension triangles so their markers match the main triad palette)
 */
export function highlightTriangle(
  layer: SVGGElement,
  triId: TriId,
  indices: WindowIndices,
  style?: HighlightStyle,
  colorOrientation?: "U" | "D",
): HighlightHandle {
  const triRef = indices.triIdToRef.get(triId);
  if (!triRef) {
    return { clear: () => {} };
  }

  const elements: SVGElement[] = [];

  const isExt = colorOrientation !== undefined;
  const poly = createHighlightPolygon(triRef, style ?? {}, isExt);
  poly.setAttribute("data-tri-id", triId as string);
  layer.appendChild(poly);
  elements.push(poly);

  const markers = createVertexMarkers(triRef, colorOrientation);
  for (const m of markers) {
    layer.appendChild(m);
    elements.push(m);
  }

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
 * Highlight an entire Shape (main triangle + extension triangles).
 *
 * Creates overlay polygons for all triangles in the shape.
 * Returns a handle for clearing all highlights.
 *
 * @param layer The SVG group for highlights (layer-interaction)
 * @param shape The Shape to highlight
 * @param indices Window indices (for consistency, not currently used)
 * @param style Optional highlight styling
 */
export function highlightShape(
  layer: SVGGElement,
  shape: Shape,
  _indices: WindowIndices,
  style?: HighlightStyle,
): HighlightHandle {
  const elements: SVGElement[] = [];

  // Highlight main triangle if present
  if (shape.main_tri !== null) {
    const poly = createHighlightPolygon(shape.main_tri, style ?? {});
    poly.setAttribute("data-highlight-element", "main-tri");
    layer.appendChild(poly);
    elements.push(poly);
  }

  // Highlight extension triangles
  for (const extTri of shape.ext_tris) {
    const poly = createHighlightPolygon(extTri, style ?? {}, true);
    poly.setAttribute("data-highlight-element", "ext-tri");
    layer.appendChild(poly);
    elements.push(poly);
  }

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
 * Clear a specific highlight.
 * Convenience wrapper for handle.clear().
 */
export function clearHighlight(handle: HighlightHandle): void {
  handle.clear();
}

/**
 * Clear all highlights from a layer.
 *
 * Removes all elements with `data-highlight="true"` attribute.
 *
 * @param layer The SVG group to clear highlights from
 */
export function clearAllHighlights(layer: SVGGElement): void {
  const highlights = layer.querySelectorAll("[data-highlight='true']");
  for (const el of highlights) {
    el.remove();
  }
}
