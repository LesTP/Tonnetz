// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCameraController, type CameraController } from "../camera-controller.js";
import { createSvgScaffold } from "../renderer.js";
import { computeWindowBounds } from "../camera.js";
import type { WindowBounds } from "harmony-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a viewBox attribute string into 4 numbers. */
function parseViewBox(svg: SVGSVGElement): { minX: number; minY: number; w: number; h: number } {
  const raw = svg.getAttribute("viewBox");
  expect(raw).toBeTruthy();
  const [minX, minY, w, h] = raw!.split(" ").map(Number);
  return { minX, minY, w, h };
}

/**
 * Stub clientWidth/clientHeight on an SVG element so that
 * screen-to-world conversion produces meaningful results.
 */
function stubSvgDimensions(svg: SVGSVGElement, w: number, h: number): void {
  Object.defineProperty(svg, "clientWidth", { value: w, configurable: true });
  Object.defineProperty(svg, "clientHeight", { value: h, configurable: true });
  // Also stub getBoundingClientRect for zoom pointer mapping
  svg.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: w,
    bottom: h,
    width: w,
    height: h,
    toJSON() { return this; },
  });
  // stub setPointerCapture (not implemented in happy-dom)
  svg.setPointerCapture = vi.fn();
}

/**
 * Create a standard test setup: container, scaffold, controller.
 */
function setup(cw = 800, ch = 600) {
  const container = document.createElement("div");
  const scaffold = createSvgScaffold(container);
  const bounds: WindowBounds = { uMin: -2, uMax: 2, vMin: -2, vMax: 2 };
  stubSvgDimensions(scaffold.svg, cw, ch);
  const ctrl = createCameraController(scaffold.svg, cw, ch, bounds);
  return { container, scaffold, ctrl, svg: scaffold.svg, bounds };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CameraController — initial state", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.ctrl.destroy(); });

  it("sets viewBox on the SVG element at creation", () => {
    const vb = parseViewBox(ctx.svg);
    expect(typeof vb.minX).toBe("number");
    expect(vb.w).toBeGreaterThan(0);
    expect(vb.h).toBeGreaterThan(0);
  });

  it("initial zoom is 1", () => {
    expect(ctx.ctrl.getCamera().zoom).toBe(1);
  });

  it("getViewBox matches the SVG attribute", () => {
    const vb = ctx.ctrl.getViewBox();
    const attr = parseViewBox(ctx.svg);
    expect(vb.minX).toBeCloseTo(attr.minX, 5);
    expect(vb.minY).toBeCloseTo(attr.minY, 5);
    expect(vb.width).toBeCloseTo(attr.w, 5);
    expect(vb.height).toBeCloseTo(attr.h, 5);
  });
});

// ---------------------------------------------------------------------------
// Pan
// ---------------------------------------------------------------------------

describe("CameraController — pan", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.ctrl.destroy(); });

  it("pointerdown + pointermove shifts viewBox origin", () => {
    const before = parseViewBox(ctx.svg);

    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 400, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 420, clientY: 310, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointerup", {
      clientX: 420, clientY: 310, button: 0, pointerId: 1, bubbles: true,
    }));

    const after = parseViewBox(ctx.svg);

    // Dragging right (clientX +20) should move viewBox origin left (minX decreases)
    expect(after.minX).toBeLessThan(before.minX);
    // ViewBox dimensions should be unchanged (pan doesn't zoom)
    expect(after.w).toBeCloseTo(before.w, 5);
    expect(after.h).toBeCloseTo(before.h, 5);
  });

  it("pointermove without prior pointerdown does not pan", () => {
    const before = parseViewBox(ctx.svg);

    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 420, clientY: 310, button: 0, pointerId: 1, bubbles: true,
    }));

    const after = parseViewBox(ctx.svg);
    expect(after.minX).toBeCloseTo(before.minX, 5);
    expect(after.minY).toBeCloseTo(before.minY, 5);
  });

  it("non-primary button does not trigger pan", () => {
    const before = parseViewBox(ctx.svg);

    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 400, clientY: 300, button: 2, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 420, clientY: 310, button: 2, pointerId: 1, bubbles: true,
    }));

    const after = parseViewBox(ctx.svg);
    expect(after.minX).toBeCloseTo(before.minX, 5);
  });
});

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

