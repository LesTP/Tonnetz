import type {
  WindowIndices,
  NodeCoord,
} from "harmony-core";
import { triVertices, pc, nodeId, parseNodeId, parseEdgeId } from "harmony-core";
import type { WorldPoint } from "./coords.js";
import { latticeToWorld } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

/** Pitch-class name lookup table (index 0–11). */
const PC_NAMES: readonly string[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/** Layer IDs matching ARCH_RENDERING_UI §2 (RU-D12). */
export const LAYER_IDS = [
  "layer-grid",
  "layer-chords",
  "layer-dots",
  "layer-path",
  "layer-interaction",
] as const;

export type LayerId = (typeof LAYER_IDS)[number];

/** Return type from createSvgScaffold. */
export interface SvgScaffold {
  readonly svg: SVGSVGElement;
  readonly layers: Readonly<Record<LayerId, SVGGElement>>;
}

/** Visual sizing constants (world units, where edge length = 1). */
const NODE_RADIUS = 0.15;
const LABEL_FONT_SIZE = 0.18;
const EDGE_STROKE_WIDTH = 0.02;
const TRI_STROKE_WIDTH = 0.01;
const NODE_STROKE_WIDTH = 0.015;

/** Color constants for the grid. */
const GRID_EDGE_COLOR = "#ccc";
const GRID_TRI_STROKE = "#d0d0d0";
const NODE_FILL = "#e8e8e8";
const NODE_STROKE = "#bbb";
const LABEL_COLOR = "#111";

/** Pale background tints for major (Up) and minor (Down) triangles. */
const MAJOR_TRI_FILL = "rgba(180, 200, 240, 0.25)";
const MINOR_TRI_FILL = "rgba(240, 185, 185, 0.25)";

/**
 * Create the root SVG scaffold with 5 layered `<g>` groups (RU-D12).
 *
 * The SVG is appended to `container`. The viewBox should be set
 * separately via the camera module.
 */
export function createSvgScaffold(container: Element): SvgScaffold {
  const svg = svgEl("svg", {
    width: "100%",
    height: "100%",
  }) as SVGSVGElement;

  const layers = {} as Record<LayerId, SVGGElement>;
  for (const id of LAYER_IDS) {
    const g = svgEl("g", { id }) as SVGGElement;
    svg.appendChild(g);
    layers[id] = g;
  }

  container.appendChild(svg);

  return { svg, layers: layers as Readonly<Record<LayerId, SVGGElement>> };
}

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

/**
 * Build a pre-computed map of NodeId → WorldPoint for all nodes in the window.
 * Avoids redundant latticeToWorld calls for shared vertices.
 */
function buildWorldPointCache(
  indices: WindowIndices,
): Map<string, WorldPoint> {
  const cache = new Map<string, WorldPoint>();
  for (const nid of indices.nodeToTris.keys()) {
    const coord = parseNodeId(nid);
    cache.set(nid as string, latticeToWorld(coord.u, coord.v));
  }
  return cache;
}

/**
 * Format a polygon `points` attribute from vertex NodeCoords,
 * using the pre-computed WorldPoint cache.
 */
function polygonPoints(
  coords: NodeCoord[],
  cache: Map<string, WorldPoint>,
): string {
  return coords
    .map((c) => {
      const key = nodeId(c.u, c.v) as string;
      const w = cache.get(key) ?? latticeToWorld(c.u, c.v);
      return `${w.x},${w.y}`;
    })
    .join(" ");
}

/**
 * Render the static lattice grid into the given layer group.
 *
 * Draws:
 * - `<polygon>` outlines for each triangle (transparent fill)
 * - `<line>` for each unique edge (explicit, via edgeToTris keys)
 * - `<circle>` + `<text>` for each unique node
 *
 * All elements receive a `data-id` attribute matching their Harmony Core ID.
 *
 * World coordinates are pre-computed once for all nodes and reused across
 * triangles, edges, and node rendering (Review Item 8).
 */
export function renderGrid(
  layerGroup: SVGGElement,
  indices: WindowIndices,
): void {
  // Clear any existing content
  layerGroup.innerHTML = "";

  // Pre-compute world positions for all nodes (avoids redundant latticeToWorld calls)
  const worldCache = buildWorldPointCache(indices);

  // Build all elements into a DocumentFragment for batched DOM insertion
  // (avoids ~4,200 individual appendChild calls triggering layout recalc)
  const frag = document.createDocumentFragment();

  // --- Triangles (major=Up=pale blue, minor=Down=pale red) ---
  for (const [tid, ref] of indices.triIdToRef) {
    const verts = triVertices(ref);
    const fill = ref.orientation === "U" ? MAJOR_TRI_FILL : MINOR_TRI_FILL;
    const poly = svgEl("polygon", {
      points: polygonPoints(verts, worldCache),
      fill,
      stroke: GRID_TRI_STROKE,
      "stroke-width": TRI_STROKE_WIDTH,
      "data-id": tid as string,
    });
    frag.appendChild(poly);
  }

  // --- Edges (explicit, one <line> per unique edge) ---
  for (const eid of indices.edgeToTris.keys()) {
    const [a, b] = parseEdgeId(eid);
    const keyA = nodeId(a.u, a.v) as string;
    const keyB = nodeId(b.u, b.v) as string;
    const wa = worldCache.get(keyA) ?? latticeToWorld(a.u, a.v);
    const wb = worldCache.get(keyB) ?? latticeToWorld(b.u, b.v);
    const line = svgEl("line", {
      x1: wa.x,
      y1: wa.y,
      x2: wb.x,
      y2: wb.y,
      stroke: GRID_EDGE_COLOR,
      "stroke-width": EDGE_STROKE_WIDTH,
      "data-id": eid as string,
    });
    frag.appendChild(line);
  }

  // --- Nodes (circles + labels) ---
  for (const nid of indices.nodeToTris.keys()) {
    const coord = parseNodeId(nid);
    const w = worldCache.get(nid as string)!;
    const pitchClass = pc(coord.u, coord.v);

    const circle = svgEl("circle", {
      cx: w.x,
      cy: w.y,
      r: NODE_RADIUS,
      fill: NODE_FILL,
      stroke: NODE_STROKE,
      "stroke-width": NODE_STROKE_WIDTH,
      "data-id": nid as string,
    });
    frag.appendChild(circle);

    const label = svgEl("text", {
      x: w.x,
      y: w.y,
      "text-anchor": "middle",
      "dominant-baseline": "central",
      "font-size": LABEL_FONT_SIZE,
      "font-family": "sans-serif",
      "font-weight": "600",
      fill: LABEL_COLOR,
      "data-id": `label-${nid as string}`,
    });
    label.textContent = PC_NAMES[pitchClass];
    frag.appendChild(label);
  }

  // Single DOM insertion for all elements
  layerGroup.appendChild(frag);
}
