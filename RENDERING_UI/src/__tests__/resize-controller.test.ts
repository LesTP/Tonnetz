// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createResizeController,
  type ResizeController,
  type ResizeCallback,
} from "../resize-controller.js";
import { createSvgScaffold, type SvgScaffold } from "../renderer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mock ResizeObserver that lets tests trigger callbacks manually.
 * We capture the callback on construction and expose a `trigger()` helper.
 */
let resizeCallback: (() => void) | null = null;
let observeTarget: Element | null = null;
let disconnected = false;

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = () => cb([] as any, this as any);
    disconnected = false;
  }
  observe(target: Element): void {
    observeTarget = target;
  }
  unobserve(_target: Element): void {}
  disconnect(): void {
    disconnected = true;
  }
}

/**
 * Stub container dimensions. Returns a setter to simulate resize.
 */
function stubContainerDimensions(
  container: HTMLDivElement,
  w: number,
  h: number,
): (nw: number, nh: number) => void {
  Object.defineProperty(container, "clientWidth", { value: w, writable: true, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: h, writable: true, configurable: true });
  return (nw: number, nh: number) => {
    Object.defineProperty(container, "clientWidth", { value: nw, writable: true, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: nh, writable: true, configurable: true });
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResizeController", () => {
  let container: HTMLDivElement;
  let scaffold: SvgScaffold;

  beforeEach(() => {
    vi.useFakeTimers();
    // Install mock ResizeObserver
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    resizeCallback = null;
    observeTarget = null;
    disconnected = false;

    container = document.createElement("div");
    scaffold = createSvgScaffold(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // --- Initial state ---

  it("performs initial grid render on creation", () => {
    stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    // Should have rendered grid elements
    const polys = scaffold.layers["layer-grid"].querySelectorAll("polygon");
    expect(polys.length).toBeGreaterThan(0);

    ctrl.destroy();
  });

  it("does not set viewBox (that is CameraController's job)", () => {
    stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    // viewBox should NOT be set by ResizeController
    const vb = scaffold.svg.getAttribute("viewBox");
    expect(vb).toBeFalsy();

    ctrl.destroy();
  });

  it("observes the container element", () => {
    stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);
    expect(observeTarget).toBe(container);
    ctrl.destroy();
  });

  // --- Resize triggers callback ---

  it("resize invokes onResize callback after debounce", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const callbackSpy = vi.fn<ResizeCallback>();
    const ctrl = createResizeController(container, scaffold, callbackSpy);

    setSize(1280, 720);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    expect(callbackSpy).toHaveBeenCalledTimes(1);
    const info = callbackSpy.mock.calls[0][0];
    expect(info.containerWidth).toBe(1280);
    expect(info.containerHeight).toBe(720);
    expect(info.bounds).toBeDefined();
    expect(info.indices).toBeDefined();

    ctrl.destroy();
  });

  // --- Breakpoint crossing ---

  it("crossing breakpoint (desktop → phone) triggers window rebuild with smaller bounds", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    const boundsBefore = ctrl.getBounds();
    const anchorsUBefore = boundsBefore.uMax - boundsBefore.uMin;

    // Shrink to phone size
    setSize(375, 667);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    const boundsAfter = ctrl.getBounds();
    const anchorsUAfter = boundsAfter.uMax - boundsAfter.uMin;

    // Anchor count should decrease
    expect(anchorsUAfter).toBeLessThan(anchorsUBefore);

    ctrl.destroy();
  });

  it("grid element count decreases after downsizing to smaller window", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    const polysCountBefore = scaffold.layers["layer-grid"].querySelectorAll("polygon").length;

    // Shrink to phone size
    setSize(375, 667);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    const polysCountAfter = scaffold.layers["layer-grid"].querySelectorAll("polygon").length;
    expect(polysCountAfter).toBeLessThan(polysCountBefore);

    ctrl.destroy();
  });

  // --- Indices updated on breakpoint ---

  it("getIndices returns updated indices after breakpoint crossing", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    const indicesBefore = ctrl.getIndices();
    const triCountBefore = indicesBefore.triIdToRef.size;

    setSize(375, 667);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    const indicesAfter = ctrl.getIndices();
    const triCountAfter = indicesAfter.triIdToRef.size;

    expect(triCountAfter).toBeLessThan(triCountBefore);

    ctrl.destroy();
  });

  // --- Same-size resize (no breakpoint) ---

  it("same-size resize does not rebuild grid", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    const polysBefore = scaffold.layers["layer-grid"].querySelectorAll("polygon").length;

    // "Resize" to same size
    setSize(1024, 768);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    const polysAfter = scaffold.layers["layer-grid"].querySelectorAll("polygon").length;
    expect(polysAfter).toBe(polysBefore);

    ctrl.destroy();
  });

  // --- Callback still fires for same-bounds resize (container changed but bounds didn't) ---

  it("callback fires even when bounds unchanged (for viewBox aspect ratio update)", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const callbackSpy = vi.fn<ResizeCallback>();
    const ctrl = createResizeController(container, scaffold, callbackSpy);

    // Resize to slightly different dimensions that produce same bounds
    setSize(1000, 750);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    expect(callbackSpy).toHaveBeenCalledTimes(1);
    const info = callbackSpy.mock.calls[0][0];
    expect(info.containerWidth).toBe(1000);
    expect(info.containerHeight).toBe(750);

    ctrl.destroy();
  });

  // --- Debounce ---

  it("multiple rapid resizes only trigger one update (debounce)", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const callbackSpy = vi.fn<ResizeCallback>();
    const ctrl = createResizeController(container, scaffold, callbackSpy);

    // Fire many resize events rapidly
    for (let i = 0; i < 10; i++) {
      setSize(800 + i, 600 + i);
      resizeCallback!();
    }

    // No callback yet — debounce hasn't fired
    expect(callbackSpy).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(200);

    // Should have been called exactly once
    expect(callbackSpy).toHaveBeenCalledTimes(1);

    ctrl.destroy();
  });

  // --- onResize callback ---

  it("onResize callback receives correct info", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const callbackSpy = vi.fn<ResizeCallback>();
    const ctrl = createResizeController(container, scaffold, callbackSpy);

    setSize(800, 600);
    resizeCallback!();
    vi.advanceTimersByTime(200);

    expect(callbackSpy).toHaveBeenCalledTimes(1);
    const info = callbackSpy.mock.calls[0][0];
    expect(info.containerWidth).toBe(800);
    expect(info.containerHeight).toBe(600);
    expect(info.bounds).toBeDefined();
    expect(info.indices).toBeDefined();
    expect(info.indices.triIdToRef.size).toBeGreaterThan(0);

    ctrl.destroy();
  });

  // --- Destroy ---

  it("destroy disconnects ResizeObserver", () => {
    stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);
    expect(disconnected).toBe(false);

    ctrl.destroy();
    expect(disconnected).toBe(true);
  });

  it("destroy cancels pending debounce timer", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const callbackSpy = vi.fn<ResizeCallback>();
    const ctrl = createResizeController(container, scaffold, callbackSpy);

    // Trigger resize but don't wait for debounce
    setSize(800, 600);
    resizeCallback!();

    // Destroy before debounce fires
    ctrl.destroy();

    // Advance past debounce
    vi.advanceTimersByTime(200);

    // Callback should NOT have fired
    expect(callbackSpy).not.toHaveBeenCalled();
  });

  // --- Zero-size guard ---

  it("zero-size container does not cause errors", () => {
    const setSize = stubContainerDimensions(container, 1024, 768);
    const ctrl = createResizeController(container, scaffold);

    // Resize to zero (e.g., container collapsed)
    setSize(0, 0);
    resizeCallback!();

    // Should not throw
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();

    // Bounds should remain unchanged
    const bounds = ctrl.getBounds();
    expect(bounds.uMax - bounds.uMin).toBeGreaterThan(0);

    ctrl.destroy();
  });
});