describe("CameraController — zoom", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.ctrl.destroy(); });

  it("wheel event with negative deltaY (scroll up) zooms in — viewBox shrinks", () => {
    const before = parseViewBox(ctx.svg);

    ctx.svg.dispatchEvent(new WheelEvent("wheel", {
      clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
    }));

    const after = parseViewBox(ctx.svg);
    expect(after.w).toBeLessThan(before.w);
    expect(after.h).toBeLessThan(before.h);
  });

  it("wheel event with positive deltaY (scroll down) zooms out — viewBox grows", () => {
    const before = parseViewBox(ctx.svg);

    ctx.svg.dispatchEvent(new WheelEvent("wheel", {
      clientX: 400, clientY: 300, deltaY: 120, bubbles: true,
    }));

    const after = parseViewBox(ctx.svg);
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.h).toBeGreaterThan(before.h);
  });

  it("zoom is clamped at maximum (repeated zoom-in)", () => {
    // Zoom in many times
    for (let i = 0; i < 100; i++) {
      ctx.svg.dispatchEvent(new WheelEvent("wheel", {
        clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
      }));
    }
    const cam = ctx.ctrl.getCamera();
    expect(cam.zoom).toBeLessThanOrEqual(8);
  });

  it("zoom is clamped at minimum (repeated zoom-out)", () => {
    for (let i = 0; i < 100; i++) {
      ctx.svg.dispatchEvent(new WheelEvent("wheel", {
        clientX: 400, clientY: 300, deltaY: 120, bubbles: true,
      }));
    }
    const cam = ctx.ctrl.getCamera();
    expect(cam.zoom).toBeGreaterThanOrEqual(0.25);
  });

  it("zoom anchor stability — world point near pointer stays approximately fixed", () => {
    // Zoom at the SVG center. With stubbed dimensions (800×600),
    // clientX=400, clientY=300 maps to center of the viewport.
    const camBefore = ctx.ctrl.getCamera();

    // Zoom in at center — when pointer is at center, the center should stay fixed
    ctx.svg.dispatchEvent(new WheelEvent("wheel", {
      clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
      // happy-dom may not pass clientX/clientY through WheelEvent;
      // so we rely on the getBoundingClientRect stub returning 800×600.
    }));

    const camAfter = ctx.ctrl.getCamera();

    // Camera center should remain approximately unchanged when zooming at center
    expect(camAfter.centerX).toBeCloseTo(camBefore.centerX, 1);
    expect(camAfter.centerY).toBeCloseTo(camBefore.centerY, 1);
    expect(camAfter.zoom).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe("CameraController — reset", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.ctrl.destroy(); });

  it("reset restores viewBox to initial values after pan", () => {
    const initial = parseViewBox(ctx.svg);

    // Pan away
    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 400, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 500, clientY: 400, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointerup", {
      clientX: 500, clientY: 400, button: 0, pointerId: 1, bubbles: true,
    }));

    const panned = parseViewBox(ctx.svg);
    expect(panned.minX).not.toBeCloseTo(initial.minX, 1);

    ctx.ctrl.reset();

    const after = parseViewBox(ctx.svg);
    expect(after.minX).toBeCloseTo(initial.minX, 5);
    expect(after.minY).toBeCloseTo(initial.minY, 5);
    expect(after.w).toBeCloseTo(initial.w, 5);
    expect(after.h).toBeCloseTo(initial.h, 5);
  });

  it("reset restores zoom to 1 after zooming", () => {
    for (let i = 0; i < 10; i++) {
      ctx.svg.dispatchEvent(new WheelEvent("wheel", {
        clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
      }));
    }
    expect(ctx.ctrl.getCamera().zoom).not.toBeCloseTo(1, 1);

    ctx.ctrl.reset();

    expect(ctx.ctrl.getCamera().zoom).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Destroy
// ---------------------------------------------------------------------------

describe("CameraController — destroy", () => {
  it("after destroy, events no longer update viewBox", () => {
    const ctx = setup();
    const before = parseViewBox(ctx.svg);

    ctx.ctrl.destroy();

    // Try panning
    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 400, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 500, clientY: 400, button: 0, pointerId: 1, bubbles: true,
    }));

    // Try zooming
    ctx.svg.dispatchEvent(new WheelEvent("wheel", {
      clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
    }));

    const after = parseViewBox(ctx.svg);
    expect(after.minX).toBeCloseTo(before.minX, 5);
    expect(after.minY).toBeCloseTo(before.minY, 5);
    expect(after.w).toBeCloseTo(before.w, 5);
    expect(after.h).toBeCloseTo(before.h, 5);
  });
});

// ---------------------------------------------------------------------------
// updateDimensions (Review Items #1 and #2)
// ---------------------------------------------------------------------------

