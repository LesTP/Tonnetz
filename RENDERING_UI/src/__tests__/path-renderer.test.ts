// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Shape, Chord, TriRef } from "harmony-core";
import {
  renderProgressionPath,
  clearProgression,
} from "../path-renderer.js";
import type { PathHandle } from "../path-renderer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayerGroup(): SVGGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.appendChild(svg);
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(g);
  return g;
}

function makeChord(rootPc: number): Chord {
  return {
    root_pc: rootPc,
    quality: "maj",
    extension: null,
    chord_pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12],
    main_triad_pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12] as [number, number, number],
  };
}

function makeShape(
  centroidU: number,
  centroidV: number,
  rootPc: number = 0,
): Shape {
  const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
  return {
    chord: makeChord(rootPc),
    main_tri: tri,
    ext_tris: [],
    dot_pcs: [],
    covered_pcs: new Set([rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]),
    root_vertex_index: 0,
    centroid_uv: { u: centroidU, v: centroidV },
  };
}

/** Create a simple 4-chord progression (ii-V-I-IV style). */
function makeProgression(): Shape[] {
  return [
    makeShape(0, 0, 2),   // Dm at (0, 0)
    makeShape(1, 0, 7),   // G at (1, 0)
    makeShape(1.5, 1, 0), // C at (1.5, 1)
    makeShape(2, 0.5, 5), // F at (2, 0.5)
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderProgressionPath — basic rendering", () => {
  let layerPath: SVGGElement;
  let handle: PathHandle;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    handle?.clear();
    layerPath.parentElement?.remove();
  });

  it("renders a polyline connecting centroids", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    const polylines = layerPath.querySelectorAll("polyline[data-path-element='path-line']");
    expect(polylines).toHaveLength(1);
  });

  it("polyline has correct number of points", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    const polyline = layerPath.querySelector("polyline[data-path-element='path-line']");
    const points = polyline?.getAttribute("points") ?? "";
    const pointCount = points.split(" ").length;

    expect(pointCount).toBe(shapes.length);
  });

  it("renders centroid markers by default", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    const markers = layerPath.querySelectorAll("circle[data-path-element='centroid-marker']");
    expect(markers).toHaveLength(shapes.length);
  });

  it("markers have data-chord-index attributes", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    const markers = layerPath.querySelectorAll("circle[data-path-element='centroid-marker']");
    expect(markers[0].getAttribute("data-chord-index")).toBe("0");
    expect(markers[3].getAttribute("data-chord-index")).toBe("3");
  });

  it("creates hidden active marker", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
    expect(activeMarker).not.toBeNull();
    expect(activeMarker?.getAttribute("visibility")).toBe("hidden");
  });

  it("getChordCount returns correct count", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    expect(handle.getChordCount()).toBe(4);
  });
});

describe("renderProgressionPath — empty progression", () => {
  let layerPath: SVGGElement;
  let handle: PathHandle;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    handle?.clear();
    layerPath.parentElement?.remove();
  });

  it("handles empty shapes array", () => {
    handle = renderProgressionPath(layerPath, []);

    expect(layerPath.children).toHaveLength(0);
    expect(handle.getChordCount()).toBe(0);
  });

  it("setActiveChord is no-op for empty progression", () => {
    handle = renderProgressionPath(layerPath, []);

    // Should not throw
    handle.setActiveChord(0);
    handle.setActiveChord(-1);
  });
});

describe("renderProgressionPath — single chord", () => {
  let layerPath: SVGGElement;
  let handle: PathHandle;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    handle?.clear();
    layerPath.parentElement?.remove();
  });

  it("renders single-point polyline", () => {
    const shapes = [makeShape(0, 0)];
    handle = renderProgressionPath(layerPath, shapes);

    const polyline = layerPath.querySelector("polyline[data-path-element='path-line']");
    expect(polyline).not.toBeNull();

    const points = polyline?.getAttribute("points") ?? "";
    expect(points.split(" ")).toHaveLength(1);
  });

  it("renders single centroid marker", () => {
    const shapes = [makeShape(0, 0)];
    handle = renderProgressionPath(layerPath, shapes);

    const markers = layerPath.querySelectorAll("circle[data-path-element='centroid-marker']");
    expect(markers).toHaveLength(1);
  });
});

describe("renderProgressionPath — setActiveChord", () => {
  let layerPath: SVGGElement;
  let handle: PathHandle;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    handle?.clear();
    layerPath.parentElement?.remove();
  });

  it("shows active marker when valid index is set", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    handle.setActiveChord(0);

    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
    expect(activeMarker?.getAttribute("visibility")).toBe("visible");
  });

  it("moves active marker to correct position", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    // Set to first chord (centroid at 0, 0 → world 0, 0)
    handle.setActiveChord(0);
    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");

    // World coords for centroid (0, 0): x = 0 + 0*0.5 = 0, y = 0 * √3/2 = 0
    expect(activeMarker?.getAttribute("cx")).toBe("0");
    expect(activeMarker?.getAttribute("cy")).toBe("0");
  });

  it("hides active marker when index is -1", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    handle.setActiveChord(0); // Show first
    handle.setActiveChord(-1); // Hide

    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
    expect(activeMarker?.getAttribute("visibility")).toBe("hidden");
  });

  it("hides active marker for out-of-bounds index", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    handle.setActiveChord(0); // Show first
    handle.setActiveChord(100); // Out of bounds

    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
    expect(activeMarker?.getAttribute("visibility")).toBe("hidden");
  });

  it("can cycle through all chords", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    for (let i = 0; i < shapes.length; i++) {
      handle.setActiveChord(i);
      const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
      expect(activeMarker?.getAttribute("visibility")).toBe("visible");
    }
  });
});

