/**
 * Rendering/UI — Tonnetz SVG rendering and interaction module.
 * Public API surface per ARCH_RENDERING_UI.md Section 11.
 */
export { latticeToWorld, worldToLattice, screenToWorld, triPolygonPoints } from "./coords.js";
export type { WorldPoint, LatticePoint, ViewBoxLike } from "./coords.js";

export {
  computeWindowBounds,
  computeInitialCamera,
  computeViewBox,
  applyPan,
  applyZoom,
} from "./camera.js";
export type { CameraState, ViewBox } from "./camera.js";

export { svgEl, setAttrs, SVG_NS } from "./svg-helpers.js";

export {
  createSvgScaffold,
  renderGrid,
  LAYER_IDS,
} from "./renderer.js";
export type { SvgScaffold, LayerId } from "./renderer.js";

export {
  createCameraController,
} from "./camera-controller.js";
export type { CameraController } from "./camera-controller.js";

export {
  createResizeController,
} from "./resize-controller.js";
export type { ResizeController, ResizeCallback } from "./resize-controller.js";

export {
  hitTest,
  computeProximityRadius,
} from "./hit-test.js";
export type {
  HitResult,
  HitTriangle,
  HitEdge,
  HitNone,
} from "./hit-test.js";

export {
  createGestureController,
} from "./gesture-controller.js";
export type {
  GestureController,
  GestureControllerOptions,
  GestureCallbacks,
} from "./gesture-controller.js";

export {
  createInteractionController,
} from "./interaction-controller.js";
export type {
  InteractionController,
  InteractionControllerOptions,
  InteractionCallbacks,
} from "./interaction-controller.js";

// Phase 3: Shape rendering
export {
  renderShape,
  clearShape,
} from "./shape-renderer.js";
export type {
  ShapeHandle,
  ShapeRenderOptions,
} from "./shape-renderer.js";

// Phase 3: Highlight API
export {
  highlightTriangle,
  highlightShape,
  clearHighlight,
  clearAllHighlights,
} from "./highlight.js";
export type {
  HighlightHandle,
  HighlightStyle,
} from "./highlight.js";
