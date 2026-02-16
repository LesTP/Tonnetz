import { screenToWorld } from "./coords.js";
import type { ViewBoxLike } from "./coords.js";
import { svgEl } from "./svg-helpers.js";

/** Cursor circle style constants. */
const CURSOR_STROKE = "rgba(80, 80, 80, 0.5)";
const CURSOR_STROKE_WIDTH = 0.02;
const CURSOR_FILL = "rgba(80, 80, 80, 0.06)";
const CURSOR_DASH = "0.06 0.04";

export interface ProximityCursor {
  /** Remove the cursor element and all listeners. */
  destroy(): void;
}

/**
 * Create a proximity-circle cursor that follows the pointer on the SVG.
 *
 * Renders a dashed circle at the pointer's world position with the given
 * radius (matching the hit-test proximity radius). This gives the user
 * visual feedback on whether they'll hit a triangle or an edge.
 *
 * The cursor is hidden when the pointer leaves the SVG.
 *
 * @param svg The root SVG element
 * @param layer The SVG group to render the cursor in (typically layer-interaction)
 * @param radius Proximity radius in world units (default 0.5)
 * @param getViewBox Function returning the current viewBox for screen→world conversion
 */
export function createProximityCursor(
  svg: SVGSVGElement,
  layer: SVGGElement,
  radius: number,
  getViewBox: () => ViewBoxLike,
): ProximityCursor {
  const circle = svgEl("circle", {
    cx: 0,
    cy: 0,
    r: radius,
    fill: CURSOR_FILL,
    stroke: CURSOR_STROKE,
    "stroke-width": CURSOR_STROKE_WIDTH,
    "stroke-dasharray": CURSOR_DASH,
    "pointer-events": "none",
    visibility: "hidden",
    "data-cursor": "proximity",
  }) as SVGCircleElement;

  layer.appendChild(circle);

  function onPointerMove(e: PointerEvent): void {
    const rect = svg.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vb = getViewBox();
    const world = screenToWorld(sx, sy, vb, rect.width, rect.height);

    circle.setAttribute("cx", String(world.x));
    circle.setAttribute("cy", String(world.y));
    circle.setAttribute("visibility", "visible");
  }

  function onPointerLeave(): void {
    circle.setAttribute("visibility", "hidden");
  }

  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerleave", onPointerLeave);

  return {
    destroy(): void {
      svg.removeEventListener("pointermove", onPointerMove);
      svg.removeEventListener("pointerleave", onPointerLeave);
      circle.remove();
    },
  };
}
