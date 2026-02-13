// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createGestureController } from "../gesture-controller.js";
import type { GestureController, GestureCallbacks } from "../gesture-controller.js";
import type { ViewBox } from "../camera.js";
import type { WorldPoint } from "../coords.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal SVG element with stubbed dimensions. */
function makeSvg(w = 800, h = 600): SVGSVGElement {
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

/**
 * A simple viewBox that maps 1:1 screen pixels to world units.
 * With this viewBox, screenX=N → worldX=N, screenY=N → worldY=N.
 */
const IDENTITY_VIEWBOX: ViewBox = {
  minX: 0, minY: 0, width: 800, height: 600,
};

function makeCallbacks(): Required<GestureCallbacks> & {
  calls: Record<string, WorldPoint[]>;
  upCalls: number;
} {
  const calls: Record<string, WorldPoint[]> = {
    onPointerDown: [],
    onPointerUp: [],
    onTap: [],
    onDragStart: [],
    onDragMove: [],
    onDragEnd: [],
  };
  let upCalls = 0;
  return {
    calls,
    get upCalls() { return upCalls; },
    onPointerDown(w: WorldPoint) { calls.onPointerDown.push(w); },
    onPointerUp() { upCalls++; calls.onPointerUp.push({ x: 0, y: 0 }); },
    onTap(w: WorldPoint) { calls.onTap.push(w); },
    onDragStart(w: WorldPoint) { calls.onDragStart.push(w); },
    onDragMove(w: WorldPoint) { calls.onDragMove.push(w); },
    onDragEnd(w: WorldPoint) { calls.onDragEnd.push(w); },
  };
}

function pointerDown(svg: SVGSVGElement, x: number, y: number, opts: Partial<PointerEventInit> = {}): void {
  svg.dispatchEvent(new PointerEvent("pointerdown", {
    clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true, ...opts,
  }));
}

function pointerMove(svg: SVGSVGElement, x: number, y: number, opts: Partial<PointerEventInit> = {}): void {
  svg.dispatchEvent(new PointerEvent("pointermove", {
    clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true, ...opts,
  }));
}

function pointerUp(svg: SVGSVGElement, x: number, y: number, opts: Partial<PointerEventInit> = {}): void {
  svg.dispatchEvent(new PointerEvent("pointerup", {
    clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true, ...opts,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GestureController — tap (movement below threshold)", () => {
  let svg: SVGSVGElement;
  let ctrl: GestureController;
  let cb: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    svg = makeSvg();
    cb = makeCallbacks();
    ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      dragThresholdPx: 5,
      callbacks: cb,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
  });

  it("small movement (<5px) triggers onTap, not drag events", () => {
    pointerDown(svg, 100, 100);
    pointerMove(svg, 102, 101); // 2.2px — below threshold
    pointerUp(svg, 102, 101);

    expect(cb.calls.onTap).toHaveLength(1);
    expect(cb.calls.onDragStart).toHaveLength(0);
    expect(cb.calls.onDragMove).toHaveLength(0);
    expect(cb.calls.onDragEnd).toHaveLength(0);
  });

  it("zero movement triggers onTap", () => {
    pointerDown(svg, 200, 200);
    pointerUp(svg, 200, 200);

    expect(cb.calls.onTap).toHaveLength(1);
  });

  it("tap world coordinates are correct (identity viewBox)", () => {
    pointerDown(svg, 400, 300);
    pointerUp(svg, 400, 300);

    expect(cb.calls.onTap).toHaveLength(1);
    expect(cb.calls.onTap[0].x).toBeCloseTo(400, 1);
    expect(cb.calls.onTap[0].y).toBeCloseTo(300, 1);
  });
});

describe("GestureController — drag (movement above threshold)", () => {
  let svg: SVGSVGElement;
  let ctrl: GestureController;
  let cb: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    svg = makeSvg();
    cb = makeCallbacks();
    ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      dragThresholdPx: 5,
      callbacks: cb,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
  });

  it("large movement (>5px) triggers dragStart + dragMove + dragEnd, no tap", () => {
    pointerDown(svg, 100, 100);
    pointerMove(svg, 110, 100); // 10px — above threshold
    pointerMove(svg, 120, 100); // further drag
    pointerUp(svg, 120, 100);

    expect(cb.calls.onTap).toHaveLength(0);
    expect(cb.calls.onDragStart).toHaveLength(1);
    expect(cb.calls.onDragMove).toHaveLength(1); // second move, after drag started
    expect(cb.calls.onDragEnd).toHaveLength(1);
  });

  it("exactly at threshold triggers drag", () => {
    pointerDown(svg, 100, 100);
    pointerMove(svg, 105, 100); // exactly 5px
    pointerUp(svg, 105, 100);

    expect(cb.calls.onDragStart).toHaveLength(1);
    expect(cb.calls.onDragEnd).toHaveLength(1);
    expect(cb.calls.onTap).toHaveLength(0);
  });

  it("diagonal movement computes Euclidean distance correctly", () => {
    pointerDown(svg, 100, 100);
    pointerMove(svg, 104, 103); // sqrt(16+9)=5 — at threshold
    pointerUp(svg, 104, 103);

    expect(cb.calls.onDragStart).toHaveLength(1);
    expect(cb.calls.onTap).toHaveLength(0);
  });

  it("drag world coordinates reflect viewBox", () => {
    // Use a viewBox that's different from identity:
    // viewBox maps [10, 20, 80, 60] — so worldX = 10 + (sx/800)*80
    const customVB: ViewBox = { minX: 10, minY: 20, width: 80, height: 60 };
    ctrl.destroy();
    ctrl = createGestureController({
      svg,
      getViewBox: () => customVB,
      dragThresholdPx: 5,
      callbacks: cb,
    });

    pointerDown(svg, 400, 300);
    pointerMove(svg, 420, 300); // 20px → drag

    expect(cb.calls.onDragStart).toHaveLength(1);
    // worldX at screenX=420: 10 + (420/800)*80 = 10 + 42 = 52
    expect(cb.calls.onDragStart[0].x).toBeCloseTo(52, 1);
    // worldY at screenY=300: 20 + (300/600)*60 = 20 + 30 = 50
    expect(cb.calls.onDragStart[0].y).toBeCloseTo(50, 1);
  });
});

