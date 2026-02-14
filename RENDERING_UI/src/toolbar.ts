import { HIDDEN_CLASS, HIDDEN_CSS, injectCSS } from "./css-utils.js";

// --- Types ---

/** Options for creating a toolbar. */
export interface ToolbarOptions {
  /** Container element to render the toolbar into. */
  container: HTMLElement;
  /** Callback when user clicks Reset View button. */
  onResetView: () => void;
}

/** Toolbar interface. */
export interface Toolbar {
  /** Show the toolbar. */
  show(): void;
  /** Hide the toolbar. */
  hide(): void;
  /** Clean up the toolbar. */
  destroy(): void;
}

// --- CSS Class Names ---

const CSS_PREFIX = "tonnetz-tb";
const CSS = {
  root: `${CSS_PREFIX}`,
  button: `${CSS_PREFIX}-btn`,
  hidden: HIDDEN_CLASS,
} as const;

// --- Inline Styles (MVP — no external CSS) ---

const STYLES = `
.${CSS.root} {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
}

.${CSS.button} {
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.${CSS.button}:hover {
  background: #e8e8e8;
  border-color: #999;
}

.${CSS.button}:active {
  background: #ddd;
}

${HIDDEN_CSS}
`;

// --- Style Injection ID ---

const STYLE_ID = "toolbar";

/**
 * Create a toolbar component.
 *
 * Provides:
 * - Reset View button (reset camera to initial state)
 * - Future: Overlay toggles (roman numerals, heatmaps)
 */
export function createToolbar(options: ToolbarOptions): Toolbar {
  injectCSS(STYLE_ID, STYLES);

  const { container, onResetView } = options;

  // Create root element
  const root = document.createElement("div");
  root.className = CSS.root;

  // --- Reset View button ---
  const resetBtn = document.createElement("button");
  resetBtn.className = CSS.button;
  resetBtn.textContent = "Reset View";
  resetBtn.setAttribute("data-testid", "reset-view-btn");

  root.appendChild(resetBtn);
  container.appendChild(root);

  // --- Event handlers ---
  function handleResetView(): void {
    onResetView();
  }

  resetBtn.addEventListener("click", handleResetView);

  return {
    show(): void {
      root.classList.remove(CSS.hidden);
    },

    hide(): void {
      root.classList.add(CSS.hidden);
    },

    destroy(): void {
      resetBtn.removeEventListener("click", handleResetView);
      root.remove();
    },
  };
}
