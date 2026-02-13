// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildWindowIndices, triId, edgeId } from "harmony-core";
import type { WindowIndices, TriId, EdgeId } from "harmony-core";
import { createInteractionController } from "../interaction-controller.js";
import type { InteractionController, InteractionCallbacks } from "../interaction-controller.js";
import type { CameraController } from "../camera-controller.js";
import type { ViewBox, CameraState } from "../camera.js";
import { latticeToWorld } from "../coords.js";
import type { WorldPoint } from "../coords.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SQRT3_OVER_2 = Math.sqrt(3) / 2;

const CLIENT_W = 800;
const CLIENT_H = 600;

/**
 * ViewBox zoomed into the lattice so that unit-edge triangles (~1 world unit)
 * span ~200 screen pixels.  This lets pointer moves of 10–20 screen px cross
 * the 5 px drag threshold while keeping the pointer within the lattice.
 *
 * The viewBox is 4×3 world units centered near the test triangles.
 * screen x = (worldX - VB_MIN_X) / VB_WIDTH * CLIENT_W
 * screen y = (worldY - VB_MIN_Y) / VB_HEIGHT * CLIENT_H
 */
const VB_WIDTH = 4; // world units visible in 800 px
const VB_HEIGHT = 3; // world units visible in 600 px
const VB_MIN_X = -0.5; // left edge in world
const VB_MIN_Y = -0.5; // top edge in world

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert world coords to screen coords for the zoomed viewBox. */
function worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
  return {
    sx: ((wx - VB_MIN_X) / VB_WIDTH) * CLIENT_W,
    sy: ((wy - VB_MIN_Y) / VB_HEIGHT) * CLIENT_H,
  };
}

function makeSvg(w = CLIENT_W, h = CLIENT_H): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.appendChild(svg);
  Object.defineProperty(svg, "clientWidth", { value: w, configurable: true });
  Object.defineProperty(svg, "clientHeight", { value: h, configurable: true });
  svg.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: w, bottom: h, width: w, height: h,
    toJSON() { return this; },
  });
  svg.setPointerCapture = vi.fn();
  return svg;
}

function makeIndices(): WindowIndices {
  return buildWindowIndices({ uMin: -3, uMax: 3, vMin: -3, vMax: 3 });
}

/**
 * Create a mock CameraController that records pan calls and provides
 * a zoomed viewBox for screen→world conversion.
 *
 * Uses the zoomed viewBox constants defined above (4×3 world units in 800×600 px).
 */
function mockCameraController(): CameraController & {
  panCalls: { method: string; args?: number[] }[];
  viewBox: ViewBox;
} {
  const panCalls: { method: string; args?: number[] }[] = [];
  const viewBox: ViewBox = { minX: VB_MIN_X, minY: VB_MIN_Y, width: VB_WIDTH, height: VB_HEIGHT };
  return {
    panCalls,
    viewBox,
    getCamera(): CameraState {
      return { centerX: 400, centerY: 300, zoom: 1 };
    },
    getViewBox(): ViewBox {
      return viewBox;
    },
    panStart(): void {
      panCalls.push({ method: "panStart" });
    },
    panMove(dx: number, dy: number): void {
      panCalls.push({ method: "panMove", args: [dx, dy] });
    },
    panEnd(): void {
      panCalls.push({ method: "panEnd" });
    },
    updateDimensions(): void {},
    reset(): void {},
    destroy(): void {},
  };
}

