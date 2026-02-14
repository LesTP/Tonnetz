import { HIDDEN_CLASS, HIDDEN_CSS, injectCSS } from "./css-utils.js";

// --- Types ---

/** Options for creating a layout manager. */
export interface LayoutManagerOptions {
  /** Root element to create layout structure in. */
  root: HTMLElement;
  /** Callback when canvas container resizes. */
  onCanvasResize?: (width: number, height: number) => void;
}

/** Layout manager interface. */
export interface LayoutManager {
  /** Get the canvas container (for SVG rendering). */
  getCanvasContainer(): HTMLElement;
  /** Get the control panel container. */
  getControlPanelContainer(): HTMLElement;
  /** Get the toolbar container. */
  getToolbarContainer(): HTMLElement;
  /** Toggle control panel visibility. */
  toggleControlPanel(visible: boolean): void;
  /** Check if control panel is visible. */
  isControlPanelVisible(): boolean;
  /** Clean up the layout manager. */
  destroy(): void;
}

// --- CSS Class Names ---

const CSS_PREFIX = "tonnetz-layout";
const CSS = {
  root: `${CSS_PREFIX}`,
  toolbar: `${CSS_PREFIX}-toolbar`,
  main: `${CSS_PREFIX}-main`,
  canvas: `${CSS_PREFIX}-canvas`,
  controlPanel: `${CSS_PREFIX}-control-panel`,
  hidden: HIDDEN_CLASS,
} as const;

// --- Inline Styles (MVP — no external CSS) ---

const STYLES = `
.${CSS.root} {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.${CSS.toolbar} {
  flex-shrink: 0;
  padding: 8px;
  background: #e8e8e8;
  border-bottom: 1px solid #ccc;
}

.${CSS.main} {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.${CSS.canvas} {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

.${CSS.controlPanel} {
  flex-shrink: 0;
  width: 280px;
  padding: 8px;
  background: #fafafa;
  border-left: 1px solid #ccc;
  overflow-y: auto;
}

${HIDDEN_CSS}

/* Responsive: stack control panel below canvas on narrow screens */
@media (max-width: 768px) {
  .${CSS.main} {
    flex-direction: column;
  }

  .${CSS.controlPanel} {
    width: 100%;
    border-left: none;
    border-top: 1px solid #ccc;
  }
}
`;

// --- Style Injection ID ---

const STYLE_ID = "layout-manager";

/**
 * Create a layout manager.
 *
 * Creates the three-zone layout structure:
 * - Toolbar (top)
 * - Central Canvas (main area, fills available space)
 * - Control Panel (right side, collapsible)
 *
 * Uses ResizeObserver to track canvas size changes and notify via callback.
 */
export function createLayoutManager(options: LayoutManagerOptions): LayoutManager {
  injectCSS(STYLE_ID, STYLES);

  const { root, onCanvasResize } = options;

  // Clear existing content
  root.innerHTML = "";

  // Create layout structure
  const layoutRoot = document.createElement("div");
  layoutRoot.className = CSS.root;

  const toolbarContainer = document.createElement("div");
  toolbarContainer.className = CSS.toolbar;
  toolbarContainer.setAttribute("data-testid", "toolbar-container");

  const mainArea = document.createElement("div");
  mainArea.className = CSS.main;

  const canvasContainer = document.createElement("div");
  canvasContainer.className = CSS.canvas;
  canvasContainer.setAttribute("data-testid", "canvas-container");

  const controlPanelContainer = document.createElement("div");
  controlPanelContainer.className = CSS.controlPanel;
  controlPanelContainer.setAttribute("data-testid", "control-panel-container");

  // Assemble
  mainArea.appendChild(canvasContainer);
  mainArea.appendChild(controlPanelContainer);
  layoutRoot.appendChild(toolbarContainer);
  layoutRoot.appendChild(mainArea);
  root.appendChild(layoutRoot);

  // Track control panel visibility
  let controlPanelVisible = true;

  // Set up ResizeObserver for canvas
  let resizeObserver: ResizeObserver | null = null;
  if (onCanvasResize && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvasContainer) {
          const { width, height } = entry.contentRect;
          onCanvasResize(width, height);
        }
      }
    });
    resizeObserver.observe(canvasContainer);
  }

  return {
    getCanvasContainer(): HTMLElement {
      return canvasContainer;
    },

    getControlPanelContainer(): HTMLElement {
      return controlPanelContainer;
    },

    getToolbarContainer(): HTMLElement {
      return toolbarContainer;
    },

    toggleControlPanel(visible: boolean): void {
      controlPanelVisible = visible;
      if (visible) {
        controlPanelContainer.classList.remove(CSS.hidden);
      } else {
        controlPanelContainer.classList.add(CSS.hidden);
      }
    },

    isControlPanelVisible(): boolean {
      return controlPanelVisible;
    },

    destroy(): void {
      resizeObserver?.disconnect();
      resizeObserver = null;
      layoutRoot.remove();
    },
  };
}
