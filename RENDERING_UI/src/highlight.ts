import type { TriRef, TriId, Shape, WindowIndices } from "harmony-core";
import { triPolygonPoints } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

// --- Visual constants ---

/** Bright highlight fill colors by orientation. */
const HIGHLIGHT_FILL_MAJOR = "rgba(60, 120, 230, 0.65)";
const HIGHLIGHT_FILL_MINOR = "rgba(220, 60, 60, 0.65)";

/** Extension highlight fill (half intensity). */
const HIGHLIGHT_EXT_FILL_MAJOR = "rgba(60, 120, 230, 0.35)";
const HIGHLIGHT_EXT_FILL_MINOR = "rgba(220, 60, 60, 0.35)";

/** Default highlight stroke colors. */
const HIGHLIGHT_STROKE_MAJOR = "rgba(40, 90, 200, 0.9)";
const HIGHLIGHT_STROKE_MINOR = "rgba(200, 40, 40, 0.9)";

/** Default highlight stroke width (world units). */
const DEFAULT_HIGHLIGHT_STROKE_WIDTH = 0.04;

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

// --- Public API ---

/**
 * Highlight a triangle on the interaction layer.
 *
 * Creates a semi-transparent overlay polygon for visual feedback.
 * Returns a handle for clearing the highlight.
 *
 * @param layer The SVG group for highlights (layer-interaction)
 * @param triId The triangle ID to highlight
 * @param indices Window indices for triangle lookup
 * @param style Optional highlight styling
 */
export function highlightTriangle(
  layer: SVGGElement,
  triId: TriId,
  indices: WindowIndices,
  style?: HighlightStyle,
): HighlightHandle {
  const triRef = indices.triIdToRef.get(triId);
  if (!triRef) {
    // Triangle not in current window — return no-op handle
    return { clear: () => {} };
  }

  const poly = createHighlightPolygon(triRef, style ?? {});
  poly.setAttribute("data-tri-id", triId as string);
  layer.appendChild(poly);

  return {
    clear(): void {
      poly.remove();
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
