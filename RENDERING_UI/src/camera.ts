import type { WindowBounds } from "harmony-core";
import { latticeToWorld } from "./coords.js";

/** Camera state in world coordinates. */
export interface CameraState {
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
}

/** ViewBox parameters for the SVG element. */
export interface ViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

/**
 * Compute responsive window bounds based on container size and minimum
 * triangle screen size (RU-D10, RU-D11).
 *
 * Works backwards from the constraint: each equilateral triangle edge
 * must be at least `minTriSizePx` pixels on screen at zoom=1.
 *
 * In the equilateral layout, one lattice unit = one world unit = one edge length.
 * At zoom=1 the full window fills the container, so:
 *   screenEdge = containerWidth / worldWidth
 * We need screenEdge ≥ minTriSizePx, so:
 *   worldWidth ≤ containerWidth / minTriSizePx
 *
 * The world width of a window with N anchors along u is approximately
 * N + 0.5*M (due to the v-axis skew), where M is the anchor count along v.
 * For a symmetric square window (N = M), worldWidth ≈ N * 1.5.
 * We use the shorter container axis to be conservative.
 *
 * Bounds are centered on the origin: uMin = -half, uMax = +half, etc.
 */
export function computeWindowBounds(
  containerWidth: number,
  containerHeight: number,
  minTriSizePx: number,
): WindowBounds {
  const SQRT3_OVER_2 = Math.sqrt(3) / 2;

  // In the equilateral layout, a window with anchorsU × anchorsV anchors
  // has triangles with vertices from (uMin, vMin) to (uMax+1, vMax+1).
  // The world bounding box of those corners:
  //   worldWidth  = (anchorsU + 1) + (anchorsV + 1) * 0.5  (widest row)
  //                 minus the narrowest x
  //   worldHeight = (anchorsV + 1) * √3/2
  //
  // More precisely, the 4 corners are:
  //   (uMin, vMin), (uMax+1, vMin), (uMin, vMax+1), (uMax+1, vMax+1)
  // worldX range: min = uMin + vMin*0.5, max = (uMax+1) + (vMax+1)*0.5
  // So worldWidth = (anchorsU + 1) + (anchorsV + 1)*0.5
  //
  // At zoom=1, effective scale = min(cW/worldW, cH/worldH).
  // We need scale ≥ minTriSizePx.
  //
  // Solve for maximal anchorsU, anchorsV such that the constraint holds.
  // Start from generous estimates and shrink if needed.

  let anchorsU = Math.max(2, Math.floor(containerWidth / minTriSizePx));
  let anchorsV = Math.max(2, Math.floor(containerHeight / (minTriSizePx * SQRT3_OVER_2)));

  for (let i = 0; i < 50; i++) {
    const worldW = (anchorsU + 1) + (anchorsV + 1) * 0.5;
    const worldH = (anchorsV + 1) * SQRT3_OVER_2;
    const scale = Math.min(containerWidth / worldW, containerHeight / worldH);
    if (scale >= minTriSizePx) break;
    // Shrink whichever axis reduces world extent more effectively
    if (anchorsU <= 2 && anchorsV <= 2) break;
    if (anchorsU > 2 && (anchorsU >= anchorsV || anchorsV <= 2)) {
      anchorsU--;
    } else {
      anchorsV--;
    }
  }

  const halfU = Math.floor(anchorsU / 2);
  const halfV = Math.floor(anchorsV / 2);

  return {
    uMin: -halfU,
    uMax: anchorsU - halfU - 1,
    vMin: -halfV,
    vMax: anchorsV - halfV - 1,
  };
}

/**
 * Compute the world-space bounding box of a window.
 * Returns { minX, minY, maxX, maxY } from the lattice corners.
 */
function windowWorldExtent(bounds: WindowBounds): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const corners = [
    latticeToWorld(bounds.uMin, bounds.vMin),
    latticeToWorld(bounds.uMax + 1, bounds.vMin),
    latticeToWorld(bounds.uMin, bounds.vMax + 1),
    latticeToWorld(bounds.uMax + 1, bounds.vMax + 1),
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Compute the initial camera that centers the window in the viewport (RU-D11).
 */
export function computeInitialCamera(
  containerWidth: number,
  containerHeight: number,
  bounds: WindowBounds,
): CameraState {
  const ext = windowWorldExtent(bounds);
  return {
    centerX: (ext.minX + ext.maxX) / 2,
    centerY: (ext.minY + ext.maxY) / 2,
    zoom: 1,
  };
}

/**
 * Compute the SVG viewBox from camera state and container dimensions.
 *
 * At zoom=1, the viewBox shows the full window extent.
 * At zoom=2, the viewBox shows half the extent (zoomed in).
 */
export function computeViewBox(
  camera: CameraState,
  containerWidth: number,
  containerHeight: number,
  bounds: WindowBounds,
): ViewBox {
  const ext = windowWorldExtent(bounds);
  const worldWidth = ext.maxX - ext.minX;
  const worldHeight = ext.maxY - ext.minY;

  const containerAspect = containerWidth / containerHeight;
  const worldAspect = worldWidth / worldHeight;

  let baseW: number;
  let baseH: number;
  if (containerAspect > worldAspect) {
    baseH = worldHeight;
    baseW = baseH * containerAspect;
  } else {
    baseW = worldWidth;
    baseH = baseW / containerAspect;
  }

  const w = baseW / camera.zoom;
  const h = baseH / camera.zoom;

  return {
    minX: camera.centerX - w / 2,
    minY: camera.centerY - h / 2,
    width: w,
    height: h,
  };
}

/**
 * Apply a pan delta (in world coordinates) to the camera.
 */
export function applyPan(
  camera: CameraState,
  dx: number,
  dy: number,
): CameraState {
  return {
    centerX: camera.centerX + dx,
    centerY: camera.centerY + dy,
    zoom: camera.zoom,
  };
}

/**
 * Apply zoom centered on a world-space anchor point.
 *
 * The anchor point (e.g., world position under the pointer) stays fixed
 * on screen after the zoom. Zoom is clamped to [MIN_ZOOM, MAX_ZOOM].
 */
export function applyZoom(
  camera: CameraState,
  factor: number,
  anchorX: number,
  anchorY: number,
): CameraState {
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  const actualFactor = newZoom / camera.zoom;

  const newCenterX =
    anchorX + (camera.centerX - anchorX) / actualFactor;
  const newCenterY =
    anchorY + (camera.centerY - anchorY) / actualFactor;

  return {
    centerX: newCenterX,
    centerY: newCenterY,
    zoom: newZoom,
  };
}
