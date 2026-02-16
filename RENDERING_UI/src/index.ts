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
  applyPanWithExtent,
  applyZoom,
  windowWorldExtent,
} from "./camera.js";
export type { CameraState, ViewBox, WorldExtent } from "./camera.js";

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

// Phase 4: Path rendering
export {
  renderProgressionPath,
  clearProgression,
} from "./path-renderer.js";
export type {
  PathHandle,
  PathRenderOptions,
} from "./path-renderer.js";

// Phase 5: UI State
export {
  createUIStateController,
} from "./ui-state.js";
export type {
  UIState,
  UIStateController,
  UIStateChangeEvent,
  UIStateChangeCallback,
} from "./ui-state.js";

// Phase 5: Control Panel
export {
  createControlPanel,
} from "./control-panel.js";
export type {
  ControlPanel,
  ControlPanelOptions,
} from "./control-panel.js";

// Phase 5: Toolbar
export {
  createToolbar,
} from "./toolbar.js";
export type {
  Toolbar,
  ToolbarOptions,
} from "./toolbar.js";

// Phase 5: Layout Manager
export {
  createLayoutManager,
} from "./layout-manager.js";
export type {
  LayoutManager,
  LayoutManagerOptions,
} from "./layout-manager.js";

// Internal CSS utilities (exported for testing)
export {
  injectCSS,
  isStyleInjected,
  clearInjectedStyles,
  HIDDEN_CLASS,
} from "./css-utils.js";

// Grid highlighter (mutate-grid approach for playing state)
export {
  activateGridHighlight,
  deactivateGridHighlight,
} from "./grid-highlighter.js";
export type {
  GridHighlightHandle,
  GridHighlightOptions,
} from "./grid-highlighter.js";

// Proximity cursor
export {
  createProximityCursor,
} from "./cursor.js";
export type {
  ProximityCursor,
} from "./cursor.js";
