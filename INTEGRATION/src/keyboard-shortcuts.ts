/**
 * Keyboard shortcuts for the integration module (Phase 7c).
 *
 * Binds global keyboard shortcuts:
 * - **Escape** → clear progression (equivalent to Clear button)
 * - **Space** → toggle play/stop (equivalent to Play or Stop button)
 *
 * Shortcuts are suppressed when a text input element is focused (textarea,
 * input, contenteditable) to avoid interfering with progression text entry.
 *
 * Returns a destroy function that removes the event listener.
 */

import type { UIStateController } from "rendering-ui";

/** Options for creating keyboard shortcuts. */
export interface KeyboardShortcutOptions {
  /** UI state controller — checked to determine valid actions. */
  uiState: UIStateController;
  /** Called when Escape is pressed with a progression loaded or playing. */
  onClear: () => void;
  /** Called when Space is pressed in progression-loaded state. */
  onPlay: () => void;
  /** Called when Space is pressed in playback-running state. */
  onStop: () => void;
}

/** Check if the currently focused element is a text input. */
function isTextInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Create keyboard shortcuts and attach a global keydown listener.
 *
 * @returns A destroy function that removes the listener.
 */
export function createKeyboardShortcuts(
  options: KeyboardShortcutOptions,
): { destroy: () => void } {
  const { uiState, onClear, onPlay, onStop } = options;

  function handleKeyDown(e: KeyboardEvent): void {
    if (isTextInputFocused()) return;

    if (e.key === "Escape") {
      const state = uiState.getState();
      if (state === "playback-running" || state === "progression-loaded") {
        e.preventDefault();
        onClear();
      }
      return;
    }

    if (e.key === " ") {
      const state = uiState.getState();
      if (state === "progression-loaded") {
        e.preventDefault();
        onPlay();
      } else if (state === "playback-running") {
        e.preventDefault();
        onStop();
      }
      return;
    }
  }

  document.addEventListener("keydown", handleKeyDown);

  return {
    destroy(): void {
      document.removeEventListener("keydown", handleKeyDown);
    },
  };
}
