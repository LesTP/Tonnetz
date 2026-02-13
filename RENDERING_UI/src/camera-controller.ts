import type { WindowBounds } from "harmony-core";
import type { CameraState, ViewBox, WorldExtent } from "./camera.js";
import {
  computeInitialCamera,
  computeViewBox,
  applyPanWithExtent,
  applyZoom,
  windowWorldExtent,
} from "./camera.js";
import { screenToWorld } from "./coords.js";
import { setAttrs } from "./svg-helpers.js";

/**
 * Camera controller that exposes pan/zoom operations and keeps the SVG
 * viewBox in sync (RU-D13).
 *
 * This is the **sole writer** of the SVG viewBox attribute (RU-DEV-D5).
 * Other controllers (e.g., ResizeController) notify this controller
 * of dimension/bounds changes via `updateDimensions()`.
 *
 * Pan is driven externally: the gesture controller (2b) classifies
 * drag gestures, converts screen deltas to world deltas, and calls
 * `panStart` / `panMove` / `panEnd` on this controller.
 *
 * Zoom is handled internally via a wheel listener (wheel events are
 * unambiguous and don't require gesture classification).
 *
 * Usage:
 *   const ctrl = createCameraController(svg, containerW, containerH, bounds);
 *   // gesture controller calls:
 *   ctrl.panStart();
 *   ctrl.panMove(worldDx, worldDy);
 *   ctrl.panEnd();
 *   // on resize:
 *   ctrl.updateDimensions(newW, newH, newBounds);
 *   // ... later:
 *   ctrl.reset();
 *   ctrl.destroy();
 */
export interface CameraController {
  /** Current camera state (read-only snapshot). */
  getCamera(): CameraState;
  /** Current viewBox (read-only snapshot). */
  getViewBox(): ViewBox;
  /** Begin a pan gesture. */
  panStart(): void;
  /** Apply a pan delta in world coordinates. Only effective between panStart/panEnd. */
  panMove(worldDx: number, worldDy: number): void;
  /** End the current pan gesture. */
  panEnd(): void;
  /**
   * Update container dimensions and window bounds.
   * Resets camera to fit-to-viewport for the new dimensions and syncs viewBox.
   * Called by ResizeController when the container size changes.
   */
  updateDimensions(
    containerWidth: number,
    containerHeight: number,
    bounds: WindowBounds,
  ): void;
  /** Reset camera to initial fit-to-viewport state. */
  reset(): void;
  /** Remove all event listeners. */
  destroy(): void;
}

/**
 * Create a camera controller that manages pan (via external API) and zoom
 * (via wheel listener) for the given SVG element.
 *
 * Pan: Driven externally through `panStart()` → `panMove(dx, dy)` → `panEnd()`.
 *      The gesture controller converts screen-pixel drag deltas to world deltas
 *      and calls these methods.
 *
 * Zoom: wheel event → applyZoom centered on pointer world position.
 *
 * Every camera state change updates the SVG viewBox attribute immediately.
 * This controller is the sole viewBox writer (RU-DEV-D5).
 */
export function createCameraController(
  svg: SVGSVGElement,
  containerWidth: number,
  containerHeight: number,
  bounds: WindowBounds,
): CameraController {
  let cBounds = bounds;
  let camera = computeInitialCamera(containerWidth, containerHeight, cBounds);
  let viewBox = computeViewBox(camera, containerWidth, containerHeight, cBounds);
  let cWidth = containerWidth;
  let cHeight = containerHeight;
  // Cached extent — recomputed only in updateDimensions() and reset()
  let cachedExtent: WorldExtent = windowWorldExtent(cBounds);

  function syncViewBox(): void {
    viewBox = computeViewBox(camera, cWidth, cHeight, cBounds);
    setAttrs(svg, {
      viewBox: `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`,
    });
  }

  // Set initial viewBox
  syncViewBox();

  // --- Pan state ---
  let isPanning = false;

  // --- Zoom (wheel — unambiguous, no gesture classification needed) ---
  function onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = svg.getBoundingClientRect();
    const sx = (e.clientX ?? (rect.left + rect.width / 2)) - rect.left;
    const sy = (e.clientY ?? (rect.top + rect.height / 2)) - rect.top;
    const worldPt = screenToWorld(sx, sy, viewBox, rect.width, rect.height);

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

    camera = applyZoom(camera, factor, worldPt.x, worldPt.y);
    syncViewBox();
  }

  // --- Attach wheel listener ---
  svg.addEventListener("wheel", onWheel, { passive: false });

  return {
    getCamera(): CameraState {
      return camera;
    },
    getViewBox(): ViewBox {
      return viewBox;
    },
    panStart(): void {
      isPanning = true;
    },
    panMove(worldDx: number, worldDy: number): void {
      if (!isPanning) return;
      // Use cached extent to avoid recomputing on every frame
      camera = applyPanWithExtent(camera, worldDx, worldDy, cachedExtent);
      syncViewBox();
    },
    panEnd(): void {
      isPanning = false;
    },
    updateDimensions(
      newContainerWidth: number,
      newContainerHeight: number,
      newBounds: WindowBounds,
    ): void {
      cWidth = newContainerWidth;
      cHeight = newContainerHeight;
      cBounds = newBounds;
      cachedExtent = windowWorldExtent(cBounds);
      camera = computeInitialCamera(cWidth, cHeight, cBounds);
      syncViewBox();
    },
    reset(): void {
      cachedExtent = windowWorldExtent(cBounds);
      camera = computeInitialCamera(cWidth, cHeight, cBounds);
      syncViewBox();
    },
    destroy(): void {
      svg.removeEventListener("wheel", onWheel);
    },
  };
}
