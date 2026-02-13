import type { TriRef } from "harmony-core";
import { triVertices } from "harmony-core";

/** Point in world coordinate space (equilateral triangle layout). */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** Point in lattice coordinate space (u, v axes). */
export interface LatticePoint {
  readonly u: number;
  readonly v: number;
}

/** ViewBox-like interface for screenToWorld overload (avoids circular import). */
export interface ViewBoxLike {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

const SQRT3_OVER_2 = Math.sqrt(3) / 2;

/**
 * Transform lattice coordinates (u, v) to world coordinates (x, y).
 *
 * Uses equilateral triangle layout (RU-D15):
 *   x = u + v * 0.5
 *   y = v * (√3 / 2)
 *
 * Produces equilateral triangles with unit-length edges.
 */
export function latticeToWorld(u: number, v: number): WorldPoint {
  return {
    x: u + v * 0.5,
    y: v * SQRT3_OVER_2,
  };
}

/**
 * Transform world coordinates (x, y) back to lattice coordinates (u, v).
 *
 * Inverse of latticeToWorld. Returns fractional values — rounding
 * to the nearest lattice point is the caller's responsibility.
 */
export function worldToLattice(x: number, y: number): LatticePoint {
  const v = y / SQRT3_OVER_2;
  const u = x - v * 0.5;
  return { u, v };
}

/**
 * Convert screen (pixel) coordinates to world coordinates using the
 * current SVG viewBox and client dimensions.
 *
 * Shared utility extracted from camera-controller.ts zoom handler (W7).
 *
 * Overload 1: Accepts a ViewBoxLike object and client dimensions (cleaner API).
 *
 * @param screenX — pointer X relative to the SVG element's left edge
 * @param screenY — pointer Y relative to the SVG element's top edge
 * @param viewBox — current viewBox (or any object with minX, minY, width, height)
 * @param clientWidth — SVG element's rendered pixel width
 * @param clientHeight — SVG element's rendered pixel height
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewBox: ViewBoxLike,
  clientWidth: number,
  clientHeight: number,
): WorldPoint;

/**
 * Convert screen (pixel) coordinates to world coordinates using the
 * current SVG viewBox and client dimensions.
 *
 * Overload 2: Accepts 8 scalar parameters (legacy API, backward compatible).
 *
 * @param screenX — pointer X relative to the SVG element's left edge
 * @param screenY — pointer Y relative to the SVG element's top edge
 * @param viewBoxMinX — current viewBox minX
 * @param viewBoxMinY — current viewBox minY
 * @param viewBoxWidth — current viewBox width
 * @param viewBoxHeight — current viewBox height
 * @param clientWidth — SVG element's rendered pixel width
 * @param clientHeight — SVG element's rendered pixel height
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewBoxMinX: number,
  viewBoxMinY: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  clientWidth: number,
  clientHeight: number,
): WorldPoint;

// Implementation
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewBoxOrMinX: ViewBoxLike | number,
  viewBoxMinYOrClientWidth: number,
  viewBoxWidthOrClientHeight: number,
  viewBoxHeight?: number,
  clientWidth?: number,
  clientHeight?: number,
): WorldPoint {
  // Detect which overload was called
  if (typeof viewBoxOrMinX === "object") {
    // Overload 1: ViewBoxLike object
    const vb = viewBoxOrMinX;
    const cw = viewBoxMinYOrClientWidth;
    const ch = viewBoxWidthOrClientHeight;
    return {
      x: vb.minX + (screenX / cw) * vb.width,
      y: vb.minY + (screenY / ch) * vb.height,
    };
  }
  // Overload 2: 8 scalar parameters
  return {
    x: viewBoxOrMinX + (screenX / clientWidth!) * viewBoxWidthOrClientHeight,
    y: viewBoxMinYOrClientWidth + (screenY / clientHeight!) * viewBoxHeight!,
  };
}

/**
 * Build an SVG polygon points string from a triangle reference.
 *
 * Converts the three lattice-coordinate vertices to world coordinates
 * and formats them as "x1,y1 x2,y2 x3,y3" for SVG polygon element.
 *
 * Shared utility used by shape-renderer.ts and highlight.ts.
 */
export function triPolygonPoints(tri: TriRef): string {
  const verts = triVertices(tri);
  return verts
    .map((v) => {
      const w = latticeToWorld(v.u, v.v);
      return `${w.x},${w.y}`;
    })
    .join(" ");
}
