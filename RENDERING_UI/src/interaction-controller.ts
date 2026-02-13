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
  /** Triangle change during drag-scrub (UX-D3). */
  onDragScrub?: (triId: TriId, pcs: number[]) => void;
  /** Pointer-down — immediate, before tap/drag classification (audio trigger per UX-D4). */
  onPointerDown?: (world: WorldPoint) => void;
  /** Pointer-up — release (audio stop per UX-D4). */
  onPointerUp?: () => void;
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
  /** Proximity radius factor (default 0.5 per UX-D1). */
  proximityFactor?: number;
  /** Drag threshold in screen pixels (default 5). */
  dragThresholdPx?: number;
}

export interface InteractionController {
  /** Clean up gesture controller and all listeners. */
  destroy(): void;
}

// --- Drag state ---

const enum DragMode {
  None = 0,
  Pan = 1,
  Scrub = 2,
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
 * Drag disambiguation (per updated DEVPLAN 2d):
 * - Drag starting on a triangle → scrub mode (sequential triads on triangle change)
 * - Drag starting on background (hitTest = "none") → camera pan mode
 *
 * rAF sampling: dragMove hit-tests are throttled — retrigger only on triangle change.
 */
export function createInteractionController(
  options: InteractionControllerOptions,
): InteractionController {
  const { svg, cameraController, callbacks, getIndices } = options;
  const radius = computeProximityRadius(options.proximityFactor ?? 0.5);

  // --- Drag state ---
  let dragMode: DragMode = DragMode.None;
  let lastScrubTriId: TriId | null = null;
  let lastDragWorld: WorldPoint | null = null;
  /** Stored from onPointerDown — used for drag-start hit-test (not the threshold-exceeded position). */
  let pointerDownWorld: WorldPoint | null = null;

  // --- rAF state for scrub throttling ---
  let rafPending = false;
  let pendingScrubWorld: WorldPoint | null = null;

  function processScrubFrame(): void {
    rafPending = false;
    if (dragMode !== DragMode.Scrub || pendingScrubWorld === null) return;

    const indices = getIndices();
    const hit = hitTest(pendingScrubWorld.x, pendingScrubWorld.y, radius, indices);
    pendingScrubWorld = null;

    if (hit.type === "triangle" && hit.triId !== lastScrubTriId) {
      lastScrubTriId = hit.triId;
      const ref = indices.triIdToRef.get(hit.triId);
      if (ref) {
        const pcs = getTrianglePcs(ref);
        callbacks.onDragScrub?.(hit.triId, [...pcs]);
      }
    }
    // Edge hits suppressed during drag per UX-D3
  }

  // --- Gesture callbacks ---

  function onPointerDown(world: WorldPoint): void {
    pointerDownWorld = world;
    callbacks.onPointerDown?.(world);
  }

  function onPointerUp(): void {
    pointerDownWorld = null;
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
    // "none" — tap on background, no event
  }

  function onDragStart(dragStartWorld: WorldPoint): void {
    // Hit-test at the original pointerDown position (not the threshold-exceeded
    // position) because the pointer may have moved far in screen space before
    // the gesture controller fires onDragStart.
    const origin = pointerDownWorld ?? dragStartWorld;
    const indices = getIndices();
    const hit = hitTest(origin.x, origin.y, radius, indices);

    if (hit.type === "none") {
      // Background drag → camera pan
      dragMode = DragMode.Pan;
      lastDragWorld = dragStartWorld;
      cameraController.panStart();
    } else {
      // Triangle or edge at drag start → scrub mode
      dragMode = DragMode.Scrub;
      lastScrubTriId = hit.type === "triangle" ? hit.triId : null;
      lastDragWorld = null;

      // Emit first scrub event if starting on a triangle
      if (hit.type === "triangle") {
        const ref = indices.triIdToRef.get(hit.triId);
        if (ref) {
          const pcs = getTrianglePcs(ref);
          callbacks.onDragScrub?.(hit.triId, [...pcs]);
        }
      }
    }
  }

  function onDragMove(world: WorldPoint): void {
    if (dragMode === DragMode.Pan) {
      if (lastDragWorld) {
        const dx = world.x - lastDragWorld.x;
        const dy = world.y - lastDragWorld.y;
        // Negate: dragging right should pan view left (camera moves opposite to drag)
        cameraController.panMove(-dx, -dy);
      }
      lastDragWorld = world;
    } else if (dragMode === DragMode.Scrub) {
      // rAF-throttled hit-testing (RU-D5)
      pendingScrubWorld = world;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(processScrubFrame);
      }
    }
  }

  function onDragEnd(_dragEndWorld: WorldPoint): void {
    if (dragMode === DragMode.Pan) {
      cameraController.panEnd();
    }
    dragMode = DragMode.None;
    lastScrubTriId = null;
    lastDragWorld = null;
    pointerDownWorld = null;
    pendingScrubWorld = null;
    rafPending = false;
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
    },
  });

  return {
    destroy(): void {
      gestureCtrl.destroy();
      dragMode = DragMode.None;
      lastScrubTriId = null;
      lastDragWorld = null;
      pointerDownWorld = null;
      pendingScrubWorld = null;
      rafPending = false;
    },
  };
}