describe("clearProgression", () => {
  let layerPath: SVGGElement;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    layerPath.parentElement?.remove();
  });

  it("removes all rendered elements", () => {
    const shapes = makeProgression();
    const handle = renderProgressionPath(layerPath, shapes);

    expect(layerPath.children.length).toBeGreaterThan(0);

    clearProgression(handle);

    expect(layerPath.children).toHaveLength(0);
  });

  it("can be called multiple times safely", () => {
    const shapes = makeProgression();
    const handle = renderProgressionPath(layerPath, shapes);

    handle.clear();
    handle.clear(); // Should not throw

    expect(layerPath.children).toHaveLength(0);
  });

  it("handle methods are safe after clear", () => {
    const shapes = makeProgression();
    const handle = renderProgressionPath(layerPath, shapes);

    handle.clear();

    // These should not throw
    handle.setActiveChord(0);
    expect(handle.getChordCount()).toBe(4); // Count remains
  });
});

describe("renderProgressionPath — options", () => {
  let layerPath: SVGGElement;
  let handle: PathHandle;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    handle?.clear();
    layerPath.parentElement?.remove();
  });

  it("respects custom pathStroke option", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes, {
      pathStroke: "#ff0000",
    });

    const polyline = layerPath.querySelector("polyline[data-path-element='path-line']");
    expect(polyline?.getAttribute("stroke")).toBe("#ff0000");
  });

  it("respects custom pathStrokeWidth option", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes, {
      pathStrokeWidth: 0.2,
    });

    const polyline = layerPath.querySelector("polyline[data-path-element='path-line']");
    expect(polyline?.getAttribute("stroke-width")).toBe("0.2");
  });

  it("respects custom centroidFill option", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes, {
      centroidFill: "#00ff00",
    });

    const marker = layerPath.querySelector("circle[data-path-element='centroid-marker']");
    expect(marker?.getAttribute("fill")).toBe("#00ff00");
  });

  it("respects custom activeFill option", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes, {
      activeFill: "#0000ff",
    });

    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
    expect(activeMarker?.getAttribute("fill")).toBe("#0000ff");
  });

  it("respects showCentroidMarkers=false option", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes, {
      showCentroidMarkers: false,
    });

    const markers = layerPath.querySelectorAll("circle[data-path-element='centroid-marker']");
    expect(markers).toHaveLength(0);

    // Active marker should still exist
    const activeMarker = layerPath.querySelector("circle[data-path-element='active-marker']");
    expect(activeMarker).not.toBeNull();
  });
});

describe("renderProgressionPath — world coordinate conversion", () => {
  let layerPath: SVGGElement;
  let handle: PathHandle;

  beforeEach(() => {
    layerPath = makeLayerGroup();
  });

  afterEach(() => {
    handle?.clear();
    layerPath.parentElement?.remove();
  });

  it("converts lattice centroids to world coordinates", () => {
    // Centroid at (1, 1) → world: x = 1 + 1*0.5 = 1.5, y = 1 * √3/2 ≈ 0.866
    const shapes = [makeShape(1, 1)];
    handle = renderProgressionPath(layerPath, shapes);

    const marker = layerPath.querySelector("circle[data-path-element='centroid-marker']");
    const cx = parseFloat(marker?.getAttribute("cx") ?? "0");
    const cy = parseFloat(marker?.getAttribute("cy") ?? "0");

    expect(cx).toBeCloseTo(1.5, 5);
    expect(cy).toBeCloseTo(Math.sqrt(3) / 2, 5);
  });

  it("polyline points match centroid marker positions", () => {
    const shapes = makeProgression();
    handle = renderProgressionPath(layerPath, shapes);

    const polyline = layerPath.querySelector("polyline[data-path-element='path-line']");
    const pointsStr = polyline?.getAttribute("points") ?? "";
    const points = pointsStr.split(" ");

    const markers = layerPath.querySelectorAll("circle[data-path-element='centroid-marker']");

    for (let i = 0; i < markers.length; i++) {
      const [px, py] = points[i].split(",").map(Number);
      const mx = parseFloat(markers[i].getAttribute("cx") ?? "0");
      const my = parseFloat(markers[i].getAttribute("cy") ?? "0");

      expect(px).toBeCloseTo(mx, 5);
      expect(py).toBeCloseTo(my, 5);
    }
  });
});
