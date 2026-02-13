// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildWindowIndices } from "harmony-core";
import type { Shape, TriRef, WindowIndices, Chord } from "harmony-core";
import { renderShape, clearShape } from "../shape-renderer.js";
import type { ShapeHandle } from "../shape-renderer.js";

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

function makeIndices(): WindowIndices {
  return buildWindowIndices({ uMin: -3, uMax: 3, vMin: -3, vMax: 3 });
}

function makeChord(rootPc: number, quality: "maj" | "min" | "dim" | "aug"): Chord {
  // Simplified chord for testing
  const triadPcs: [number, number, number] =
    quality === "maj" ? [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12] :
    quality === "min" ? [rootPc, (rootPc + 3) % 12, (rootPc + 7) % 12] :
    quality === "dim" ? [rootPc, (rootPc + 3) % 12, (rootPc + 6) % 12] :
    [rootPc, (rootPc + 4) % 12, (rootPc + 8) % 12]; // aug

  return {
    root_pc: rootPc,
    quality,
    extension: null,
    chord_pcs: [...triadPcs],
    main_triad_pcs: triadPcs,
  };
}

/** Create a Shape with main_tri only (basic triad). */
function makeTriadShape(anchor: { u: number; v: number }, orientation: "U" | "D"): Shape {
  const tri: TriRef = { orientation, anchor };
  return {
    chord: makeChord(0, "maj"),
    main_tri: tri,
    ext_tris: [],
    dot_pcs: [],
    covered_pcs: new Set([0, 4, 7]),
    root_vertex_index: 0,
    centroid_uv: { u: anchor.u + 0.33, v: anchor.v + 0.33 },
  };
}

/** Create a Shape with main_tri + extension triangle. */
function makeExtendedShape(): Shape {
  const mainTri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
  const extTri: TriRef = { orientation: "D", anchor: { u: 0, v: 0 } };
  return {
    chord: makeChord(0, "maj"),
    main_tri: mainTri,
    ext_tris: [extTri],
    dot_pcs: [],
    covered_pcs: new Set([0, 4, 7, 11]),
    root_vertex_index: 0,
    centroid_uv: { u: 0.5, v: 0.5 },
  };
}

/** Create a dot-only Shape (dim/aug triad). */
function makeDotOnlyShape(): Shape {
  return {
    chord: makeChord(0, "dim"),
    main_tri: null,
    ext_tris: [],
    dot_pcs: [0, 3, 6], // C diminished: C, Eb, Gb
    covered_pcs: new Set([0, 3, 6]),
    root_vertex_index: null,
    centroid_uv: { u: 0, v: 0 },
  };
}

/** Create a Shape with main_tri + dot_pcs (e.g., maj with extension dot). */
function makeTriadWithDotsShape(): Shape {
  const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
  return {
    chord: makeChord(0, "maj"),
    main_tri: tri,
    ext_tris: [],
    dot_pcs: [9], // A (6th extension)
    covered_pcs: new Set([0, 4, 7, 9]),
    root_vertex_index: 0,
    centroid_uv: { u: 0.33, v: 0.33 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderShape — basic triad", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;
  let handle: ShapeHandle;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("renders one filled polygon for main_tri", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = renderShape(layerChords, layerDots, shape, indices);

    const polys = layerChords.querySelectorAll("polygon[data-shape-element='main-tri']");
    expect(polys).toHaveLength(1);
    expect(polys[0].getAttribute("fill")).toContain("rgba");
  });

  it("renders root vertex marker", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = renderShape(layerChords, layerDots, shape, indices);

    const markers = layerChords.querySelectorAll("circle[data-shape-element='root-marker']");
    expect(markers).toHaveLength(1);
  });

  it("does not render dots for triad without dot_pcs", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = renderShape(layerChords, layerDots, shape, indices);

    const dots = layerDots.querySelectorAll("circle[data-shape-element='dot']");
    expect(dots).toHaveLength(0);
  });

  it("polygon points are in world coordinates", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = renderShape(layerChords, layerDots, shape, indices);

    const poly = layerChords.querySelector("polygon[data-shape-element='main-tri']");
    const points = poly?.getAttribute("points") ?? "";

    // U(0,0) vertices: (0,0), (1,0), (0,1) → world: (0,0), (1,0), (0.5, √3/2)
    expect(points).toContain("0,0");
    expect(points).toContain("1,0");
  });
});

describe("renderShape — extended chord", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;
  let handle: ShapeHandle;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("renders main_tri and ext_tris as separate polygons", () => {
    const shape = makeExtendedShape();
    handle = renderShape(layerChords, layerDots, shape, indices);

    const mainPolys = layerChords.querySelectorAll("polygon[data-shape-element='main-tri']");
    const extPolys = layerChords.querySelectorAll("polygon[data-shape-element='ext-tri']");

    expect(mainPolys).toHaveLength(1);
    expect(extPolys).toHaveLength(1);
  });

  it("ext_tris have different fill than main_tri", () => {
    const shape = makeExtendedShape();
    handle = renderShape(layerChords, layerDots, shape, indices);

    const mainPoly = layerChords.querySelector("polygon[data-shape-element='main-tri']");
    const extPoly = layerChords.querySelector("polygon[data-shape-element='ext-tri']");

    const mainFill = mainPoly?.getAttribute("fill") ?? "";
    const extFill = extPoly?.getAttribute("fill") ?? "";

    expect(mainFill).not.toBe(extFill);
  });
});