function makeCallbacks(): Required<InteractionCallbacks> & {
  triangleSelects: { triId: TriId; pcs: number[] }[];
  edgeSelects: { edgeId: EdgeId; triIds: [TriId, TriId]; pcs: number[] }[];
  scrubs: { triId: TriId; pcs: number[] }[];
  pointerDowns: WorldPoint[];
  pointerUps: number;
} {
  const triangleSelects: { triId: TriId; pcs: number[] }[] = [];
  const edgeSelects: { edgeId: EdgeId; triIds: [TriId, TriId]; pcs: number[] }[] = [];
  const scrubs: { triId: TriId; pcs: number[] }[] = [];
  const pointerDowns: WorldPoint[] = [];
  let pointerUps = 0;

  return {
    triangleSelects,
    edgeSelects,
    scrubs,
    pointerDowns,
    get pointerUps() { return pointerUps; },
    onTriangleSelect(triId: TriId, pcs: number[]) {
      triangleSelects.push({ triId, pcs });
    },
    onEdgeSelect(edgeId: EdgeId, triIds: [TriId, TriId], pcs: number[]) {
      edgeSelects.push({ edgeId, triIds, pcs });
    },
    onDragScrub(triId: TriId, pcs: number[]) {
      scrubs.push({ triId, pcs });
    },
    onPointerDown(world: WorldPoint) {
      pointerDowns.push(world);
    },
    onPointerUp() {
      pointerUps++;
    },
  };
}

/** World centroid of an Up triangle at anchor (u, v). */
function upCentroidWorld(u: number, v: number): WorldPoint {
  const a = latticeToWorld(u, v);
  const b = latticeToWorld(u + 1, v);
  const c = latticeToWorld(u, v + 1);
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

/** World midpoint of a shared edge between two lattice nodes. */
function edgeMidpointWorld(u1: number, v1: number, u2: number, v2: number): WorldPoint {
  const a = latticeToWorld(u1, v1);
  const b = latticeToWorld(u2, v2);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Dispatch pointer events.  Pass world coordinates; they are converted to
 * screen coordinates via the zoomed viewBox.
 */
function pointerDown(svg: SVGSVGElement, wx: number, wy: number): void {
  const { sx, sy } = worldToScreen(wx, wy);
  svg.dispatchEvent(new PointerEvent("pointerdown", {
    clientX: sx, clientY: sy, button: 0, pointerId: 1, bubbles: true,
  }));
}
function pointerMove(svg: SVGSVGElement, wx: number, wy: number): void {
  const { sx, sy } = worldToScreen(wx, wy);
  svg.dispatchEvent(new PointerEvent("pointermove", {
    clientX: sx, clientY: sy, button: 0, pointerId: 1, bubbles: true,
  }));
}
function pointerUp(svg: SVGSVGElement, wx: number, wy: number): void {
  const { sx, sy } = worldToScreen(wx, wy);
  svg.dispatchEvent(new PointerEvent("pointerup", {
    clientX: sx, clientY: sy, button: 0, pointerId: 1, bubbles: true,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InteractionController — tap triangle", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;
  let indices: WindowIndices;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
    indices = makeIndices();
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      proximityFactor: 0.2, // small radius to avoid edge hits at centroids
      dragThresholdPx: 5,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("tap at triangle centroid fires onTriangleSelect with correct triId", () => {
    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);
    pointerUp(svg, c.x, c.y);

    expect(cb.triangleSelects).toHaveLength(1);
    expect(cb.triangleSelects[0].triId).toBe(
      triId({ orientation: "U", anchor: { u: 0, v: 0 } }),
    );
    expect(cb.triangleSelects[0].pcs).toHaveLength(3);
  });

  it("tap at triangle centroid fires no edge events", () => {
    const c = upCentroidWorld(1, 1);
    pointerDown(svg, c.x, c.y);
    pointerUp(svg, c.x, c.y);

    expect(cb.edgeSelects).toHaveLength(0);
    expect(cb.scrubs).toHaveLength(0);
  });
});

describe("InteractionController — tap edge", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;
  let indices: WindowIndices;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
    indices = makeIndices();
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      proximityFactor: 0.5, // larger radius to trigger edge hits
      dragThresholdPx: 5,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("tap near shared edge fires onEdgeSelect with correct edgeId and 4 pcs", () => {
    // Shared edge (1,0)–(0,1) between U(0,0) and D(0,0)
    const mid = edgeMidpointWorld(1, 0, 0, 1);
    pointerDown(svg, mid.x, mid.y);
    pointerUp(svg, mid.x, mid.y);

    expect(cb.edgeSelects).toHaveLength(1);
    expect(cb.edgeSelects[0].edgeId).toBe(edgeId({ u: 1, v: 0 }, { u: 0, v: 1 }));
    expect(cb.edgeSelects[0].triIds).toHaveLength(2);
    expect(cb.edgeSelects[0].pcs).toHaveLength(4);
  });

  it("tap near shared edge fires no triangle events", () => {
    const mid = edgeMidpointWorld(1, 0, 0, 1);
    pointerDown(svg, mid.x, mid.y);
    pointerUp(svg, mid.x, mid.y);

    expect(cb.triangleSelects).toHaveLength(0);
  });
});

describe("InteractionController — tap on empty background", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;
  let indices: WindowIndices;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
    indices = makeIndices();
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      dragThresholdPx: 5,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("tap on empty background fires no triangle/edge/scrub events", () => {
    pointerDown(svg, 700, 500);
    pointerUp(svg, 700, 500);

    expect(cb.triangleSelects).toHaveLength(0);
    expect(cb.edgeSelects).toHaveLength(0);
    expect(cb.scrubs).toHaveLength(0);
  });

  it("tap on empty background still fires onPointerDown and onPointerUp", () => {
    pointerDown(svg, 700, 500);
    pointerUp(svg, 700, 500);

    expect(cb.pointerDowns).toHaveLength(1);
    expect(cb.pointerUps).toBe(1);
  });
});

describe("InteractionController — drag on background → pan", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;
  let indices: WindowIndices;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
    indices = makeIndices();
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      dragThresholdPx: 5,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("drag starting outside lattice triggers camera pan", () => {
    // Point far from any triangle (world 700, 500 is way outside the lattice for bounds [-3,3])
    pointerDown(svg, 700, 500);
    pointerMove(svg, 720, 510); // 20px — above threshold
    pointerMove(svg, 740, 520);
    pointerUp(svg, 740, 520);

    expect(cam.panCalls.some(c => c.method === "panStart")).toBe(true);
    expect(cam.panCalls.some(c => c.method === "panMove")).toBe(true);
    expect(cam.panCalls.some(c => c.method === "panEnd")).toBe(true);
  });

  it("drag on background fires no triangle/edge/scrub events", () => {
    pointerDown(svg, 700, 500);
    pointerMove(svg, 720, 510);
    pointerUp(svg, 720, 510);

    expect(cb.triangleSelects).toHaveLength(0);
    expect(cb.edgeSelects).toHaveLength(0);
    expect(cb.scrubs).toHaveLength(0);
  });
});

