import { describe, it, expect } from "vitest";
import {
  computeWindowBounds,
  computeInitialCamera,
  computeViewBox,
  applyPan,
  applyZoom,
} from "../camera.js";
import { latticeToWorld } from "../coords.js";

const SQRT3_OVER_2 = Math.sqrt(3) / 2;

function anchorCount(bounds: { uMin: number; uMax: number }): number {
  return bounds.uMax - bounds.uMin + 1;
}

describe("computeWindowBounds — responsive window sizing (RU-D10)", () => {
  it("desktop (1024×768, 40px min) → reasonable window", () => {
    const b = computeWindowBounds(1024, 768, 40);
    const nU = anchorCount(b);
    const nV = b.vMax - b.vMin + 1;
    // Equilateral skew reduces usable anchors vs naive estimate.
    // Desktop should produce roughly 14–20 anchors per axis.
    expect(nU).toBeGreaterThanOrEqual(14);
    expect(nU).toBeLessThanOrEqual(22);
    expect(nV).toBeGreaterThanOrEqual(12);
    expect(nV).toBeLessThanOrEqual(22);
  });

  it("tablet (768×1024, 40px min) → smaller than desktop", () => {
    const b = computeWindowBounds(768, 1024, 40);
    const nU = anchorCount(b);
    const nV = b.vMax - b.vMin + 1;
    expect(nU).toBeGreaterThanOrEqual(10);
    expect(nU).toBeLessThanOrEqual(20);
    expect(nV).toBeGreaterThanOrEqual(8);
    expect(nV).toBeLessThanOrEqual(24);
  });

  it("phone (375×667, 40px min) → smallest window", () => {
    const b = computeWindowBounds(375, 667, 40);
    const nU = anchorCount(b);
    const nV = b.vMax - b.vMin + 1;
    expect(nU).toBeGreaterThanOrEqual(4);
    expect(nU).toBeLessThanOrEqual(12);
    expect(nV).toBeGreaterThanOrEqual(4);
    expect(nV).toBeLessThanOrEqual(16);
  });

  it("never produces triangles smaller than minTriSizePx on screen", () => {
    const testCases: [number, number][] = [
      [1024, 768],
      [768, 1024],
      [375, 667],
      [320, 480],
    ];
    const minPx = 40;

    for (const [cw, ch] of testCases) {
      const b = computeWindowBounds(cw, ch, minPx);
      // World width of the window
      const corners = [
        latticeToWorld(b.uMin, b.vMin),
        latticeToWorld(b.uMax + 1, b.vMin),
        latticeToWorld(b.uMin, b.vMax + 1),
        latticeToWorld(b.uMax + 1, b.vMax + 1),
      ];
      const worldMinX = Math.min(...corners.map((c) => c.x));
      const worldMaxX = Math.max(...corners.map((c) => c.x));
      const worldMinY = Math.min(...corners.map((c) => c.y));
      const worldMaxY = Math.max(...corners.map((c) => c.y));

      // One triangle edge = 1 world unit. At zoom=1, the scale is:
      // pixels per world unit = containerDim / worldDim
      const scaleX = cw / (worldMaxX - worldMinX);
      const scaleY = ch / (worldMaxY - worldMinY);
      const effectiveScale = Math.min(scaleX, scaleY);
      const triScreenSize = effectiveScale * 1; // 1 world unit per edge

      expect(triScreenSize).toBeGreaterThanOrEqual(minPx * 0.8); // allow small rounding tolerance
    }
  });

  it("enforces minimum of 2 anchors per axis", () => {
    // Tiny container that might produce < 2 anchors
    const b = computeWindowBounds(50, 50, 40);
    expect(anchorCount(b)).toBeGreaterThanOrEqual(2);
    expect(b.vMax - b.vMin + 1).toBeGreaterThanOrEqual(2);
  });

  it("larger containers produce more anchors than smaller ones", () => {
    const big = computeWindowBounds(1024, 768, 40);
    const small = computeWindowBounds(375, 667, 40);
    expect(anchorCount(big)).toBeGreaterThan(anchorCount(small));
  });
});

describe("computeInitialCamera — fit-to-viewport (RU-D11)", () => {
  it("centers the window in the viewport", () => {
    const bounds = computeWindowBounds(1024, 768, 40);
    const cam = computeInitialCamera(1024, 768, bounds);

    // Camera center should be at the center of the window's world extent
    const corners = [
      latticeToWorld(bounds.uMin, bounds.vMin),
      latticeToWorld(bounds.uMax + 1, bounds.vMin),
      latticeToWorld(bounds.uMin, bounds.vMax + 1),
      latticeToWorld(bounds.uMax + 1, bounds.vMax + 1),
    ];
    const worldCenterX =
      (Math.min(...corners.map((c) => c.x)) +
        Math.max(...corners.map((c) => c.x))) /
      2;
    const worldCenterY =
      (Math.min(...corners.map((c) => c.y)) +
        Math.max(...corners.map((c) => c.y))) /
      2;

    expect(cam.centerX).toBeCloseTo(worldCenterX, 10);
    expect(cam.centerY).toBeCloseTo(worldCenterY, 10);
    expect(cam.zoom).toBe(1);
  });
});