describe("renderShape — dot-only shape (dim/aug)", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;
  let handle: ShapeHandle;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("renders no triangles for dot-only shape", () => {
    const shape = makeDotOnlyShape();
    handle = renderShape(layerChords, layerDots, shape, indices);

    const polys = layerChords.querySelectorAll("polygon");
    expect(polys).toHaveLength(0);
  });

  it("renders no root marker for dot-only shape", () => {
    const shape = makeDotOnlyShape();
    handle = renderShape(layerChords, layerDots, shape, indices);

    const markers = layerChords.querySelectorAll("circle[data-shape-element='root-marker']");
    expect(markers).toHaveLength(0);
  });

  it("renders dots for each dot_pc", () => {
    const shape = makeDotOnlyShape();
    handle = renderShape(layerChords, layerDots, shape, indices);

    const dots = layerDots.querySelectorAll("circle[data-shape-element='dot']");
    // May be fewer if some pcs not found in window, but at least some should render
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });
});

describe("renderShape — triad with dot extensions", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;
  let handle: ShapeHandle;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("renders both triangle and dots", () => {
    const shape = makeTriadWithDotsShape();
    handle = renderShape(layerChords, layerDots, shape, indices);

    const polys = layerChords.querySelectorAll("polygon[data-shape-element='main-tri']");
    const dots = layerDots.querySelectorAll("circle[data-shape-element='dot']");

    expect(polys).toHaveLength(1);
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });
});

describe("clearShape", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("removes all rendered elements", () => {
    const shape = makeExtendedShape();
    const handle = renderShape(layerChords, layerDots, shape, indices);

    // Verify elements were created
    expect(layerChords.querySelectorAll("polygon").length).toBeGreaterThan(0);
    expect(layerChords.querySelectorAll("circle").length).toBeGreaterThan(0);

    // Clear
    clearShape(handle);

    // Verify elements were removed
    expect(layerChords.querySelectorAll("polygon")).toHaveLength(0);
    expect(layerChords.querySelectorAll("circle")).toHaveLength(0);
  });

  it("can be called multiple times safely", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    const handle = renderShape(layerChords, layerDots, shape, indices);

    handle.clear();
    handle.clear(); // Should not throw

    expect(layerChords.querySelectorAll("polygon")).toHaveLength(0);
  });
});

describe("renderShape — multiple shapes", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;
  let handles: ShapeHandle[];

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
    handles = [];
  });

  afterEach(() => {
    for (const h of handles) h.clear();
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("can render multiple shapes simultaneously", () => {
    const shape1 = makeTriadShape({ u: 0, v: 0 }, "U");
    const shape2 = makeTriadShape({ u: 1, v: 0 }, "U");

    handles.push(renderShape(layerChords, layerDots, shape1, indices));
    handles.push(renderShape(layerChords, layerDots, shape2, indices));

    const polys = layerChords.querySelectorAll("polygon[data-shape-element='main-tri']");
    expect(polys).toHaveLength(2);
  });

  it("clearing one shape does not affect others", () => {
    const shape1 = makeTriadShape({ u: 0, v: 0 }, "U");
    const shape2 = makeTriadShape({ u: 1, v: 0 }, "U");

    const h1 = renderShape(layerChords, layerDots, shape1, indices);
    const h2 = renderShape(layerChords, layerDots, shape2, indices);
    handles.push(h1, h2);

    h1.clear();

    const polys = layerChords.querySelectorAll("polygon[data-shape-element='main-tri']");
    expect(polys).toHaveLength(1);
  });
});

describe("renderShape — options", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let indices: WindowIndices;
  let handle: ShapeHandle;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
  });

  it("respects custom mainTriFill option", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = renderShape(layerChords, layerDots, shape, indices, {
      mainTriFill: "red",
    });

    const poly = layerChords.querySelector("polygon[data-shape-element='main-tri']");
    expect(poly?.getAttribute("fill")).toBe("red");
  });

  it("respects showRootMarker=false option", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = renderShape(layerChords, layerDots, shape, indices, {
      showRootMarker: false,
    });

    const markers = layerChords.querySelectorAll("circle[data-shape-element='root-marker']");
    expect(markers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Integration pattern test (Phase 3d)
// ---------------------------------------------------------------------------

describe("renderShape + highlight integration pattern", () => {
  let layerChords: SVGGElement;
  let layerDots: SVGGElement;
  let layerInteraction: SVGGElement;
  let indices: WindowIndices;

  beforeEach(() => {
    layerChords = makeLayerGroup();
    layerDots = makeLayerGroup();
    layerInteraction = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    layerChords.parentElement?.remove();
    layerDots.parentElement?.remove();
    layerInteraction.parentElement?.remove();
  });

  it("demonstrates interaction callback → highlight wiring pattern", async () => {
    // This test demonstrates the consumer-side integration pattern:
    // 1. Render a shape
    // 2. On interaction callback (onTriangleSelect), highlight the triangle
    // 3. On next selection, clear previous highlight and highlight new one

    const { highlightTriangle, clearAllHighlights } = await import("../highlight.js");
    const { triId } = await import("harmony-core");

    // Simulate rendering a shape
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    const shapeHandle = renderShape(layerChords, layerDots, shape, indices);

    // Simulate interaction callback: onTriangleSelect would be wired like this:
    const selectedTriId = triId({ orientation: "U", anchor: { u: 0, v: 0 } });

    // Consumer pattern: highlight on selection
    clearAllHighlights(layerInteraction);
    const highlightHandle = highlightTriangle(layerInteraction, selectedTriId, indices);

    // Verify both shape and highlight are rendered
    expect(layerChords.querySelectorAll("polygon")).toHaveLength(1);
    expect(layerInteraction.querySelectorAll("polygon")).toHaveLength(1);

    // Cleanup
    highlightHandle.clear();
    shapeHandle.clear();
  });
});