describe("GestureController — pointer lifecycle", () => {
  let svg: SVGSVGElement;
  let ctrl: GestureController;
  let cb: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    svg = makeSvg();
    cb = makeCallbacks();
    ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      dragThresholdPx: 5,
      callbacks: cb,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
  });

  it("onPointerDown fires immediately on pointerdown", () => {
    pointerDown(svg, 200, 200);
    expect(cb.calls.onPointerDown).toHaveLength(1);
    // Not yet classified — no tap or drag
    expect(cb.calls.onTap).toHaveLength(0);
    expect(cb.calls.onDragStart).toHaveLength(0);
  });

  it("onPointerUp fires on release after tap", () => {
    pointerDown(svg, 200, 200);
    pointerUp(svg, 200, 200);

    expect(cb.upCalls).toBe(1);
  });

  it("onPointerUp fires on release after drag", () => {
    pointerDown(svg, 200, 200);
    pointerMove(svg, 220, 200); // drag
    pointerUp(svg, 220, 200);

    expect(cb.upCalls).toBe(1);
    expect(cb.calls.onDragEnd).toHaveLength(1);
  });

  it("second pointerdown before pointerup is ignored", () => {
    pointerDown(svg, 100, 100);
    pointerDown(svg, 200, 200); // second down — should be ignored

    expect(cb.calls.onPointerDown).toHaveLength(1);
  });
});

describe("GestureController — button filtering", () => {
  let svg: SVGSVGElement;
  let ctrl: GestureController;
  let cb: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    svg = makeSvg();
    cb = makeCallbacks();
    ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      callbacks: cb,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
  });

  it("right-click (button 2) is ignored", () => {
    svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 100, clientY: 100, button: 2, pointerId: 1, bubbles: true,
    }));
    svg.dispatchEvent(new PointerEvent("pointerup", {
      clientX: 100, clientY: 100, button: 2, pointerId: 1, bubbles: true,
    }));

    expect(cb.calls.onPointerDown).toHaveLength(0);
    expect(cb.calls.onTap).toHaveLength(0);
  });

  it("middle-click (button 1) is ignored", () => {
    svg.dispatchEvent(new PointerEvent("pointerdown", {
      clientX: 100, clientY: 100, button: 1, pointerId: 1, bubbles: true,
    }));

    expect(cb.calls.onPointerDown).toHaveLength(0);
  });
});

