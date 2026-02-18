/**
 * Grid Highlighter — mutates existing grid-layer SVG elements to show
 * "playing" state by changing triangle fills, edge strokes, and node
 * circle strokes directly, rather than creating overlay elements.
 *
 * This approach keeps node circles visually on top of triangle fills
 * (since they are rendered later in the same layer) and avoids z-order
 * conflicts between layers.
 */

import type { TriId, TriRef, WindowIndices, NodeId } from "harmony-core";
import { triVertices, nodeId, edgeId, pc, parseNodeId } from "harmony-core";

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
  /** Pitch classes to highlight as dots (node circles only, no triangle fill). */
  dotPcs?: readonly number[];
  /** Centroid of the shape in lattice coords — used to find nearest dot node. Required when dotPcs is provided. */
  centroid?: { readonly u: number; readonly v: number };
  /** The orientation of the main triad (used for color selection). Falls back to "U". */
  orientation?: "U" | "D";
  /** Index of the root vertex within the main triangle (0, 1, or 2). Null if unknown. */
  rootVertexIndex?: number | null;
  /** Root pitch class (0–11). Used to apply bold root styling on all node types. Preferred over rootVertexIndex. */
  rootPc?: number | null;
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

  /** Track highlighted node IDs (for connecting dot edges to triangle vertices). */
  const highlightedNodeIds = new Set<string>();

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

      // Vertex node circles — use rootPc for uniform root identification
        const verts = triVertices(triRef);
        const rootPcVal = options.rootPc ?? null;

        for (let i = 0; i < 3; i++) {
          const nid = nodeId(verts[i].u, verts[i].v) as string;
          const circle = findNodeCircle(gridLayer, nid);
          if (circle && saveOnce(circle, ["stroke", "stroke-width"])) {
            const isRoot = rootPcVal !== null && pc(verts[i].u, verts[i].v) === rootPcVal;
            highlightedNodeIds.add(nid);
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

        // Vertex node circles — use rootPc for root identification
          const extVerts = triVertices(triRef);
          const extRootPc = options.rootPc ?? null;
          for (let i = 0; i < 3; i++) {
            const nid = nodeId(extVerts[i].u, extVerts[i].v) as string;
            const circle = findNodeCircle(gridLayer, nid);
            if (circle && saveOnce(circle, ["stroke", "stroke-width"])) {
              highlightedNodeIds.add(nid);
              const isRoot = extRootPc !== null && pc(extVerts[i].u, extVerts[i].v) === extRootPc;
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
  }

  // --- Dot pitch classes (nearest node per PC, greedy chain for adjacency) ---
  if (options.dotPcs && options.dotPcs.length > 0 && options.centroid) {
    const SQRT3_2 = Math.sqrt(3) / 2;
    const cx = options.centroid.u + options.centroid.v * 0.5;
    const cy = options.centroid.v * SQRT3_2;

    // Build a map: dotPc → list of candidate nodes with world coords
    const candidates = new Map<number, { nid: string; u: number; v: number; wx: number; wy: number }[]>();
    for (const dotPc of options.dotPcs) {
      const list: { nid: string; u: number; v: number; wx: number; wy: number }[] = [];
      for (const nid of indices.nodeToTris.keys()) {
        const coord = parseNodeId(nid);
        if (pc(coord.u, coord.v) !== dotPc) continue;
        const wx = coord.u + coord.v * 0.5;
        const wy = coord.v * SQRT3_2;
        list.push({ nid: nid as string, u: coord.u, v: coord.v, wx, wy });
      }
      candidates.set(dotPc, list);
    }

    // Greedy chain: pick first dot nearest to centroid, then each subsequent
    // dot nearest to any already-picked node
    const pickedNodes: { nid: string; u: number; v: number; wx: number; wy: number }[] = [];
    const remainingPcs = [...options.dotPcs];

    // First dot: nearest to centroid
    {
      let bestIdx = -1;
      let bestNode: (typeof pickedNodes)[0] | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < remainingPcs.length; i++) {
        for (const node of candidates.get(remainingPcs[i]) ?? []) {
          const dist = (node.wx - cx) ** 2 + (node.wy - cy) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            bestNode = node;
            bestIdx = i;
          }
        }
      }
      if (bestNode && bestIdx >= 0) {
        pickedNodes.push(bestNode);
        remainingPcs.splice(bestIdx, 1);
      }
    }

    // Subsequent dots: nearest to any already-picked node
    while (remainingPcs.length > 0) {
      let bestIdx = -1;
      let bestNode: (typeof pickedNodes)[0] | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < remainingPcs.length; i++) {
        for (const node of candidates.get(remainingPcs[i]) ?? []) {
          let minDist = Infinity;
          for (const picked of pickedNodes) {
            const d = (node.wx - picked.wx) ** 2 + (node.wy - picked.wy) ** 2;
            if (d < minDist) minDist = d;
          }
          if (minDist < bestDist) {
            bestDist = minDist;
            bestNode = node;
            bestIdx = i;
          }
        }
      }
      if (bestNode && bestIdx >= 0) {
        pickedNodes.push(bestNode);
        remainingPcs.splice(bestIdx, 1);
      } else {
        break;
      }
    }

    // Highlight all picked dot nodes (root gets bold styling)
    const rootPc = options.rootPc ?? null;
    for (const node of pickedNodes) {
      const circle = findNodeCircle(gridLayer, node.nid);
      if (circle && saveOnce(circle, ["stroke", "stroke-width"])) {
        highlightedNodeIds.add(node.nid);
        const coord = parseNodeId(node.nid as NodeId);
        const isRoot = rootPc !== null && pc(coord.u, coord.v) === rootPc;
        if (isRoot) {
          circle.setAttribute("stroke", isMajor ? ROOT_STROKE_MAJOR : ROOT_STROKE_MINOR);
          circle.setAttribute("stroke-width", ACTIVE_ROOT_WIDTH);
        } else {
          circle.setAttribute("stroke", isMajor ? NODE_STROKE_MAJOR : NODE_STROKE_MINOR);
          circle.setAttribute("stroke-width", ACTIVE_NODE_WIDTH);
        }
      }
    }

    // Highlight edges connecting picked dot nodes to any highlighted node
    for (const node of pickedNodes) {
      const neighbors = [
        { u: node.u + 1, v: node.v },
        { u: node.u - 1, v: node.v },
        { u: node.u, v: node.v + 1 },
        { u: node.u, v: node.v - 1 },
        { u: node.u - 1, v: node.v + 1 },
        { u: node.u + 1, v: node.v - 1 },
      ];
      for (const nb of neighbors) {
        const nbNid = nodeId(nb.u, nb.v) as string;
        if (highlightedNodeIds.has(nbNid)) {
          const eid = edgeId({ u: node.u, v: node.v }, nb) as string;
          const line = findEdgeLine(gridLayer, eid);
          if (line && saveOnce(line, ["stroke", "stroke-width"])) {
            line.setAttribute("stroke", isMajor ? EDGE_STROKE_MAJOR : EDGE_STROKE_MINOR);
            line.setAttribute("stroke-width", ACTIVE_EDGE_WIDTH);
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
