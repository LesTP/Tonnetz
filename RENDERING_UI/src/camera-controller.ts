import type { WindowBounds } from "harmony-core";
import type { CameraState, ViewBox } from "./camera.js";
import {
  computeInitialCamera,
  computeViewBox,
  applyPan,
  applyZoom,
} from "./camera.js";
import { setAttrs } from "./svg-helpers.js";

/**
 * Camera controller that wires pointer/wheel events to the camera
 * math in camera.ts and keeps the SVG viewBox in sync (RU-D13).
 *
 * This is the **sole writer** of the SVG viewBox attribute (RU-DEV-D5).
 * Other controllers (e.g., ResizeController) notify this controller
 * of dimension/bounds changes via `updateDimensions()`.
 *
 * Usage:
 *   const ctrl = createCameraController(svg, containerW, containerH, bounds);
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
 * Create a camera controller that attaches pan (drag) and zoom (wheel)
 * handlers to the given SVG element.
 *
 * Pan: pointerdown on SVG background → pointermove → pointerup.
 *      Screen delta converted to world delta via viewBox/clientWidth ratio.
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
  let lastPointerX = 0;
  let lastPointerY = 0;

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    isPanning = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    svg.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!isPanning) return;

    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;

    const worldDx = -dx * (viewBox.width / svg.clientWidth);
    const worldDy = -dy * (viewBox.height / svg.clientHeight);

    camera = applyPan(camera, worldDx, worldDy);
    syncViewBox();
  }

  function onPointerUp(_e: PointerEvent): void {
    isPanning = false;
  }

  // --- Zoom ---
  function onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = svg.getBoundingClientRect();
    const sx = (e.clientX ?? (rect.left + rect.width / 2)) - rect.left;
    const sy = (e.clientY ?? (rect.top + rect.height / 2)) - rect.top;
    const worldX = viewBox.minX + (sx / rect.width) * viewBox.width;
    const worldY = viewBox.minY + (sy / rect.height) * viewBox.height;

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

    camera = applyZoom(camera, factor, worldX, worldY);
    syncViewBox();
  }

  // --- Attach listeners ---
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("wheel", onWheel, { passive: false });

  return {
    getCamera(): CameraState {
      return camera;
    },
    getViewBox(): ViewBox {
      return viewBox;
    },
    updateDimensions(
      newContainerWidth: number,
      newContainerHeight: number,
      newBounds: WindowBounds,
    ): void {
      cWidth = newContainerWidth;
      cHeight = newContainerHeight;
      cBounds = newBounds;
      camera = computeInitialCamera(cWidth, cHeight, cBounds);
      syncViewBox();
    },
    reset(): void {
      camera = computeInitialCamera(cWidth, cHeight, cBounds);
      syncViewBox();
    },
    destroy(): void {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
    },
  };
}
