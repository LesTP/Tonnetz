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

/** Active chord marker radius (world units) — enlarged to fit chord label. */
const ACTIVE_MARKER_RADIUS = 0.32;

/** Font size for centroid labels — two-char names slightly smaller to fit. */
const CENTROID_LABEL_FONT_SIZE = 0.18;
const CENTROID_LABEL_FONT_SIZE_SMALL = 0.14;

/** Font size for chord label on the active marker (world units). */
const ACTIVE_LABEL_FONT_SIZE = 0.22;

// --- Chord label shortening ---

/**
 * Preferred enharmonic spellings — map pitch-class roots to the more
 * common enharmonic name (sharp vs flat). Used only for path labels.
 *
 * Index = pitch class (0–11). Each entry is the preferred display name.
 * Policy: Bb over A#, Eb over D#, Ab over G#, Db over C#, F# over Gb.
 */
const PREFERRED_ROOT: readonly string[] = [
  "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B",
];

/**
 * Format a chord symbol string into a compact label for the path marker.
 *
 * Transformations applied:
 * - `m7b5` → `ø7` (half-diminished)
 * - `dim7` → `o7`
 * - `dim` → `o`
 * - `maj7` → `△7` (triangle symbol)
 * - `add9` → `+9`
 * - `aug` → `+`
 * - Enharmonic root: picks the more common spelling (e.g., Bb not A#)
 *
 * Input is a cleaned chord symbol string like "Bbm7", "C#dim7", "Fm7b5".
 */
export function formatShortChordLabel(symbol: string): string {
  if (!symbol) return "";

  // Parse root from front: letter + optional # or b
  const rootMatch = symbol.match(/^([A-Ga-g])([#b]?)/);
  if (!rootMatch) return symbol;

  const letter = rootMatch[1].toUpperCase();
  const accidental = rootMatch[2];
  const suffix = symbol.slice(rootMatch[0].length);

  // Map to pitch class to look up preferred spelling
  const letterPc: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  let pc = letterPc[letter] ?? 0;
  if (accidental === "#") pc = (pc + 1) % 12;
  if (accidental === "b") pc = (pc + 11) % 12;

  const root = PREFERRED_ROOT[pc];

  // Shorten suffix
  let short = suffix;
  short = short.replace("m7b5", "ø7");
  short = short.replace("dim7", "o7");
  short = short.replace("dim", "o");
  short = short.replace("maj7", "△7");
  short = short.replace("add9", "+9");
  short = short.replace("aug", "+");

  return root + short;
}

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
  /** Whether to show note-name labels on centroid markers (default: true). */
  showCentroidLabels?: boolean;
  /**
   * Chord label strings to display on the path markers.
   * If provided, must have the same length as the shapes array.
   * Labels are shortened automatically via formatShortChordLabel().
   */
  chordLabels?: readonly string[];
}

// --- Public API ---

/**
 * Render a progression path connecting Shape centroids.
 *
 * Creates:
 * - Polyline connecting all Shape centroids
 * - Circle markers at each centroid (with optional chord label)
 * - Active chord marker group: enlarged circle + chord label text
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
  const showLabels = options?.showCentroidLabels !== false;
  const rawLabels = options?.chordLabels;

  // Pre-format labels
  const labels: string[] | null = rawLabels
    ? rawLabels.map((l) => formatShortChordLabel(l))
    : null;

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

      // White duplicate of the note name on top of the opaque marker
      if (showLabels) {
        const rootPc = shapes[i].chord.root_pc;
        const noteName = PREFERRED_ROOT[rootPc];
        const fontSize = noteName.length > 1
          ? CENTROID_LABEL_FONT_SIZE_SMALL
          : CENTROID_LABEL_FONT_SIZE;
        const noteLabel = svgEl("text", {
          x: w.x,
          y: w.y,
          "font-size": fontSize,
          "font-family": "sans-serif",
          "font-weight": "600",
          fill: "#fff",
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "pointer-events": "none",
          "data-path-element": "centroid-label",
          "data-chord-index": i,
        });
        noteLabel.textContent = noteName;
        frag.appendChild(noteLabel);
        elements.push(noteLabel as SVGElement);
      }

    }
  }

  // --- Active chord marker group (circle + label, initially hidden) ---
  const activeGroup = svgEl("g", {
    "data-path-element": "active-marker",
    visibility: "hidden",
  });

  const activeCircle = svgEl("circle", {
    cx: 0,
    cy: 0,
    r: ACTIVE_MARKER_RADIUS,
    fill: activeFill,
  });
  activeGroup.appendChild(activeCircle);

  const activeLabel = svgEl("text", {
    x: 0,
    y: 0,
    "font-size": ACTIVE_LABEL_FONT_SIZE,
    "font-family": "system-ui, sans-serif",
    "font-weight": "700",
    fill: "#fff",
    "text-anchor": "middle",
    "dominant-baseline": "central",
    "pointer-events": "none",
  });
  activeLabel.textContent = "";
  activeGroup.appendChild(activeLabel);

  frag.appendChild(activeGroup);
  elements.push(activeGroup as SVGElement);

  // Single DOM insertion
  layerPath.appendChild(frag);

  return {
    clear(): void {
      for (const el of elements) {
        el.remove();
      }
      elements.length = 0;
      centroidMarkers.length = 0;
    },

    setActiveChord(index: number): void {
      if (index < 0 || index >= worldCentroids.length) {
        // Hide active marker
        activeGroup.setAttribute("visibility", "hidden");
        return;
      }

      // Move and show active marker group
      const w = worldCentroids[index];
      activeGroup.setAttribute(
        "transform",
        `translate(${w.x},${w.y})`,
      );
      activeGroup.setAttribute("visibility", "visible");

      // Update label text
      if (labels && labels[index]) {
        activeLabel.textContent = labels[index];
      } else {
        activeLabel.textContent = "";
      }
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
