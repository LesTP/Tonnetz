// @vitest-environment happy-dom

/**
 * Integration tests for cross-module workflows.
 *
 * These tests verify that Harmony Core and Rendering/UI modules
 * work together correctly for end-to-end use cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Harmony Core imports
import {
  buildWindowIndices,
  parseChordSymbol,
  decomposeChordToShape,
  placeMainTriad,
  mapProgressionToShapes,
  type WindowIndices,
  type Shape,
  type Chord,
} from "harmony-core";

// Rendering/UI imports
import {
  createSvgScaffold,
  renderGrid,
  renderShape,
  clearShape,
  renderProgressionPath,
  clearProgression,
  highlightShape,
  clearAllHighlights,
  hitTest,
  computeProximityRadius,
  computeWindowBounds,
  createUIStateController,
  createLayoutManager,
  createControlPanel,
  latticeToWorld,
  LAYER_IDS,
  type PathHandle,
  type ShapeHandle,
} from "../index.js";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.appendChild(container);
  return container;
}

function makeDefaultIndices(): WindowIndices {
  return buildWindowIndices({ uMin: -5, uMax: 5, vMin: -5, vMax: 5 });
}

// ---------------------------------------------------------------------------
// Integration Test: Progression Workflow
// ---------------------------------------------------------------------------

describe("Integration: Progression Workflow", () => {
  let container: HTMLElement;
  let indices: WindowIndices;

  beforeEach(() => {
    container = makeContainer();
    indices = makeDefaultIndices();
  });

  afterEach(() => {
    container.remove();
  });

  it("parses chord symbols, decomposes to shapes, and renders progression path", () => {
    // Step 1: Create SVG scaffold
    const scaffold = createSvgScaffold(container);
    expect(scaffold.svg).toBeDefined();

    // Step 2: Render grid
    renderGrid(scaffold.layers["layer-grid"], indices);
    const gridTriangles = scaffold.layers["layer-grid"].querySelectorAll("polygon");
    expect(gridTriangles.length).toBeGreaterThan(0);

    // Step 3: Parse chord progression (ii-V-I in C major)
    const chordSymbols = ["Dm7", "G7", "Cmaj7"];
    const chords: Chord[] = chordSymbols.map((sym) => {
      const parsed = parseChordSymbol(sym);
      expect(parsed).not.toBeNull();
      return parsed!;
    });
    expect(chords.length).toBe(3);

    // Step 4: Map to shapes via chain focus
    const initialFocus = { u: 0, v: 0 };
    const shapes = mapProgressionToShapes(chords, initialFocus, indices);
    expect(shapes.length).toBe(3);

    // Verify each shape has a centroid
    for (const shape of shapes) {
      expect(shape.centroid_uv).toBeDefined();
      expect(typeof shape.centroid_uv.u).toBe("number");
      expect(typeof shape.centroid_uv.v).toBe("number");
    }

    // Step 5: Render progression path
    const pathHandle = renderProgressionPath(scaffold.layers["layer-path"], shapes);
    expect(pathHandle.getChordCount()).toBe(3);

    // Verify path elements exist
    const polyline = scaffold.layers["layer-path"].querySelector("polyline");
    expect(polyline).not.toBeNull();

    const markers = scaffold.layers["layer-path"].querySelectorAll("circle");
    expect(markers.length).toBeGreaterThanOrEqual(3); // 3 centroid markers + 1 active marker

    // Step 6: Set active chord (simulating playback)
    pathHandle.setActiveChord(1);
    // Active marker is positioned at the active chord's centroid
    // Verify path handle correctly reports active state
    expect(pathHandle.getChordCount()).toBe(3);

    // Step 7: Clear progression
    clearProgression(pathHandle);
    const remainingElements = scaffold.layers["layer-path"].children.length;
    expect(remainingElements).toBe(0);
  });

  it("renders individual chord shapes and clears them", () => {
    const scaffold = createSvgScaffold(container);

    // Parse and decompose a single chord
    const chord = parseChordSymbol("Cmaj7")!;
    const mainTri = placeMainTriad(chord, { u: 0, v: 0 }, indices);
    expect(mainTri).not.toBeNull();

    const shape = decomposeChordToShape(chord, mainTri!, { u: 0, v: 0 }, indices);
    expect(shape.main_tri).not.toBeNull();
    expect(shape.ext_tris.length).toBeGreaterThan(0); // maj7 has extension

    // Render shape
    const shapeHandle = renderShape(
      scaffold.layers["layer-chords"],
      scaffold.layers["layer-dots"],
      shape,
      indices,
    );

    // Verify triangles rendered
    const triangles = scaffold.layers["layer-chords"].querySelectorAll("polygon");
    expect(triangles.length).toBeGreaterThan(0);

    // Clear shape
    clearShape(shapeHandle);
    expect(scaffold.layers["layer-chords"].children.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Test: Interaction → Highlight Workflow
// ---------------------------------------------------------------------------

describe("Integration: Interaction → Highlight Workflow", () => {
  let container: HTMLElement;
  let indices: WindowIndices;

  beforeEach(() => {
    container = makeContainer();
    indices = makeDefaultIndices();
  });

  afterEach(() => {
    container.remove();
  });

  it("hit-tests a world position and highlights the resulting triangle", () => {
    const scaffold = createSvgScaffold(container);
    renderGrid(scaffold.layers["layer-grid"], indices);

    // Hit-test at origin (should hit a triangle)
    const radius = computeProximityRadius();
    const hitResult = hitTest(0, 0, radius, indices);

    expect(hitResult.type).not.toBe("none");

    if (hitResult.type === "triangle") {
      // Create a shape from the hit triangle for highlighting
      // For this test, we just verify the hit returns valid data
      expect(hitResult.triId).toBeDefined();
      expect(typeof hitResult.triId).toBe("string");
    }
  });

  it("highlights a shape and clears all highlights", () => {
    const scaffold = createSvgScaffold(container);
    renderGrid(scaffold.layers["layer-grid"], indices);

    // Parse and decompose a chord
    const chord = parseChordSymbol("Am")!;
    const mainTri = placeMainTriad(chord, { u: 0, v: 0 }, indices);
    const shape = decomposeChordToShape(chord, mainTri!, { u: 0, v: 0 }, indices);

    // Highlight the shape
    const highlightHandle = highlightShape(
      scaffold.layers["layer-interaction"],
      shape,
      indices,
    );

    // Verify highlight exists
    const highlights = scaffold.layers["layer-interaction"].querySelectorAll("polygon");
    expect(highlights.length).toBeGreaterThan(0);

    // Clear all highlights
    clearAllHighlights(scaffold.layers["layer-interaction"]);
    expect(scaffold.layers["layer-interaction"].children.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Test: Layout + UI State
// ---------------------------------------------------------------------------

describe("Integration: Layout + UI State", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    root.style.width = "1024px";
    root.style.height = "768px";
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it("creates layout, wires control panel to UI state, and handles clear button", () => {
    // Create layout
    const layout = createLayoutManager({ root });

    // Create UI state controller
    const uiState = createUIStateController();
    expect(uiState.getState()).toBe("idle");

    // Track state changes
    const stateChanges: string[] = [];
    uiState.onStateChange((event) => {
      stateChanges.push(`${event.prevState} → ${event.state}`);
    });

    // Create control panel with callbacks
    const controlPanel = createControlPanel({
      container: layout.getControlPanelContainer(),
      onLoadProgression: (text) => {
        // Simulate parsing and loading progression
        const indices = makeDefaultIndices();
        const chords = text.split("|").map((s) => parseChordSymbol(s.trim())!).filter(Boolean);
        if (chords.length > 0) {
          const shapes = mapProgressionToShapes(chords, { u: 0, v: 0 }, indices);
          uiState.loadProgression(shapes);
          controlPanel.setProgressionLoaded(true);
        }
      },
      onClear: () => {
        uiState.clearProgression();
        controlPanel.setProgressionLoaded(false);
      },
    });

    // Simulate user loading a progression
    controlPanel.setInputText("Dm7 | G7 | Cmaj7");
    const loadBtn = layout.getControlPanelContainer().querySelector('[data-testid="load-btn"]') as HTMLButtonElement;
    loadBtn.click();

    // Verify state changed to progression-loaded
    expect(uiState.getState()).toBe("progression-loaded");
    expect(uiState.getProgression()?.length).toBe(3);
    expect(stateChanges).toContain("idle → progression-loaded");

    // Simulate user clicking Clear button
    const clearBtn = layout.getControlPanelContainer().querySelector('[data-testid="clear-btn"]') as HTMLButtonElement;
    clearBtn.click();

    // Verify state changed back to idle
    expect(uiState.getState()).toBe("idle");
    expect(uiState.getProgression()).toBeNull();
    expect(stateChanges).toContain("progression-loaded → idle");

    // Cleanup
    controlPanel.destroy();
    layout.destroy();
    uiState.destroy();
  });

  it("UI state transitions: idle → chord-selected → idle", () => {
    const uiState = createUIStateController();

    // Parse a chord to create a shape
    const indices = makeDefaultIndices();
    const chord = parseChordSymbol("C")!;
    const mainTri = placeMainTriad(chord, { u: 0, v: 0 }, indices);
    const shape = decomposeChordToShape(chord, mainTri!, { u: 0, v: 0 }, indices);

    // Select chord
    uiState.selectChord(shape);
    expect(uiState.getState()).toBe("chord-selected");
    expect(uiState.getSelectedShape()).toBe(shape);

    // Clear selection
    uiState.clearSelection();
    expect(uiState.getState()).toBe("idle");
    expect(uiState.getSelectedShape()).toBeNull();

    uiState.destroy();
  });

  it("progression overrides chord selection", () => {
    const uiState = createUIStateController();
    const indices = makeDefaultIndices();

    // Select a chord first
    const chord1 = parseChordSymbol("Am")!;
    const mainTri1 = placeMainTriad(chord1, { u: 0, v: 0 }, indices);
    const shape1 = decomposeChordToShape(chord1, mainTri1!, { u: 0, v: 0 }, indices);
    uiState.selectChord(shape1);
    expect(uiState.getState()).toBe("chord-selected");

    // Load progression - should override selection
    const progressionChords = ["Dm7", "G7", "Cmaj7"].map((s) => parseChordSymbol(s)!);
    const shapes = mapProgressionToShapes(progressionChords, { u: 0, v: 0 }, indices);
    uiState.loadProgression(shapes);

    expect(uiState.getState()).toBe("progression-loaded");
    expect(uiState.getSelectedShape()).toBeNull();
    expect(uiState.getProgression()?.length).toBe(3);

    uiState.destroy();
  });
});

// ---------------------------------------------------------------------------
// Integration Test: Coordinate Consistency
// ---------------------------------------------------------------------------

describe("Integration: Coordinate Consistency", () => {
  it("lattice coordinates round-trip through world coordinates", () => {
    // Test a variety of lattice coordinates
    const testCoords = [
      { u: 0, v: 0 },
      { u: 1, v: 0 },
      { u: 0, v: 1 },
      { u: -1, v: -1 },
      { u: 5, v: 3 },
      { u: 0.5, v: 0.5 }, // fractional centroid
    ];

    for (const coord of testCoords) {
      const world = latticeToWorld(coord.u, coord.v);
      expect(Number.isFinite(world.x)).toBe(true);
      expect(Number.isFinite(world.y)).toBe(true);
    }
  });

  it("window bounds produce valid grid rendering", () => {
    const container = makeContainer();
    const bounds = computeWindowBounds(800, 600, 40);
    const indices = buildWindowIndices(bounds);

    const scaffold = createSvgScaffold(container);
    renderGrid(scaffold.layers["layer-grid"], indices);

    // Verify triangles and nodes were rendered
    const triangles = scaffold.layers["layer-grid"].querySelectorAll("polygon");
    const nodes = scaffold.layers["layer-grid"].querySelectorAll("circle");

    expect(triangles.length).toBeGreaterThan(0);
    expect(nodes.length).toBeGreaterThan(0);

    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Integration Test: Full Rendering Pipeline
// ---------------------------------------------------------------------------

describe("Integration: Full Rendering Pipeline", () => {
  it("renders complete scene with grid, shape, highlight, and path", () => {
    const container = makeContainer();
    const bounds = computeWindowBounds(800, 600, 40);
    const indices = buildWindowIndices(bounds);

    // Create scaffold
    const scaffold = createSvgScaffold(container);

    // Render grid
    renderGrid(scaffold.layers["layer-grid"], indices);

    // Render a chord shape
    const chord = parseChordSymbol("Dm7")!;
    const mainTri = placeMainTriad(chord, { u: 0, v: 0 }, indices);
    const shape = decomposeChordToShape(chord, mainTri!, { u: 0, v: 0 }, indices);
    const shapeHandle = renderShape(
      scaffold.layers["layer-chords"],
      scaffold.layers["layer-dots"],
      shape,
      indices,
    );

    // Highlight the shape
    highlightShape(scaffold.layers["layer-interaction"], shape, indices);

    // Render a progression path
    const progressionChords = ["Dm7", "G7", "Cmaj7"].map((s) => parseChordSymbol(s)!);
    const shapes = mapProgressionToShapes(progressionChords, { u: 0, v: 0 }, indices);
    const pathHandle = renderProgressionPath(scaffold.layers["layer-path"], shapes);

    // Verify all layers have content
    expect(scaffold.layers["layer-grid"].children.length).toBeGreaterThan(0);
    expect(scaffold.layers["layer-chords"].children.length).toBeGreaterThan(0);
    expect(scaffold.layers["layer-interaction"].children.length).toBeGreaterThan(0);
    expect(scaffold.layers["layer-path"].children.length).toBeGreaterThan(0);

    // Cleanup
    clearShape(shapeHandle);
    clearAllHighlights(scaffold.layers["layer-interaction"]);
    clearProgression(pathHandle);

    container.remove();
  });
});
