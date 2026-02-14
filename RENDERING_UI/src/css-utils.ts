/**
 * Shared CSS utilities for Tonnetz UI components.
 *
 * Provides:
 * - Centralized style injection with deduplication
 * - Shared CSS class constants
 */

// --- Shared CSS Classes ---

/** Shared hidden class for all components. */
export const HIDDEN_CLASS = "tonnetz-hidden";

/** CSS for the shared hidden class. */
export const HIDDEN_CSS = `.${HIDDEN_CLASS} { display: none !important; }`;

// --- Style Injection ---

/** Tracks which style IDs have been injected. */
const injectedStyles = new Set<string>();

/**
 * Inject CSS into the document head with deduplication.
 *
 * @param id - Unique identifier for this style block (e.g., "control-panel")
 * @param css - CSS string to inject
 *
 * @example
 * ```ts
 * injectCSS("my-component", `.my-class { color: red; }`);
 * ```
 */
export function injectCSS(id: string, css: string): void {
  if (injectedStyles.has(id)) return;

  const style = document.createElement("style");
  style.setAttribute("data-tonnetz", id);
  style.textContent = css;
  document.head.appendChild(style);

  injectedStyles.add(id);
}

/**
 * Check if a style has been injected.
 * Primarily for testing.
 */
export function isStyleInjected(id: string): boolean {
  return injectedStyles.has(id);
}

/**
 * Clear all injected styles.
 * Primarily for testing to reset state between tests.
 */
export function clearInjectedStyles(): void {
  for (const id of injectedStyles) {
    const style = document.querySelector(`style[data-tonnetz="${id}"]`);
    style?.remove();
  }
  injectedStyles.clear();
}