describe("CameraController — updateDimensions", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.ctrl.destroy(); });

  it("updates viewBox after updateDimensions", () => {
    const vbBefore = parseViewBox(ctx.svg);

    const newBounds: WindowBounds = { uMin: -4, uMax: 4, vMin: -4, vMax: 4 };
    ctx.ctrl.updateDimensions(1200, 900, newBounds);

    const vbAfter = parseViewBox(ctx.svg);
    // With larger bounds, viewBox should be different
    expect(vbAfter.w).not.toBeCloseTo(vbBefore.w, 1);
  });

  it("resets camera to zoom=1 after updateDimensions", () => {
    // Zoom in first
    for (let i = 0; i < 10; i++) {
      ctx.svg.dispatchEvent(new WheelEvent("wheel", {
        clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
      }));
    }
    expect(ctx.ctrl.getCamera().zoom).toBeGreaterThan(1);

    const newBounds: WindowBounds = { uMin: -3, uMax: 3, vMin: -3, vMax: 3 };
    ctx.ctrl.updateDimensions(1024, 768, newBounds);

    expect(ctx.ctrl.getCamera().zoom).toBe(1);
  });

  it("resets camera center after updateDimensions (discards pan)", () => {
    // Pan away
    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 400, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 200, clientY: 100, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointerup", {
      clientX: 200, clientY: 100, button: 0, pointerId: 1, bubbles: true,
    }));

    const pannedCamera = ctx.ctrl.getCamera();

    // updateDimensions with same bounds should reset to initial center
    ctx.ctrl.updateDimensions(800, 600, ctx.bounds);

    const resetCamera = ctx.ctrl.getCamera();
    expect(resetCamera.zoom).toBe(1);
    // Camera center should be back at initial (different from panned)
    // We just verify it changed back — exact value depends on bounds
    const initialCtx = setup(800, 600);
    const initialCamera = initialCtx.ctrl.getCamera();
    expect(resetCamera.centerX).toBeCloseTo(initialCamera.centerX, 5);
    expect(resetCamera.centerY).toBeCloseTo(initialCamera.centerY, 5);
    initialCtx.ctrl.destroy();
  });

  it("subsequent pan uses updated dimensions for world-delta conversion", () => {
    // Update to a very wide container
    stubSvgDimensions(ctx.svg, 1600, 600);
    const newBounds: WindowBounds = { uMin: -6, uMax: 6, vMin: -3, vMax: 3 };
    ctx.ctrl.updateDimensions(1600, 600, newBounds);

    const vbBefore = parseViewBox(ctx.svg);

    // Pan with a 20px drag
    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 800, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 820, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointerup", {
      clientX: 820, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));

    const vbAfter = parseViewBox(ctx.svg);
    // Pan should have shifted origin (proves controller is using updated dimensions)
    expect(vbAfter.minX).toBeLessThan(vbBefore.minX);
  });

  it("getViewBox matches SVG attribute after updateDimensions", () => {
    const newBounds: WindowBounds = { uMin: -5, uMax: 5, vMin: -5, vMax: 5 };
    ctx.ctrl.updateDimensions(1024, 768, newBounds);

    const vb = ctx.ctrl.getViewBox();
    const attr = parseViewBox(ctx.svg);
    expect(vb.minX).toBeCloseTo(attr.minX, 5);
    expect(vb.minY).toBeCloseTo(attr.minY, 5);
    expect(vb.width).toBeCloseTo(attr.w, 5);
    expect(vb.height).toBeCloseTo(attr.h, 5);
  });
});

// ---------------------------------------------------------------------------
// viewBox attribute sync
// ---------------------------------------------------------------------------

describe("CameraController — viewBox sync", () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => { ctx = setup(); });
  afterEach(() => { ctx.ctrl.destroy(); });

  it("every camera change updates the SVG viewBox attribute", () => {
    // Pan
    ctx.svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 400, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));
    ctx.svg.dispatchEvent(new PointerEvent("pointermove", {
      clientX: 420, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));

    const vbAfterPan = ctx.ctrl.getViewBox();
    const attrAfterPan = parseViewBox(ctx.svg);
    expect(attrAfterPan.minX).toBeCloseTo(vbAfterPan.minX, 5);

    ctx.svg.dispatchEvent(new PointerEvent("pointerup", {
      clientX: 420, clientY: 300, button: 0, pointerId: 1, bubbles: true,
    }));

    // Zoom
    ctx.svg.dispatchEvent(new WheelEvent("wheel", {
      clientX: 400, clientY: 300, deltaY: -120, bubbles: true,
    }));

    const vbAfterZoom = ctx.ctrl.getViewBox();
    const attrAfterZoom = parseViewBox(ctx.svg);
    expect(attrAfterZoom.w).toBeCloseTo(vbAfterZoom.width, 5);

    // Reset
    ctx.ctrl.reset();
    const vbAfterReset = ctx.ctrl.getViewBox();
    const attrAfterReset = parseViewBox(ctx.svg);
    expect(attrAfterReset.minX).toBeCloseTo(vbAfterReset.minX, 5);
    expect(attrAfterReset.w).toBeCloseTo(vbAfterReset.width, 5);
  });
});
