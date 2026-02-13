import type { Shape } from "harmony-core";
import { latticeToWorld } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

// --- Visual constants ---

/** Path stroke color. */
const PATH_STROKE = "#2a9d8f";

/** Path stroke width (world units). */
const PATH_STROKE_WIDTH = 0.08;

/** Path stroke opacity. */
const PATH_STROKE_OPACITY = 0.8;

/** Centroid marker radius (world units). */
const CENTROID_MARKER_RADIUS = 0.12;

/** Centroid marker fill color. */
const CENTROID_MARKER_FILL = "#264653";

/** Active chord marker fill color. */
const ACTIVE_MARKER_FILL = "#e76f51";

/** Active chord marker radius (world units). */
const ACTIVE_MARKER_RADIUS = 0.18;

// --- Types ---

/** Handle for managing a rendered progression path. */
export interface PathHandle {
  /** Remove all rendered path elements. */
  clear(): void;
  /** Highlight the chord at the given index (0-based). Pass -1 to clear active highlight. */
  setActiveChord(index: number): void;
  /** Get the number of chords in the progression. */
  getChordCount(): number;
}

/** Options for path rendering. */
export interface PathRenderOptions {
  /** Path stroke color (default: teal). */
  pathStroke?: string;
  /** Path stroke width in world units (default: 0.08). */
  pathStrokeWidth?: number;
  /** Centroid marker fill color (default: dark blue). */
  centroidFill?: string;
  /** Active chord marker fill color (default: orange-red). */
  activeFill?: string;
  /** Whether to show centroid markers at each chord (default: true). */
  showCentroidMarkers?: boolean;
}

// --- Public API ---

/**
 * Render a progression path connecting Shape centroids.
 *
 * Creates:
 * - Polyline connecting all Shape centroids
 * - Circle markers at each centroid
 * - Active chord marker (initially hidden)
 *
 * Returns a handle for clearing the path and updating the active chord highlight.
 *
 * @param layerPath The SVG group for the progression path (layer-path)
 * @param shapes Array of Shapes representing the progression
 * @param options Optional rendering customization
 */
export function renderProgressionPath(
  layerPath: SVGGElement,
  shapes: readonly Shape[],
  options?: PathRenderOptions,
): PathHandle {
  const elements: SVGElement[] = [];

  if (shapes.length === 0) {
    return {
      clear(): void {},
      setActiveChord(): void {},
      getChordCount(): number {
        return 0;
      },
    };
  }

  const strokeColor = options?.pathStroke ?? PATH_STROKE;
  const strokeWidth = options?.pathStrokeWidth ?? PATH_STROKE_WIDTH;
  const centroidFill = options?.centroidFill ?? CENTROID_MARKER_FILL;
  const activeFill = options?.activeFill ?? ACTIVE_MARKER_FILL;
  const showMarkers = options?.showCentroidMarkers !== false;

  // Use DocumentFragment for batched DOM insertion
  const frag = document.createDocumentFragment();

  // Convert all centroids to world coordinates
  const worldCentroids = shapes.map((shape) =>
    latticeToWorld(shape.centroid_uv.u, shape.centroid_uv.v),
  );

  // --- Render path polyline ---
  const pointsStr = worldCentroids.map((w) => `${w.x},${w.y}`).join(" ");

  const polyline = svgEl("polyline", {
    points: pointsStr,
    fill: "none",
    stroke: strokeColor,
    "stroke-width": strokeWidth,
    "stroke-opacity": PATH_STROKE_OPACITY,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "data-path-element": "path-line",
  });
  frag.appendChild(polyline);
  elements.push(polyline as SVGElement);

  // --- Render centroid markers ---
  const centroidMarkers: SVGCircleElement[] = [];
  if (showMarkers) {
    for (let i = 0; i < worldCentroids.length; i++) {
      const w = worldCentroids[i];
      const marker = svgEl("circle", {
        cx: w.x,
        cy: w.y,
        r: CENTROID_MARKER_RADIUS,
        fill: centroidFill,
        "data-path-element": "centroid-marker",
        "data-chord-index": i,
      }) as SVGCircleElement;
      frag.appendChild(marker);
      elements.push(marker);
      centroidMarkers.push(marker);
    }
  }

  // --- Active chord marker (initially hidden) ---
  const activeMarker = svgEl("circle", {
    cx: 0,
    cy: 0,
    r: ACTIVE_MARKER_RADIUS,
    fill: activeFill,
    "data-path-element": "active-marker",
    visibility: "hidden",
  }) as SVGCircleElement;
  frag.appendChild(activeMarker);
  elements.push(activeMarker);

  // Single DOM insertion
  layerPath.appendChild(frag);

  // Track current active index
  let currentActiveIndex = -1;

  return {
    clear(): void {
      for (const el of elements) {
        el.remove();
      }
      elements.length = 0;
      centroidMarkers.length = 0;
      currentActiveIndex = -1;
    },

    setActiveChord(index: number): void {
      if (index < 0 || index >= worldCentroids.length) {
        // Hide active marker
        activeMarker.setAttribute("visibility", "hidden");
        currentActiveIndex = -1;
        return;
      }

      // Move and show active marker
      const w = worldCentroids[index];
      activeMarker.setAttribute("cx", String(w.x));
      activeMarker.setAttribute("cy", String(w.y));
      activeMarker.setAttribute("visibility", "visible");
      currentActiveIndex = index;
    },

    getChordCount(): number {
      return shapes.length;
    },
  };
}

/**
 * Clear a rendered progression path by removing all its elements.
 * Convenience wrapper for handle.clear().
 */
export function clearProgression(handle: PathHandle): void {
  handle.clear();
}
