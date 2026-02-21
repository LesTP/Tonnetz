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
  /** Fires on pinch zoom (two-finger gesture). Passes world-space center and scale factor. */
  onPinchZoom?: (center: WorldPoint, factor: number) => void;
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
 * pixel-movement threshold (UX-D3), and supports two-finger pinch-to-zoom.
 *
 * Pointer lifecycle (single pointer):
 *   pointerdown → accumulate movement → classify:
 *     - movement < threshold on pointerup → tap
 *     - movement ≥ threshold during pointermove → drag (start + move* + end)
 *
 * Pinch lifecycle (two pointers):
 *   second pointerdown → enter pinch mode (cancel any active drag/tap)
 *   pointermove with 2 pointers → compute scale factor from distance change → onPinchZoom
 *   one pointer lifts → exit pinch mode, suppress tap
 *
 * All callbacks receive world coordinates computed via screenToWorld at the
 * moment of the event, using the ViewBox snapshot from `getViewBox()`.
 */
export function createGestureController(
  options: GestureControllerOptions,
): GestureController {
  const { svg, getViewBox, callbacks } = options;
  const threshold = options.dragThresholdPx ?? 5;

  // --- Single-pointer state ---
  let isDown = false;
  let isDragging = false;
  let pointerId: number | null = null;
  let startScreenX = 0;
  let startScreenY = 0;
  let lastScreenX = 0;
  let lastScreenY = 0;

  // --- Pinch state (two pointers) ---
  let isPinching = false;
  /** Tracks active pointer positions: pointerId → {x, y} */
  const activePointers = new Map<number, { x: number; y: number }>();
  let lastPinchDist = 0;

  function toWorld(e: PointerEvent): WorldPoint {
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vb = getViewBox();
    return screenToWorld(sx, sy, vb, rect.width, rect.height);
  }

  function pinchDistance(): number {
    const pts = [...activePointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pinchCenter(): { sx: number; sy: number } {
    const pts = [...activePointers.values()];
    if (pts.length < 2) return { sx: 0, sy: 0 };
    return {
      sx: (pts[0].x + pts[1].x) / 2,
      sy: (pts[0].y + pts[1].y) / 2,
    };
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // primary button only

    // Track this pointer
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Second finger → enter pinch mode
    if (activePointers.size === 2) {
      // Stop any audio from initial pointer-down + cancel any active drag
      if (isDragging) {
        callbacks.onDragEnd?.(toWorld(e));
      }
      callbacks.onPointerUp?.();
      isPinching = true;
      isDown = false;
      isDragging = false;
      pointerId = null;
      lastPinchDist = pinchDistance();
      e.preventDefault();
      return;
    }

    // Already pinching or already tracking — ignore additional pointers
    if (isPinching || isDown) return;
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
    // Update tracked pointer position
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch mode — compute scale from distance change
    if (isPinching && activePointers.size >= 2) {
      e.preventDefault();
      const newDist = pinchDistance();
      if (lastPinchDist > 0 && newDist > 0) {
        const factor = newDist / lastPinchDist;
        const center = pinchCenter();
        const rect = svg.getBoundingClientRect();
        const vb = getViewBox();
        const worldCenter = screenToWorld(
          center.sx - rect.left,
          center.sy - rect.top,
          vb,
          rect.width,
          rect.height,
        );
        callbacks.onPinchZoom?.(worldCenter, factor);
      }
      lastPinchDist = newDist;
      return;
    }

    // Single-pointer drag
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
    activePointers.delete(e.pointerId);

    // Exiting pinch mode (one finger lifted)
    if (isPinching) {
      if (activePointers.size < 2) {
        isPinching = false;
        lastPinchDist = 0;
        // Don't fire tap — pinch is not a tap
        // If one finger remains, don't start a new drag either
        if (activePointers.size === 0) {
          callbacks.onPointerUp?.();
        }
      }
      return;
    }

    // Single-pointer up
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
    activePointers.delete(e.pointerId);

    if (isPinching) {
      if (activePointers.size < 2) {
        isPinching = false;
        lastPinchDist = 0;
      }
      return;
    }

    if (!isDown || e.pointerId !== pointerId) return;

    // Cancel is treated as a silent release — no tap or dragEnd.
    callbacks.onPointerUp?.();

    isDown = false;
    isDragging = false;
    pointerId = null;
  }

  // Prevent default touch behavior (browser zoom, scroll) on the SVG
  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length >= 2) {
      e.preventDefault();
    }
  }

  // --- Attach listeners ---
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerCancel);
  // Prevent browser's native pinch-zoom on the SVG element
  svg.addEventListener("touchstart", onTouchStart, { passive: false });

  return {
    destroy(): void {
      svg.removeEventListener("pointerdown", onPointerDown);
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("pointercancel", onPointerCancel);
      svg.removeEventListener("touchstart", onTouchStart);
      isDown = false;
      isDragging = false;
      pointerId = null;
      isPinching = false;
      activePointers.clear();
    },
  };
}
