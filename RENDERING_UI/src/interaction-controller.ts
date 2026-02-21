import type { TriId, EdgeId, WindowIndices } from "harmony-core";
import { getTrianglePcs, getEdgeUnionPcs } from "harmony-core";
import type { CameraController } from "./camera-controller.js";
import { createGestureController } from "./gesture-controller.js";
import type { GestureController } from "./gesture-controller.js";
import { hitTest, computeProximityRadius } from "./hit-test.js";
import type { WorldPoint } from "./coords.js";

// --- Callback types ---

export interface InteractionCallbacks {
  /** Tap on a triangle → triad selection. */
  onTriangleSelect?: (triId: TriId, pcs: number[]) => void;
  /** Tap on a shared edge → union chord selection (4 pitch classes). */
  onEdgeSelect?: (edgeId: EdgeId, triIds: [TriId, TriId], pcs: number[]) => void;
  /** Pointer-down — immediate, before tap/drag classification (audio trigger per UX-D4). */
  onPointerDown?: (world: WorldPoint) => void;
  /** Pointer-up — release (audio stop per UX-D4). */
  onPointerUp?: () => void;
  /** Drag started — drag threshold exceeded (audio stop per UX-D4). */
  onDragStart?: () => void;
}

export interface InteractionControllerOptions {
  svg: SVGSVGElement;
  cameraController: CameraController;
  /**
   * Function that returns the current WindowIndices.
   * Called on every hit-test, ensuring indices are always fresh.
   * Typically provided by ResizeController.getIndices.
   */
  getIndices: () => WindowIndices;
  callbacks: InteractionCallbacks;
  /** Proximity radius factor (default 0.12 per UX-D1). */
  proximityFactor?: number;
  /** Drag threshold in screen pixels (default 5). */
  dragThresholdPx?: number;
}

export interface InteractionController {
  /** Clean up gesture controller and all listeners. */
  destroy(): void;
}

/**
 * Interaction controller that wires gesture events to hit-testing and emits
 * high-level selection events.
 *
 * Orchestrates:
 * - GestureController (tap/drag disambiguation)
 * - CameraController (pan via panStart/panMove/panEnd)
 * - hitTest (triangle/edge classification)
 *
 * Gesture model:
 * - Tap (press + release within threshold) → hit-test → triangle/edge select
 * - Drag (any direction, any start position) → camera pan
 * - Wheel → zoom (handled by CameraController directly)
 */
export function createInteractionController(
  options: InteractionControllerOptions,
): InteractionController {
  const { svg, cameraController, callbacks, getIndices } = options;
  const radius = computeProximityRadius(options.proximityFactor ?? 0.12);

  // --- Drag state ---
  let isPanning = false;

  // --- Gesture callbacks ---

  function onPointerDown(world: WorldPoint): void {
    callbacks.onPointerDown?.(world);
  }

  function onPointerUp(): void {
    callbacks.onPointerUp?.();
  }

  function onTap(world: WorldPoint): void {
    const indices = getIndices();
    const hit = hitTest(world.x, world.y, radius, indices);

    if (hit.type === "triangle") {
      const ref = indices.triIdToRef.get(hit.triId);
      if (ref) {
        const pcs = getTrianglePcs(ref);
        callbacks.onTriangleSelect?.(hit.triId, [...pcs]);
      }
    } else if (hit.type === "edge") {
      const unionPcs = getEdgeUnionPcs(hit.edgeId, indices);
      if (unionPcs) {
        callbacks.onEdgeSelect?.(hit.edgeId, hit.triIds, unionPcs);
      }
    }
  }

  function onDragStart(_world: WorldPoint): void {
    isPanning = true;
    cameraController.panStart();
    callbacks.onDragStart?.();
  }

  function onDragMove(_world: WorldPoint, screenDx: number, screenDy: number): void {
    if (!isPanning) return;
    // Convert screen-pixel delta to world-unit delta using viewBox scale.
    // This avoids the feedback loop of computing world positions from a
    // shifting viewBox, which causes jitter.
    const vb = cameraController.getViewBox();
    const rect = svg.getBoundingClientRect();
    const worldDx = screenDx * (vb.width / rect.width);
    const worldDy = screenDy * (vb.height / rect.height);
    cameraController.panMove(-worldDx, -worldDy);
  }

  function onDragEnd(_world: WorldPoint): void {
    if (isPanning) {
      cameraController.panEnd();
    }
    isPanning = false;
  }

  // --- Create gesture controller ---

  const gestureCtrl: GestureController = createGestureController({
    svg,
    getViewBox: () => cameraController.getViewBox(),
    dragThresholdPx: options.dragThresholdPx,
    callbacks: {
      onPointerDown,
      onPointerUp,
      onTap,
      onDragStart,
      onDragMove,
      onDragEnd,
      onPinchZoom(center: WorldPoint, factor: number): void {
        cameraController.zoom(factor, center.x, center.y);
      },
    },
  });

  return {
    destroy(): void {
      gestureCtrl.destroy();
      isPanning = false;
    },
  };
}