describe("computeViewBox", () => {
  const bounds = computeWindowBounds(1024, 768, 40);
  const cam = computeInitialCamera(1024, 768, bounds);

  it("at zoom=1 shows the full window", () => {
    const vb = computeViewBox(cam, 1024, 768, bounds);

    // The viewBox should encompass the full window extent
    const corners = [
      latticeToWorld(bounds.uMin, bounds.vMin),
      latticeToWorld(bounds.uMax + 1, bounds.vMin),
      latticeToWorld(bounds.uMin, bounds.vMax + 1),
      latticeToWorld(bounds.uMax + 1, bounds.vMax + 1),
    ];
    const worldMinX = Math.min(...corners.map((c) => c.x));
    const worldMaxX = Math.max(...corners.map((c) => c.x));
    const worldMinY = Math.min(...corners.map((c) => c.y));
    const worldMaxY = Math.max(...corners.map((c) => c.y));
    const worldW = worldMaxX - worldMinX;
    const worldH = worldMaxY - worldMinY;

    // ViewBox should be at least as large as world extent (may be larger
    // due to aspect ratio padding)
    expect(vb.width).toBeGreaterThanOrEqual(worldW - 0.001);
    expect(vb.height).toBeGreaterThanOrEqual(worldH - 0.001);
  });

  it("at zoom=2 shows half the extent (zoomed in)", () => {
    const vb1 = computeViewBox(cam, 1024, 768, bounds);
    const cam2 = { ...cam, zoom: 2 };
    const vb2 = computeViewBox(cam2, 1024, 768, bounds);

    expect(vb2.width).toBeCloseTo(vb1.width / 2, 8);
    expect(vb2.height).toBeCloseTo(vb1.height / 2, 8);
  });

  it("preserves container aspect ratio", () => {
    const vb = computeViewBox(cam, 1024, 768, bounds);
    const vbAspect = vb.width / vb.height;
    const containerAspect = 1024 / 768;
    expect(vbAspect).toBeCloseTo(containerAspect, 8);
  });
});

describe("applyPan", () => {
  it("shifts the camera center by the given world-coordinate delta", () => {
    const cam = { centerX: 5, centerY: 3, zoom: 1.5 };
    const panned = applyPan(cam, 2, -1);
    expect(panned.centerX).toBe(7);
    expect(panned.centerY).toBe(2);
    expect(panned.zoom).toBe(1.5); // zoom unchanged
  });

  it("zero delta produces identical camera", () => {
    const cam = { centerX: 5, centerY: 3, zoom: 1 };
    const panned = applyPan(cam, 0, 0);
    expect(panned.centerX).toBe(cam.centerX);
    expect(panned.centerY).toBe(cam.centerY);
  });
});

describe("applyPan — boundary clamping (RU-DEV-D7)", () => {
  // Use a known bounds: uMin=-3, uMax=3, vMin=-3, vMax=3
  // World extent corners: latticeToWorld(-3,-3), latticeToWorld(4,-3),
  //   latticeToWorld(-3,4), latticeToWorld(4,4)
  // x range: min = -3 + (-3)*0.5 = -4.5, max = 4 + 4*0.5 = 6
  // y range: min = -3 * √3/2 ≈ -2.598, max = 4 * √3/2 ≈ 3.464
  const bounds = { uMin: -3, uMax: 3, vMin: -3, vMax: 3 };

  // Pre-compute expected extent
  const corners = [
    latticeToWorld(-3, -3),
    latticeToWorld(4, -3),
    latticeToWorld(-3, 4),
    latticeToWorld(4, 4),
  ];
  const extMinX = Math.min(...corners.map(c => c.x));
  const extMaxX = Math.max(...corners.map(c => c.x));
  const extMinY = Math.min(...corners.map(c => c.y));
  const extMaxY = Math.max(...corners.map(c => c.y));
  const worldW = extMaxX - extMinX;
  const worldH = extMaxY - extMinY;

  it("pan within bounds is not clamped", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 1 };
    const panned = applyPan(cam, 1, 0.5, bounds);
    expect(panned.centerX).toBe(1);
    expect(panned.centerY).toBe(0.5);
  });

  it("pan far beyond extent is clamped to extent + margin (default factor 1.5)", () => {
    const marginX = worldW * (1.5 - 1) / 2;
    const marginY = worldH * (1.5 - 1) / 2;
    const cam = { centerX: 0, centerY: 0, zoom: 1 };

    // Pan way beyond the right edge
    const panned = applyPan(cam, 1000, 1000, bounds);
    expect(panned.centerX).toBeCloseTo(extMaxX + marginX, 8);
    expect(panned.centerY).toBeCloseTo(extMaxY + marginY, 8);
  });

  it("pan far in negative direction is clamped to extent - margin", () => {
    const marginX = worldW * (1.5 - 1) / 2;
    const marginY = worldH * (1.5 - 1) / 2;
    const cam = { centerX: 0, centerY: 0, zoom: 1 };

    const panned = applyPan(cam, -1000, -1000, bounds);
    expect(panned.centerX).toBeCloseTo(extMinX - marginX, 8);
    expect(panned.centerY).toBeCloseTo(extMinY - marginY, 8);
  });

  it("pan with no bounds arg is unclamped (backward compat)", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 1 };
    const panned = applyPan(cam, 1000, 1000);
    expect(panned.centerX).toBe(1000);
    expect(panned.centerY).toBe(1000);
  });

  it("custom clampFactor = 1.0 constrains to exact extent (no margin)", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 1 };
    const panned = applyPan(cam, 1000, 1000, bounds, 1.0);
    expect(panned.centerX).toBeCloseTo(extMaxX, 8);
    expect(panned.centerY).toBeCloseTo(extMaxY, 8);
  });

  it("custom clampFactor = 2.0 gives larger margin", () => {
    const marginX = worldW * (2.0 - 1) / 2;
    const cam = { centerX: 0, centerY: 0, zoom: 1 };
    const panned = applyPan(cam, 1000, 0, bounds, 2.0);
    expect(panned.centerX).toBeCloseTo(extMaxX + marginX, 8);
  });

  it("clamping is symmetric — same margin on both sides", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 1 };
    const pannedRight = applyPan(cam, 1000, 0, bounds);
    const pannedLeft = applyPan(cam, -1000, 0, bounds);

    const centerX = (extMinX + extMaxX) / 2;
    const rightMargin = pannedRight.centerX - centerX;
    const leftMargin = centerX - pannedLeft.centerX;
    expect(rightMargin).toBeCloseTo(leftMargin, 8);
  });
});