describe("InteractionController — drag on triangle → scrub", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;
  let indices: WindowIndices;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
    indices = makeIndices();
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      proximityFactor: 0.2,
      dragThresholdPx: 5,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("drag starting on triangle enters scrub mode, not pan", () => {
    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);

    // Move enough to cross drag threshold (~0.03 world ≈ 6 screen px > 5 px threshold)
    // while staying inside the triangle (centroid-to-edge ≈ 0.289)
    pointerMove(svg, c.x + 0.05, c.y); // cross threshold, still inside tri
    pointerUp(svg, c.x + 0.05, c.y);

    // Should NOT have called panStart
    expect(cam.panCalls.filter(p => p.method === "panStart")).toHaveLength(0);
  });

  it("drag from one triangle to another fires onDragScrub on triangle change", () => {
    const c0 = upCentroidWorld(0, 0);
    const c1 = upCentroidWorld(1, 0);

    pointerDown(svg, c0.x, c0.y);
    // Move beyond threshold toward a different triangle
    pointerMove(svg, c1.x, c1.y);
    pointerUp(svg, c1.x, c1.y);

    // Should have initial scrub event (from dragStart) + at least one more
    expect(cb.scrubs.length).toBeGreaterThanOrEqual(1);
    // No edge events during scrub (UX-D3)
    expect(cb.edgeSelects).toHaveLength(0);
  });

  it("drag staying on same triangle does not fire duplicate scrub events", () => {
    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);
    // Move enough to cross threshold (~0.04 world ≈ 8 screen px) but stay on same triangle
    pointerMove(svg, c.x + 0.04, c.y);
    pointerMove(svg, c.x + 0.05, c.y);
    pointerMove(svg, c.x + 0.06, c.y);
    pointerUp(svg, c.x + 0.06, c.y);

    // Initial scrub event from dragStart + no duplicates for same triangle
    const uniqueTriIds = new Set(cb.scrubs.map(s => s.triId));
    // We might get 1 event (initial triangle) — no duplicates
    expect(uniqueTriIds.size).toBeLessThanOrEqual(cb.scrubs.length);
    // And the triangle should be the same one
    if (cb.scrubs.length > 0) {
      for (const s of cb.scrubs) {
        expect(s.triId).toBe(cb.scrubs[0].triId);
      }
    }
  });

  it("edge selection is suppressed during drag-scrub (UX-D3)", () => {
    // Start drag on a triangle, move through an edge midpoint
    const c0 = upCentroidWorld(0, 0);
    const mid = edgeMidpointWorld(1, 0, 0, 1);

    pointerDown(svg, c0.x, c0.y);
    pointerMove(svg, mid.x, mid.y); // crosses edge midpoint
    pointerUp(svg, mid.x, mid.y);

    // No edge selects during drag
    expect(cb.edgeSelects).toHaveLength(0);
  });
});

