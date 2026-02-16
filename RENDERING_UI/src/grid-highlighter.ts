/**
 * Grid Highlighter — mutates existing grid-layer SVG elements to show
 * "playing" state by changing triangle fills, edge strokes, and node
 * circle strokes directly, rather than creating overlay elements.
 *
 * This approach keeps node circles visually on top of triangle fills
 * (since they are rendered later in the same layer) and avoids z-order
 * conflicts between layers.
 */

import type { TriId, TriRef, WindowIndices } from "harmony-core";
import { triVertices, nodeId, edgeId } from "harmony-core";

// --- Color constants (matches shape-renderer.ts / highlight.ts) ---

/** Deep triangle fill for "playing" state — major (Up). */
const ACTIVE_FILL_MAJOR = "#c84646";
/** Deep triangle fill for "playing" state — minor (Down). */
const ACTIVE_FILL_MINOR = "#5082d2";

/** Extension triangle fill — lighter, clearly active. */
const ACTIVE_EXT_FILL_MAJOR = "#d99a9a";
const ACTIVE_EXT_FILL_MINOR = "#9ab5d9";

/** Root node stroke — dark, bold. */
const ROOT_STROKE_MAJOR = "#7a1515";
const ROOT_STROKE_MINOR = "#153a7a";

/** Non-root node stroke — matches edge stroke for visual continuity. */
const NODE_STROKE_MAJOR = "#b05050";
const NODE_STROKE_MINOR = "#5070b0";

/** Active edge stroke — matches non-root node stroke for visual continuity. */
const EDGE_STROKE_MAJOR = "#b05050";
const EDGE_STROKE_MINOR = "#5070b0";

/** Active edge stroke width (world units) — matches non-root node stroke width for continuity. */
const ACTIVE_EDGE_WIDTH = "0.035";

/** Active non-root node stroke width (world units) — matches edge stroke width for continuity. */
const ACTIVE_NODE_WIDTH = "0.035";

/** Active root node stroke width (world units) — bolder than non-root. */
const ACTIVE_ROOT_WIDTH = "0.05";

// --- Types ---

/** Saved attribute state for a single SVG element. */
interface SavedAttrs {
  element: Element;
  attrs: Record<string, string>;
}

/** Handle returned by activate — call deactivate() to restore grid. */
export interface GridHighlightHandle {
  /** Restore all modified grid elements to their original state. */
  deactivate(): void;
}

/** Options for activating a grid highlight on a shape. */
export interface GridHighlightOptions {
  /** The main triangle to highlight with deep fill. Null for dot-only shapes. */
  mainTriId: TriId | null;
  /** Extension triangle IDs to highlight with lighter fill. */
  extTriIds?: readonly TriId[];
  /** The orientation of the main triad (used for color selection). Falls back to "U". */
  orientation?: "U" | "D";
  /** Index of the root vertex within the main triangle (0, 1, or 2). Null if unknown. */
  rootVertexIndex?: number | null;
}

// --- Internal helpers ---

/**
 * Save specified attributes of an element and return a record for later restoration.
 */
function saveAttrs(el: Element, attrNames: string[]): SavedAttrs {
  const attrs: Record<string, string> = {};
  for (const name of attrNames) {
    attrs[name] = el.getAttribute(name) ?? "";
  }
  return { element: el, attrs };
}

/**
 * Restore previously saved attributes on an element.
 */
function restoreAttrs(saved: SavedAttrs): void {
  for (const [name, value] of Object.entries(saved.attrs)) {
    saved.element.setAttribute(name, value);
  }
}

/**
 * Find a grid triangle polygon in the layer by its TriId data-id.
 */
function findTriPolygon(gridLayer: SVGGElement, triId: TriId): SVGPolygonElement | null {
  return gridLayer.querySelector(`polygon[data-id="${triId as string}"]`);
}

/**
 * Find a grid node circle in the layer by its NodeId data-id.
 */
function findNodeCircle(gridLayer: SVGGElement, nid: string): SVGCircleElement | null {
  return gridLayer.querySelector(`circle[data-id="${nid}"]`);
}

/**
 * Find a grid edge line in the layer by its EdgeId data-id.
 */
function findEdgeLine(gridLayer: SVGGElement, eid: string): SVGLineElement | null {
  return gridLayer.querySelector(`line[data-id="${eid}"]`);
}

/**
 * Get the 3 EdgeIds for a triangle's edges, given its TriRef.
 */
function getTriangleEdgeIds(triRef: TriRef): string[] {
  const verts = triVertices(triRef);
  return [
    edgeId(verts[0], verts[1]) as string,
    edgeId(verts[1], verts[2]) as string,
    edgeId(verts[0], verts[2]) as string,
  ];
}

// --- Public API ---

