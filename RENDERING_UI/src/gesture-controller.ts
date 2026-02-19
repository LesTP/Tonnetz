import type { ViewBox } from "./camera.js";
import { screenToWorld } from "./coords.js";
import type { WorldPoint } from "./coords.js";

// --- Callback types ---

export interface GestureCallbacks {
  /** Fires immediately on pointer-down, before tap/drag classification. */
  onPointerDown?: (world: WorldPoint) => void;
  /** Fires on pointer-up (release), regardless of classification. */
  onPointerUp?: () => void;
  /** Fires when a pointer interaction is classified as a tap (movement < threshold). */
  onTap?: (world: WorldPoint) => void;
  /** Fires when drag threshold is first exceeded. */
  onDragStart?: (world: WorldPoint) => void;
  /** Fires on each subsequent pointer move during an active drag. Passes screen-pixel deltas since last move for stable panning. */
  onDragMove?: (world: WorldPoint, screenDx: number, screenDy: number) => void;
  /** Fires on pointer-up after a drag. */
  onDragEnd?: (world: WorldPoint) => void;
}

export interface GestureControllerOptions {
  /** SVG element to attach pointer listeners to. */
  svg: SVGSVGElement;
  /** Returns the current ViewBox (for screen→world conversion). */
  getViewBox: () => ViewBox;
  /** Drag threshold in screen pixels (default 5). */
  dragThresholdPx?: number;
  /** Gesture callbacks. */
  callbacks: GestureCallbacks;
}

export interface GestureController {
  /** Remove all event listeners. */
  destroy(): void;
}

/**
 * Gesture controller that disambiguates tap/click from drag based on a
 * pixel-movement threshold (UX-D3).
 *
 * Pointer lifecycle:
 *   pointerdown → accumulate movement → classify:
 *     - movement < threshold on pointerup → tap
 *     - movement ≥ threshold during pointermove → drag (start + move* + end)
 *
 * All callbacks receive world coordinates computed via screenToWorld at the
 * moment of the event, using the ViewBox snapshot from `getViewBox()`.
 *
 * Attaches `setPointerCapture` for reliable drag tracking across the SVG boundary.
 */
export function createGestureController(
  options: GestureControllerOptions,
): GestureController {
  const { svg, getViewBox, callbacks } = options;
  const threshold = options.dragThresholdPx ?? 5;

  // --- Active pointer state ---
  let isDown = false;
  let isDragging = false;
  let pointerId: number | null = null;
  let startScreenX = 0;
  let startScreenY = 0;
  let lastScreenX = 0;
  let lastScreenY = 0;

  function toWorld(e: PointerEvent): WorldPoint {
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vb = getViewBox();
    return screenToWorld(sx, sy, vb, rect.width, rect.height);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // primary button only
    if (isDown) return; // ignore if already tracking a pointer
    e.preventDefault();

    isDown = true;
    isDragging = false;
    pointerId = e.pointerId;
    startScreenX = e.clientX;
    startScreenY = e.clientY;
    lastScreenX = e.clientX;
    lastScreenY = e.clientY;

    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // happy-dom or test env may not support setPointerCapture
    }

    callbacks.onPointerDown?.(toWorld(e));
  }

  function onPointerMove(e: PointerEvent): void {
    if (!isDown || e.pointerId !== pointerId) return;
    e.preventDefault();

    const dx = e.clientX - startScreenX;
    const dy = e.clientY - startScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!isDragging) {
      if (dist >= threshold) {
        isDragging = true;
        callbacks.onDragStart?.(toWorld(e));
      }
      // Still below threshold — don't fire anything yet
      return;
    }

    // Already dragging — fire move with screen deltas
    const screenDx = e.clientX - lastScreenX;
    const screenDy = e.clientY - lastScreenY;
    lastScreenX = e.clientX;
    lastScreenY = e.clientY;
    callbacks.onDragMove?.(toWorld(e), screenDx, screenDy);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!isDown || e.pointerId !== pointerId) return;

    const world = toWorld(e);

    if (isDragging) {
      callbacks.onDragEnd?.(world);
    } else {
      // Movement stayed below threshold → tap
      callbacks.onTap?.(world);
    }

    callbacks.onPointerUp?.();

    // Reset state
    isDown = false;
    isDragging = false;
    pointerId = null;
  }

  function onPointerCancel(e: PointerEvent): void {
    if (!isDown || e.pointerId !== pointerId) return;

    // Cancel is treated as a silent release — no tap or dragEnd.
    callbacks.onPointerUp?.();

    isDown = false;
    isDragging = false;
    pointerId = null;
  }

  // --- Attach listeners ---
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerCancel);

  return {
    destroy(): void {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerCancel);
      isDown = false;
      isDragging = false;
      pointerId = null;
    },
  };
}