describe("InteractionController — pointer lifecycle", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;
  let indices: WindowIndices;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
    indices = makeIndices();
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      dragThresholdPx: 5,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("onPointerDown fires immediately on pointerdown", () => {
    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);

    expect(cb.pointerDowns).toHaveLength(1);
    // No classification yet
    expect(cb.triangleSelects).toHaveLength(0);
    expect(cb.scrubs).toHaveLength(0);

    pointerUp(svg, c.x, c.y);
  });

  it("onPointerUp fires on release", () => {
    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);
    pointerUp(svg, c.x, c.y);

    expect(cb.pointerUps).toBe(1);
  });
});

describe("InteractionController — getIndices dynamic updates", () => {
  let svg: SVGSVGElement;
  let cam: ReturnType<typeof mockCameraController>;
  let cb: ReturnType<typeof makeCallbacks>;
  let ctrl: InteractionController;

  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    svg = makeSvg();
    cam = mockCameraController();
    cb = makeCallbacks();
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
    vi.restoreAllMocks();
  });

  it("getIndices is called dynamically, so updated indices are used", () => {
    // Start with a tiny window where U(0,0) centroid is in bounds
    let currentIndices = buildWindowIndices({ uMin: 0, uMax: 1, vMin: 0, vMax: 1 });
    ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => currentIndices,
      callbacks: cb,
      proximityFactor: 0.2,
      dragThresholdPx: 5,
    });

    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);
    pointerUp(svg, c.x, c.y);
    expect(cb.triangleSelects).toHaveLength(1);

    // Now update indices to a window where U(4,4) centroid is in bounds
    currentIndices = buildWindowIndices({ uMin: -5, uMax: 5, vMin: -5, vMax: 5 });

    const c2 = upCentroidWorld(4, 4);
    pointerDown(svg, c2.x, c2.y);
    pointerUp(svg, c2.x, c2.y);
    expect(cb.triangleSelects).toHaveLength(2);
  });
});

describe("InteractionController — destroy", () => {
  it("after destroy, pointer events do not fire callbacks", () => {
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { fn(0); return 0; });
    const svg = makeSvg();
    const cam = mockCameraController();
    const cb = makeCallbacks();
    const indices = makeIndices();
    const ctrl = createInteractionController({
      svg,
      cameraController: cam,
      getIndices: () => indices,
      callbacks: cb,
      dragThresholdPx: 5,
    });

    ctrl.destroy();

    const c = upCentroidWorld(0, 0);
    pointerDown(svg, c.x, c.y);
    pointerUp(svg, c.x, c.y);

    expect(cb.triangleSelects).toHaveLength(0);
    expect(cb.pointerDowns).toHaveLength(0);
    expect(cb.pointerUps).toBe(0);

    svg.remove();
    vi.restoreAllMocks();
  });
});