/**
 * Activate a "playing" highlight on grid elements by mutating their fill/stroke
 * attributes directly. Returns a handle whose `deactivate()` restores the originals.
 *
 * Mutates: triangle polygon fills, edge line strokes, and node circle strokes.
 *
 * @param gridLayer The `layer-grid` SVG group containing the static grid elements.
 * @param indices Window indices for triangle vertex lookups.
 * @param options Which triangles to highlight and how.
 */
export function activateGridHighlight(
  gridLayer: SVGGElement,
  indices: WindowIndices,
  options: GridHighlightOptions,
): GridHighlightHandle {
  const saved: SavedAttrs[] = [];
  const savedElements = new Set<Element>();
  const orient = options.orientation ?? "U";
  const isMajor = orient === "U";

  /**
   * Save attributes for an element only if not already saved.
   * Prevents double-save when nodes/edges are shared between triangles.
   */
  function saveOnce(el: Element, attrNames: string[]): boolean {
    if (savedElements.has(el)) return false;
    savedElements.add(el);
    saved.push(saveAttrs(el, attrNames));
    return true;
  }

  // --- Main triangle ---
  if (options.mainTriId !== null) {
    const poly = findTriPolygon(gridLayer, options.mainTriId);
    if (poly) {
      saved.push(saveAttrs(poly, ["fill", "stroke", "stroke-width"]));
      poly.setAttribute("fill", isMajor ? ACTIVE_FILL_MAJOR : ACTIVE_FILL_MINOR);
      poly.setAttribute("stroke", "none");
    }

    const triRef = indices.triIdToRef.get(options.mainTriId);
    if (triRef) {
      // Edge lines
      const eids = getTriangleEdgeIds(triRef);
      for (const eid of eids) {
        const line = findEdgeLine(gridLayer, eid);
        if (line) {
          saveOnce(line, ["stroke", "stroke-width"]);
          line.setAttribute("stroke", isMajor ? EDGE_STROKE_MAJOR : EDGE_STROKE_MINOR);
          line.setAttribute("stroke-width", ACTIVE_EDGE_WIDTH);
        }
      }

      // Vertex node circles
      const verts = triVertices(triRef);
      const rootIdx = options.rootVertexIndex ?? null;

      for (let i = 0; i < 3; i++) {
        const nid = nodeId(verts[i].u, verts[i].v) as string;
        const circle = findNodeCircle(gridLayer, nid);
        if (circle && saveOnce(circle, ["stroke", "stroke-width"])) {
          const isRoot = rootIdx !== null && i === rootIdx;
          if (isRoot) {
            circle.setAttribute("stroke", isMajor ? ROOT_STROKE_MAJOR : ROOT_STROKE_MINOR);
            circle.setAttribute("stroke-width", ACTIVE_ROOT_WIDTH);
          } else {
            circle.setAttribute("stroke", isMajor ? NODE_STROKE_MAJOR : NODE_STROKE_MINOR);
            circle.setAttribute("stroke-width", ACTIVE_NODE_WIDTH);
          }
        }
      }
    }
  }

  // --- Extension triangles ---
  if (options.extTriIds) {
    for (const extId of options.extTriIds) {
      const poly = findTriPolygon(gridLayer, extId);
      if (poly) {
        saved.push(saveAttrs(poly, ["fill", "stroke", "stroke-width"]));
        poly.setAttribute("fill", isMajor ? ACTIVE_EXT_FILL_MAJOR : ACTIVE_EXT_FILL_MINOR);
        poly.setAttribute("stroke", "none");
      }

      const triRef = indices.triIdToRef.get(extId);
      if (triRef) {
        // Edge lines
        const eids = getTriangleEdgeIds(triRef);
        for (const eid of eids) {
          const line = findEdgeLine(gridLayer, eid);
          if (line) {
            saveOnce(line, ["stroke", "stroke-width"]);
            line.setAttribute("stroke", isMajor ? EDGE_STROKE_MAJOR : EDGE_STROKE_MINOR);
            line.setAttribute("stroke-width", ACTIVE_EDGE_WIDTH);
          }
        }

        // Vertex node circles — all get non-root stroke
        const verts = triVertices(triRef);
        for (let i = 0; i < 3; i++) {
          const nid = nodeId(verts[i].u, verts[i].v) as string;
          const circle = findNodeCircle(gridLayer, nid);
          if (circle && saveOnce(circle, ["stroke", "stroke-width"])) {
            circle.setAttribute("stroke", isMajor ? NODE_STROKE_MAJOR : NODE_STROKE_MINOR);
            circle.setAttribute("stroke-width", ACTIVE_NODE_WIDTH);
          }
        }
      }
    }
  }

  return {
    deactivate(): void {
      for (const s of saved) {
        restoreAttrs(s);
      }
      saved.length = 0;
      savedElements.clear();
    },
  };
}

/**
 * Convenience: deactivate a grid highlight handle (null-safe).
 */
export function deactivateGridHighlight(handle: GridHighlightHandle | null): void {
  handle?.deactivate();
}
