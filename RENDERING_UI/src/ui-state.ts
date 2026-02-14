import type { Shape } from "harmony-core";

// --- Types ---

/** UI state enumeration. */
export type UIState = "idle" | "chord-selected" | "progression-loaded" | "playback-running";

/** State change event payload. */
export interface UIStateChangeEvent {
  readonly state: UIState;
  readonly prevState: UIState;
  /** Currently selected shape (chord-selected state only). */
  readonly selectedShape: Shape | null;
  /** Loaded progression shapes (progression-loaded/playback-running states). */
  readonly progression: readonly Shape[] | null;
}

/** Callback for state change events. */
export type UIStateChangeCallback = (event: UIStateChangeEvent) => void;

/** UI state controller interface. */
export interface UIStateController {
  /** Get current UI state. */
  getState(): UIState;
  /** Get currently selected shape (null if not in chord-selected state). */
  getSelectedShape(): Shape | null;
  /** Get loaded progression (null if not in progression state). */
  getProgression(): readonly Shape[] | null;

  // --- State transitions ---

  /**
   * Select a chord (triangle/edge interaction).
   * Transitions: idle → chord-selected, chord-selected → chord-selected (new selection)
   */
  selectChord(shape: Shape): void;

  /**
   * Clear current selection.
   * Transitions: chord-selected → idle
   */
  clearSelection(): void;

  /**
   * Load a progression.
   * Transitions: idle → progression-loaded, chord-selected → progression-loaded
   */
  loadProgression(shapes: readonly Shape[]): void;

  /**
   * Clear loaded progression (Clear button, UX-D5).
   * Transitions: progression-loaded → idle
   */
  clearProgression(): void;

  /**
   * Start playback (deferred until Audio Engine).
   * Transitions: progression-loaded → playback-running
   */
  startPlayback(): void;

  /**
   * Stop playback (deferred until Audio Engine).
   * Transitions: playback-running → progression-loaded
   */
  stopPlayback(): void;

  // --- Event subscription ---

  /**
   * Subscribe to state change events.
   * @returns Unsubscribe function
   */
  onStateChange(callback: UIStateChangeCallback): () => void;

  /** Clean up resources. */
  destroy(): void;
}

// --- Implementation ---

/**
 * Create a UI state controller.
 *
 * Manages UI state machine per UX_SPEC §5:
 * - idle: user freely explores lattice
 * - chord-selected: chord cluster highlighted and playable
 * - progression-loaded: progression path displayed
 * - playback-running: scheduled playback active (deferred)
 */
export function createUIStateController(): UIStateController {
  let state: UIState = "idle";
  let selectedShape: Shape | null = null;
  let progression: readonly Shape[] | null = null;
  const listeners = new Set<UIStateChangeCallback>();

  function notifyListeners(prevState: UIState): void {
    const event: UIStateChangeEvent = {
      state,
      prevState,
      selectedShape,
      progression,
    };
    for (const callback of listeners) {
      callback(event);
    }
  }

  function transition(newState: UIState): void {
    if (newState === state) return;
    const prevState = state;
    state = newState;
    notifyListeners(prevState);
  }

  return {
    getState(): UIState {
      return state;
    },

    getSelectedShape(): Shape | null {
      return selectedShape;
    },

    getProgression(): readonly Shape[] | null {
      return progression;
    },

    selectChord(shape: Shape): void {
      // Valid from: idle, chord-selected
      // Invalid from: progression-loaded, playback-running (interaction suppressed)
      if (state === "progression-loaded" || state === "playback-running") {
        return;
      }

      const prevState = state;
      selectedShape = shape;
      progression = null;
      state = "chord-selected";

      // Always notify: either state changed (idle → chord-selected),
      // or shape changed within same state (chord-selected → chord-selected)
      notifyListeners(prevState);
    },

    clearSelection(): void {
      // Valid from: chord-selected
      if (state !== "chord-selected") {
        return;
      }

      selectedShape = null;
      transition("idle");
    },

    loadProgression(shapes: readonly Shape[]): void {
      // Valid from: idle, chord-selected
      // Invalid from: playback-running (must stop first)
      if (state === "playback-running") {
        return;
      }

      if (shapes.length === 0) {
        return;
      }

      selectedShape = null;
      progression = shapes;
      transition("progression-loaded");
    },

    clearProgression(): void {
      // Valid from: progression-loaded
      // UX-D5: Clear button dismisses progression
      if (state !== "progression-loaded") {
        return;
      }

      progression = null;
      transition("idle");
    },

    startPlayback(): void {
      // Valid from: progression-loaded
      // Deferred until Audio Engine
      if (state !== "progression-loaded") {
        return;
      }

      transition("playback-running");
    },

    stopPlayback(): void {
      // Valid from: playback-running
      // Deferred until Audio Engine
      if (state !== "playback-running") {
        return;
      }

      transition("progression-loaded");
    },

    onStateChange(callback: UIStateChangeCallback): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    destroy(): void {
      listeners.clear();
      selectedShape = null;
      progression = null;
    },
  };
}
