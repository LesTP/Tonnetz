/**
 * Rendering/UI — Tonnetz SVG rendering and interaction module.
 * Public API surface per ARCH_RENDERING_UI.md Section 11.
 */
export { latticeToWorld, worldToLattice } from "./coords.js";
export type { WorldPoint, LatticePoint } from "./coords.js";

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