describe("GestureController — destroy", () => {
  it("after destroy, events no longer fire callbacks", () => {
    const svg = makeSvg();
    const cb = makeCallbacks();
    const ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      callbacks: cb,
    });

    ctrl.destroy();

    pointerDown(svg, 200, 200);
    pointerUp(svg, 200, 200);

    expect(cb.calls.onPointerDown).toHaveLength(0);
    expect(cb.calls.onTap).toHaveLength(0);
    expect(cb.upCalls).toBe(0);

    svg.remove();
  });
});

describe("GestureController — pointercancel", () => {
  let svg: SVGSVGElement;
  let ctrl: GestureController;
  let cb: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    svg = makeSvg();
    cb = makeCallbacks();
    ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      dragThresholdPx: 5,
      callbacks: cb,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
  });

  it("pointercancel fires onPointerUp but not tap or dragEnd", () => {
    pointerDown(svg, 100, 100);
    svg.dispatchEvent(new PointerEvent("pointercancel", {
      clientX: 100, clientY: 100, button: 0, pointerId: 1, bubbles: true,
    }));

    expect(cb.upCalls).toBe(1);
    expect(cb.calls.onTap).toHaveLength(0);
    expect(cb.calls.onDragEnd).toHaveLength(0);
  });

  it("pointercancel during drag fires onPointerUp but not dragEnd", () => {
    pointerDown(svg, 100, 100);
    pointerMove(svg, 120, 100); // drag started
    svg.dispatchEvent(new PointerEvent("pointercancel", {
      clientX: 120, clientY: 100, button: 0, pointerId: 1, bubbles: true,
    }));

    expect(cb.calls.onDragStart).toHaveLength(1);
    expect(cb.calls.onDragEnd).toHaveLength(0);
    expect(cb.upCalls).toBe(1);
  });

  it("after pointercancel, new pointer sequence works normally", () => {
    pointerDown(svg, 100, 100);
    svg.dispatchEvent(new PointerEvent("pointercancel", {
      clientX: 100, clientY: 100, button: 0, pointerId: 1, bubbles: true,
    }));

    // New tap should work
    pointerDown(svg, 200, 200);
    pointerUp(svg, 200, 200);

    expect(cb.calls.onTap).toHaveLength(1);
    expect(cb.calls.onPointerDown).toHaveLength(2); // one from each sequence
  });
});

describe("GestureController — screen→world via screenToWorld", () => {
  it("correctly maps screen coordinates through a non-trivial viewBox", () => {
    const svg = makeSvg(1000, 500);
    const cb = makeCallbacks();
    // viewBox: 5 world units wide, 3 world units tall, starting at (2, 1)
    const vb: ViewBox = { minX: 2, minY: 1, width: 5, height: 3 };
    const ctrl = createGestureController({
      svg,
      getViewBox: () => vb,
      callbacks: cb,
    });

    pointerDown(svg, 500, 250); // center of 1000×500 SVG
    pointerUp(svg, 500, 250);

    expect(cb.calls.onTap).toHaveLength(1);
    // worldX = 2 + (500/1000)*5 = 2 + 2.5 = 4.5
    expect(cb.calls.onTap[0].x).toBeCloseTo(4.5, 5);
    // worldY = 1 + (250/500)*3 = 1 + 1.5 = 2.5
    expect(cb.calls.onTap[0].y).toBeCloseTo(2.5, 5);

    ctrl.destroy();
    svg.remove();
  });
});

describe("GestureController — pointer ID tracking", () => {
  let svg: SVGSVGElement;
  let ctrl: GestureController;
  let cb: ReturnType<typeof makeCallbacks>;

  beforeEach(() => {
    svg = makeSvg();
    cb = makeCallbacks();
    ctrl = createGestureController({
      svg,
      getViewBox: () => IDENTITY_VIEWBOX,
      callbacks: cb,
    });
  });

  afterEach(() => {
    ctrl.destroy();
    svg.remove();
  });

  it("ignores pointermove from a different pointerId", () => {
    pointerDown(svg, 100, 100); // pointerId 1
    pointerMove(svg, 120, 100, { pointerId: 2 }); // different pointer

    // Should not trigger drag since the move is from a different pointer
    expect(cb.calls.onDragStart).toHaveLength(0);
  });

  it("ignores pointerup from a different pointerId", () => {
    pointerDown(svg, 100, 100); // pointerId 1
    pointerUp(svg, 100, 100, { pointerId: 2 }); // different pointer

    // Should not trigger tap since the up is from a different pointer
    expect(cb.calls.onTap).toHaveLength(0);
    expect(cb.upCalls).toBe(0);
  });
});
