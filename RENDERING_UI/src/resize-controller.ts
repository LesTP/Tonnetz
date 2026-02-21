import type { WindowBounds, WindowIndices } from "harmony-core";
import { buildWindowIndices } from "harmony-core";
import { computeWindowBounds } from "./camera.js";
import { renderGrid } from "./renderer.js";
import type { SvgScaffold } from "./renderer.js";

/** Minimum triangle side length in pixels (RU-D10, RU-D11). */
const MIN_TRI_SIZE_PX = 25;

/** Resize debounce interval in milliseconds. */
const DEBOUNCE_MS = 150;

/**
 * Return type from createResizeController.
 */
export interface ResizeController {
  /** Current window bounds (may change on breakpoint crossing). */
  getBounds(): WindowBounds;
  /** Current window indices (rebuilt on breakpoint crossing). */
  getIndices(): WindowIndices;
  /** Disconnect ResizeObserver and clean up. */
  destroy(): void;
}

/**
 * Callback invoked when the resize controller updates after a resize.
 *
 * The consumer (e.g., a CameraController) uses this to update its
 * stored dimensions/bounds and re-sync the viewBox.
 *
 * Note: The ResizeController does NOT manage camera state or write the
 * SVG viewBox attribute. That is the sole responsibility of the
 * CameraController (RU-DEV-D5). The consumer must call
 * `cameraController.updateDimensions(containerWidth, containerHeight, bounds)`
 * inside this callback to keep the viewBox in sync.
 */
export type ResizeCallback = (info: {
  bounds: WindowBounds;
  indices: WindowIndices;
  containerWidth: number;
  containerHeight: number;
}) => void;

/**
 * Determine whether two WindowBounds represent the same anchor grid.
 */
function boundsEqual(a: WindowBounds, b: WindowBounds): boolean {
  return (
    a.uMin === b.uMin &&
    a.uMax === b.uMax &&
    a.vMin === b.vMin &&
    a.vMax === b.vMax
  );
}

/**
 * Create a resize controller that watches the container element
 * via ResizeObserver and responds to dimension changes (RU-D6).
 *
 * On every resize:
 * - Recomputes window bounds for the new container size
 * - If bounds changed (breakpoint crossing): rebuilds WindowIndices
 *   and re-renders the grid
 * - Invokes the `onResize` callback so the CameraController can
 *   update its dimensions/bounds and re-sync the viewBox
 *
 * This controller does NOT manage camera state or write the SVG viewBox.
 * That is the sole responsibility of the CameraController (RU-DEV-D5).
 *
 * Resize events are debounced to avoid excessive re-renders.
 */
export function createResizeController(
  container: Element,
  scaffold: SvgScaffold,
  onResize?: ResizeCallback,
): ResizeController {
  let containerWidth = container.clientWidth || 800;
  let containerHeight = container.clientHeight || 600;

  let bounds = computeWindowBounds(
    containerWidth,
    containerHeight,
    MIN_TRI_SIZE_PX,
  );
  let indices = buildWindowIndices(bounds);

  // Initial render (grid only — viewBox is CameraController's job)
  renderGrid(scaffold.layers["layer-grid"], indices);

  // --- Debounced resize handler ---
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleResize(): void {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;

    if (newWidth === containerWidth && newHeight === containerHeight) return;
    if (newWidth === 0 || newHeight === 0) return;

    containerWidth = newWidth;
    containerHeight = newHeight;

    const newBounds = computeWindowBounds(
      containerWidth,
      containerHeight,
      MIN_TRI_SIZE_PX,
    );

    if (!boundsEqual(bounds, newBounds)) {
      bounds = newBounds;
      indices = buildWindowIndices(bounds);
      renderGrid(scaffold.layers["layer-grid"], indices);
    }

    if (onResize) {
      onResize({ bounds, indices, containerWidth, containerHeight });
    }
  }

  function onResizeObserved(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(handleResize, DEBOUNCE_MS);
  }

  // --- Attach ResizeObserver ---
  const observer = new ResizeObserver(onResizeObserved);
  observer.observe(container);

  return {
    getBounds(): WindowBounds {
      return bounds;
    },
    getIndices(): WindowIndices {
      return indices;
    },
    destroy(): void {
      observer.disconnect();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}
