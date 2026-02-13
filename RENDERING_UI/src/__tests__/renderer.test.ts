// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from "vitest";
import { svgEl, setAttrs } from "../svg-helpers.js";
import {
  createSvgScaffold,
  renderGrid,
  LAYER_IDS,
  type SvgScaffold,
} from "../renderer.js";
import {
  buildWindowIndices,
  pc,
  triVertices,
  parseNodeId,
  type WindowBounds,
} from "harmony-core";
import { latticeToWorld } from "../coords.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// svg-helpers
// ---------------------------------------------------------------------------

describe("svgEl", () => {
  it("creates an element in the SVG namespace", () => {
    const circle = svgEl("circle", { cx: 1, cy: 2, r: 3 });
    expect(circle.namespaceURI).toBe(SVG_NS);
    expect(circle.tagName.toLowerCase()).toBe("circle");
    expect(circle.getAttribute("cx")).toBe("1");
    expect(circle.getAttribute("cy")).toBe("2");
    expect(circle.getAttribute("r")).toBe("3");
  });

  it("creates an element without attributes", () => {
    const g = svgEl("g");
    expect(g.namespaceURI).toBe(SVG_NS);
    expect(g.tagName.toLowerCase()).toBe("g");
  });
});

describe("setAttrs", () => {
  it("sets multiple attributes on an element", () => {
    const el = svgEl("line");
    setAttrs(el, { x1: 0, y1: 1, x2: 10, y2: 11, stroke: "red" });
    expect(el.getAttribute("x1")).toBe("0");
    expect(el.getAttribute("y1")).toBe("1");
    expect(el.getAttribute("x2")).toBe("10");
    expect(el.getAttribute("y2")).toBe("11");
    expect(el.getAttribute("stroke")).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// createSvgScaffold
// ---------------------------------------------------------------------------

describe("createSvgScaffold", () => {
  let container: HTMLDivElement;
  let scaffold: SvgScaffold;

  beforeEach(() => {
    container = document.createElement("div");
    scaffold = createSvgScaffold(container);
  });

  it("creates an <svg> element appended to the container", () => {
    expect(scaffold.svg.tagName.toLowerCase()).toBe("svg");
    expect(scaffold.svg.namespaceURI).toBe(SVG_NS);
    expect(container.children[0]).toBe(scaffold.svg);
  });

  it("creates exactly 5 child <g> groups", () => {
    const groups = Array.from(scaffold.svg.children).filter(
      (el) => el.tagName.toLowerCase() === "g",
    );
    expect(groups.length).toBe(5);
  });

  it("each <g> has the correct id attribute", () => {
    for (const id of LAYER_IDS) {
      const g = scaffold.svg.querySelector(`#${id}`);
      expect(g).not.toBeNull();
      expect(g!.tagName.toLowerCase()).toBe("g");
    }
  });

  it("layers are in the correct z-order (grid first, interaction last)", () => {
    const groups = Array.from(scaffold.svg.children).filter(
      (el) => el.tagName.toLowerCase() === "g",
    );
    const ids = groups.map((g) => g.getAttribute("id"));
    expect(ids).toEqual([
      "layer-grid",
      "layer-chords",
      "layer-dots",
      "layer-path",
      "layer-interaction",
    ]);
  });

  it("returns layer references that match the DOM elements", () => {
    expect(scaffold.layers["layer-grid"]).toBe(
      scaffold.svg.querySelector("#layer-grid"),
    );
    expect(scaffold.layers["layer-interaction"]).toBe(
      scaffold.svg.querySelector("#layer-interaction"),
    );
  });
});

// ---------------------------------------------------------------------------
// renderGrid — 1×1 window (2 triangles)
// ---------------------------------------------------------------------------

describe("renderGrid — 1×1 window", () => {
  let gridLayer: SVGGElement;
  let bounds: WindowBounds;

  beforeEach(() => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    gridLayer = scaffold.layers["layer-grid"];
    bounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);
  });

  it("produces 2 <polygon> elements (1 Up + 1 Down triangle)", () => {
    const polygons = gridLayer.querySelectorAll("polygon");
    expect(polygons.length).toBe(2);
  });

  it("produces 4 unique <circle> nodes", () => {
    const circles = gridLayer.querySelectorAll("circle");
    expect(circles.length).toBe(4);
  });

  it("produces 4 <text> labels", () => {
    const texts = gridLayer.querySelectorAll("text");
    expect(texts.length).toBe(4);
  });

  it("produces 5 unique <line> edges", () => {
    const lines = gridLayer.querySelectorAll("line");
    expect(lines.length).toBe(5);
  });

  it("all polygons have data-id attributes starting with T:", () => {
    const polygons = gridLayer.querySelectorAll("polygon");
    for (const poly of polygons) {
      const id = poly.getAttribute("data-id");
      expect(id).toBeTruthy();
      expect(id!.startsWith("T:")).toBe(true);
    }
  });

  it("all lines have data-id attributes starting with E:", () => {
    const lines = gridLayer.querySelectorAll("line");
    for (const line of lines) {
      const id = line.getAttribute("data-id");
      expect(id).toBeTruthy();
      expect(id!.startsWith("E:")).toBe(true);
    }
  });

  it("all circles have data-id attributes starting with N:", () => {
    const circles = gridLayer.querySelectorAll("circle");
    for (const circle of circles) {
      const id = circle.getAttribute("data-id");
      expect(id).toBeTruthy();
      expect(id!.startsWith("N:")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// renderGrid — 2×2 window
// ---------------------------------------------------------------------------

describe("renderGrid — 2×2 window", () => {
  let gridLayer: SVGGElement;

  beforeEach(() => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    gridLayer = scaffold.layers["layer-grid"];
    // 2×2 anchors: uMin=0, uMax=1, vMin=0, vMax=1
    const bounds: WindowBounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);
  });

  it("produces 8 <polygon> elements (4 Up + 4 Down)", () => {
    const polygons = gridLayer.querySelectorAll("polygon");
    expect(polygons.length).toBe(8);
  });

  it("element counts match WindowIndices map sizes", () => {
    const bounds: WindowBounds = { uMin: 0, uMax: 1, vMin: 0, vMax: 1 };
    const indices = buildWindowIndices(bounds);

    const polygons = gridLayer.querySelectorAll("polygon");
    const lines = gridLayer.querySelectorAll("line");
    const circles = gridLayer.querySelectorAll("circle");

    expect(polygons.length).toBe(indices.triIdToRef.size);
    expect(lines.length).toBe(indices.edgeToTris.size);
    expect(circles.length).toBe(indices.nodeToTris.size);
  });
});

// ---------------------------------------------------------------------------
// renderGrid — vertex coordinate correctness
// ---------------------------------------------------------------------------

describe("renderGrid — coordinate correctness", () => {
  it("polygon vertex coords match latticeToWorld for each triangle", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    const bounds: WindowBounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);

    const polygons = gridLayer.querySelectorAll("polygon");

    for (const poly of polygons) {
      const tid = poly.getAttribute("data-id")!;
      const ref = indices.triIdToRef.get(tid as any)!;
      expect(ref).toBeDefined();

      const verts = triVertices(ref);
      const expectedPoints = verts
        .map((c) => {
          const w = latticeToWorld(c.u, c.v);
          return `${w.x},${w.y}`;
        })
        .join(" ");

      expect(poly.getAttribute("points")).toBe(expectedPoints);
    }
  });

  it("circle positions match latticeToWorld for each node", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    const bounds: WindowBounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);

    const circles = gridLayer.querySelectorAll("circle");
    for (const circle of circles) {
      const nid = circle.getAttribute("data-id")!;
      const { u, v } = parseNodeId(nid as any);
      const w = latticeToWorld(u, v);

      expect(circle.getAttribute("cx")).toBe(String(w.x));
      expect(circle.getAttribute("cy")).toBe(String(w.y));
    }
  });
});

// ---------------------------------------------------------------------------
// renderGrid — pitch-class label correctness
// ---------------------------------------------------------------------------

describe("renderGrid — pitch-class labels", () => {
  const PC_NAMES = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  ];

  it("all text labels contain correct pitch-class names", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    // Use a slightly larger window to get more pitch classes
    const bounds: WindowBounds = { uMin: -1, uMax: 1, vMin: -1, vMax: 1 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);

    const texts = gridLayer.querySelectorAll("text");
    expect(texts.length).toBeGreaterThan(0);

    for (const text of texts) {
      const labelId = text.getAttribute("data-id")!;
      const nid = labelId.slice(6); // strip "label-"
      const { u, v } = parseNodeId(nid as any);
      const expected = PC_NAMES[pc(u, v)];
      expect(text.textContent).toBe(expected);
    }
  });

  it("node at origin (0,0) has label C", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    const bounds: WindowBounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);

    const label = gridLayer.querySelector('[data-id="label-N:0,0"]');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe("C");
  });

  it("node at (1,0) has label G (pc = 7)", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    const bounds: WindowBounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);

    const label = gridLayer.querySelector('[data-id="label-N:1,0"]');
    expect(label).not.toBeNull();
    expect(label!.textContent).toBe("G");
  });
});

// ---------------------------------------------------------------------------
// renderGrid — SVG namespace correctness
// ---------------------------------------------------------------------------

describe("renderGrid — SVG namespace", () => {
  it("all rendered elements have correct SVG namespace", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    const bounds: WindowBounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);
    renderGrid(gridLayer, indices);

    const allElements = gridLayer.querySelectorAll("*");
    for (const el of allElements) {
      expect(el.namespaceURI).toBe(SVG_NS);
    }
  });
});

// ---------------------------------------------------------------------------
// renderGrid — re-render clears previous content
// ---------------------------------------------------------------------------

describe("renderGrid — idempotency", () => {
  it("calling renderGrid twice does not duplicate elements", () => {
    const container = document.createElement("div");
    const scaffold = createSvgScaffold(container);
    const gridLayer = scaffold.layers["layer-grid"];
    const bounds: WindowBounds = { uMin: 0, uMax: 0, vMin: 0, vMax: 0 };
    const indices = buildWindowIndices(bounds);

    renderGrid(gridLayer, indices);
    const countAfterFirst = gridLayer.children.length;

    renderGrid(gridLayer, indices);
    const countAfterSecond = gridLayer.children.length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });
});