describe("applyZoom", () => {
  it("anchor point stays fixed after zoom (anchor stability)", () => {
    const bounds = computeWindowBounds(1024, 768, 40);
    const cam = computeInitialCamera(1024, 768, bounds);

    const anchorX = cam.centerX + 3;
    const anchorY = cam.centerY + 2;

    const zoomed = applyZoom(cam, 2, anchorX, anchorY);

    // The anchor point should map to the same screen position before and after.
    // With viewBox-based camera, the world point at (anchorX, anchorY) should
    // be at the same relative position in both viewBoxes.
    const vb1 = computeViewBox(cam, 1024, 768, bounds);
    const vb2 = computeViewBox(zoomed, 1024, 768, bounds);

    // Relative position of anchor within viewBox: (anchor - minX) / width
    const relX1 = (anchorX - vb1.minX) / vb1.width;
    const relY1 = (anchorY - vb1.minY) / vb1.height;
    const relX2 = (anchorX - vb2.minX) / vb2.width;
    const relY2 = (anchorY - vb2.minY) / vb2.height;

    expect(relX2).toBeCloseTo(relX1, 8);
    expect(relY2).toBeCloseTo(relY1, 8);
  });

  it("zoom=2 doubles the zoom level", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 1 };
    const zoomed = applyZoom(cam, 2, 0, 0);
    expect(zoomed.zoom).toBe(2);
  });

  it("clamps zoom at maximum (4)", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 7 };
    const zoomed = applyZoom(cam, 2, 0, 0);
    expect(zoomed.zoom).toBe(4);
  });

  it("clamps zoom at minimum (0.25)", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 0.3 };
    const zoomed = applyZoom(cam, 0.5, 0, 0);
    expect(zoomed.zoom).toBe(0.25);
  });

  it("zoom factor < 1 zooms out", () => {
    const cam = { centerX: 0, centerY: 0, zoom: 2 };
    const zoomed = applyZoom(cam, 0.5, 0, 0);
    expect(zoomed.zoom).toBe(1);
  });

  it("zooming at camera center does not shift center", () => {
    const cam = { centerX: 5, centerY: 3, zoom: 1 };
    const zoomed = applyZoom(cam, 2, 5, 3);
    expect(zoomed.centerX).toBeCloseTo(5, 10);
    expect(zoomed.centerY).toBeCloseTo(3, 10);
    expect(zoomed.zoom).toBe(2);
  });

  it("anchor stability holds for zoom-out as well", () => {
    const bounds = computeWindowBounds(1024, 768, 40);
    const cam = { centerX: 5, centerY: 3, zoom: 4 };

    const anchorX = 7;
    const anchorY = 1;

    const zoomed = applyZoom(cam, 0.5, anchorX, anchorY);

    const vb1 = computeViewBox(cam, 1024, 768, bounds);
    const vb2 = computeViewBox(zoomed, 1024, 768, bounds);

    const relX1 = (anchorX - vb1.minX) / vb1.width;
    const relY1 = (anchorY - vb1.minY) / vb1.height;
    const relX2 = (anchorX - vb2.minX) / vb2.width;
    const relY2 = (anchorY - vb2.minY) / vb2.height;

    expect(relX2).toBeCloseTo(relX1, 8);
    expect(relY2).toBeCloseTo(relY1, 8);
  });
});
