// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildWindowIndices, triId } from "harmony-core";
import type { Shape, TriRef, WindowIndices } from "harmony-core";
import {
  highlightTriangle,
  highlightShape,
  clearHighlight,
  clearAllHighlights,
} from "../highlight.js";
import type { HighlightHandle } from "../highlight.js";

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

function makeTriadShape(anchor: { u: number; v: number }, orientation: "U" | "D"): Shape {
  const tri: TriRef = { orientation, anchor };
  return {
    chord: {
      root_pc: 0,
      quality: "maj",
      extension: null,
      chord_pcs: [0, 4, 7],
      main_triad_pcs: [0, 4, 7],
    },
    main_tri: tri,
    ext_tris: [],
    dot_pcs: [],
    covered_pcs: new Set([0, 4, 7]),
    root_vertex_index: 0,
    centroid_uv: { u: anchor.u + 0.33, v: anchor.v + 0.33 },
  };
}

function makeExtendedShape(): Shape {
  const mainTri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
  const extTri: TriRef = { orientation: "D", anchor: { u: 0, v: 0 } };
  return {
    chord: {
      root_pc: 0,
      quality: "maj",
      extension: "7",
      chord_pcs: [0, 4, 7, 11],
      main_triad_pcs: [0, 4, 7],
    },
    main_tri: mainTri,
    ext_tris: [extTri],
    dot_pcs: [],
    covered_pcs: new Set([0, 4, 7, 11]),
    root_vertex_index: 0,
    centroid_uv: { u: 0.5, v: 0.5 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("highlightTriangle", () => {
  let layer: SVGGElement;
  let indices: WindowIndices;
  let handle: HighlightHandle;

  beforeEach(() => {
    layer = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layer.parentElement?.remove();
  });

  it("renders overlay polygon for valid triangle", () => {
    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    handle = highlightTriangle(layer, tid, indices);

    const polys = layer.querySelectorAll("polygon[data-highlight='true']");
    expect(polys).toHaveLength(1);
  });

  it("sets data-tri-id attribute", () => {
    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    handle = highlightTriangle(layer, tid, indices);

    const poly = layer.querySelector("polygon[data-highlight='true']");
    expect(poly?.getAttribute("data-tri-id")).toBe(tid);
  });

  it("returns no-op handle for triangle not in window", () => {
    const tid = triId({ orientation: "U", anchor: { u: 100, v: 100 } });
    handle = highlightTriangle(layer, tid, indices);

    const polys = layer.querySelectorAll("polygon");
    expect(polys).toHaveLength(0);

    // Should not throw
    handle.clear();
  });

  it("uses default highlight colors", () => {
    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    handle = highlightTriangle(layer, tid, indices);

    const poly = layer.querySelector("polygon[data-highlight='true']");
    expect(poly?.getAttribute("fill")).toContain("rgba");
    expect(poly?.getAttribute("stroke")).toContain("rgba");
  });

  it("respects custom style options", () => {
    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    handle = highlightTriangle(layer, tid, indices, {
      fill: "red",
      stroke: "blue",
      strokeWidth: 0.1,
    });

    const poly = layer.querySelector("polygon[data-highlight='true']");
    expect(poly?.getAttribute("fill")).toBe("red");
    expect(poly?.getAttribute("stroke")).toBe("blue");
    expect(poly?.getAttribute("stroke-width")).toBe("0.1");
  });
});

describe("highlightShape", () => {
  let layer: SVGGElement;
  let indices: WindowIndices;
  let handle: HighlightHandle;

  beforeEach(() => {
    layer = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    handle?.clear();
    layer.parentElement?.remove();
  });

  it("highlights main_tri", () => {
    const shape = makeTriadShape({ u: 0, v: 0 }, "U");
    handle = highlightShape(layer, shape, indices);

    const mainPolys = layer.querySelectorAll("polygon[data-highlight-element='main-tri']");
    expect(mainPolys).toHaveLength(1);
  });

  it("highlights main_tri and ext_tris", () => {
    const shape = makeExtendedShape();
    handle = highlightShape(layer, shape, indices);

    const mainPolys = layer.querySelectorAll("polygon[data-highlight-element='main-tri']");
    const extPolys = layer.querySelectorAll("polygon[data-highlight-element='ext-tri']");

    expect(mainPolys).toHaveLength(1);
    expect(extPolys).toHaveLength(1);
  });

  it("handles dot-only shape (no triangles)", () => {
    const shape: Shape = {
      chord: {
        root_pc: 0,
        quality: "dim",
        extension: null,
        chord_pcs: [0, 3, 6],
        main_triad_pcs: [0, 3, 6],
      },
      main_tri: null,
      ext_tris: [],
      dot_pcs: [0, 3, 6],
      covered_pcs: new Set([0, 3, 6]),
      root_vertex_index: null,
      centroid_uv: { u: 0, v: 0 },
    };

    handle = highlightShape(layer, shape, indices);

    const polys = layer.querySelectorAll("polygon");
    expect(polys).toHaveLength(0);
  });
});

describe("clearHighlight", () => {
  let layer: SVGGElement;
  let indices: WindowIndices;

  beforeEach(() => {
    layer = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    layer.parentElement?.remove();
  });

  it("removes the highlighted polygon", () => {
    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    const handle = highlightTriangle(layer, tid, indices);

    expect(layer.querySelectorAll("polygon")).toHaveLength(1);

    clearHighlight(handle);

    expect(layer.querySelectorAll("polygon")).toHaveLength(0);
  });

  it("can be called multiple times safely", () => {
    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    const handle = highlightTriangle(layer, tid, indices);

    handle.clear();
    handle.clear(); // Should not throw

    expect(layer.querySelectorAll("polygon")).toHaveLength(0);
  });
});

describe("clearAllHighlights", () => {
  let layer: SVGGElement;
  let indices: WindowIndices;

  beforeEach(() => {
    layer = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    layer.parentElement?.remove();
  });

  it("removes all highlights from layer", () => {
    const tid1 = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    const tid2 = triId({ orientation: "U", anchor: { u: 1, v: 0 } });

    highlightTriangle(layer, tid1, indices);
    highlightTriangle(layer, tid2, indices);

    expect(layer.querySelectorAll("polygon")).toHaveLength(2);

    clearAllHighlights(layer);

    expect(layer.querySelectorAll("polygon")).toHaveLength(0);
  });

  it("does not affect elements without data-highlight attribute", () => {
    // Add a non-highlight element
    const nonHighlight = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    layer.appendChild(nonHighlight);

    const tid = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    highlightTriangle(layer, tid, indices);

    clearAllHighlights(layer);

    expect(layer.querySelectorAll("polygon")).toHaveLength(0);
    expect(layer.querySelectorAll("circle")).toHaveLength(1);
  });
});

describe("multiple highlights", () => {
  let layer: SVGGElement;
  let indices: WindowIndices;

  beforeEach(() => {
    layer = makeLayerGroup();
    indices = makeIndices();
  });

  afterEach(() => {
    layer.parentElement?.remove();
  });

  it("can have multiple highlights simultaneously", () => {
    const tid1 = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    const tid2 = triId({ orientation: "D", anchor: { u: 0, v: 0 } });

    const h1 = highlightTriangle(layer, tid1, indices);
    const h2 = highlightTriangle(layer, tid2, indices);

    expect(layer.querySelectorAll("polygon")).toHaveLength(2);

    h1.clear();
    h2.clear();
  });

  it("clearing one highlight does not affect others", () => {
    const tid1 = triId({ orientation: "U", anchor: { u: 0, v: 0 } });
    const tid2 = triId({ orientation: "D", anchor: { u: 0, v: 0 } });

    const h1 = highlightTriangle(layer, tid1, indices);
    const h2 = highlightTriangle(layer, tid2, indices);

    h1.clear();

    expect(layer.querySelectorAll("polygon")).toHaveLength(1);
    expect(layer.querySelector("polygon")?.getAttribute("data-tri-id")).toBe(tid2);

    h2.clear();
  });
});
