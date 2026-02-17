/**
 * Transport wiring for the integration module.
 *
 * Phase 4a: AudioTransport events → RU highlighting/animation/UI state.
 * Phase 4b: ControlPanel buttons → AudioTransport controls.
 *
 * Wires the scheduled playback lifecycle: play/stop/clear buttons, chord
 * change animation, and UI state synchronization. All wiring returns
 * unsubscribe functions for clean teardown.
 *
 * See DEVPLAN §Phase 4.
 */

import type { AudioTransport } from "audio-engine";
import type { PathHandle, UIStateController } from "rendering-ui";

/**
 * Minimal interface for components that track playback running state.
 * Satisfied by both RU's ControlPanel and Integration's Sidebar.
 */
export interface PlaybackStateTarget {
  setPlaybackRunning(running: boolean): void;
  setProgressionLoaded(loaded: boolean): void;
}

// ── Phase 4a: Transport → Rendering ─────────────────────────────────

/**
 * Wire `AudioTransport.onChordChange` → `PathHandle.setActiveChord`.
 *
 * During scheduled playback, the transport fires chord change events.
 * This wiring keeps the progression path's active-chord highlight
 * synchronized with the currently playing chord.
 *
 * @returns Unsubscribe function.
 */
export function wireTransportToPath(
  transport: AudioTransport,
  pathHandle: PathHandle,
): () => void {
  return transport.onChordChange((event) => {
    pathHandle.setActiveChord(event.chordIndex);
  });
}

/**
 * Wire `AudioTransport.onStateChange` → `UIStateController`.
 *
 * Synchronizes the UI state machine with transport playback state:
 * - `playing: true` → `uiState.startPlayback()`
 * - `playing: false` → `uiState.stopPlayback()`
 *
 * The UIStateController guards invalid transitions internally, so
 * calling `startPlayback()` from an invalid state is a safe no-op.
 *
 * @returns Unsubscribe function.
 */
export function wireTransportToUIState(
  transport: AudioTransport,
  uiState: UIStateController,
): () => void {
  return transport.onStateChange((event) => {
    if (event.playing) {
      uiState.startPlayback();
    } else {
      uiState.stopPlayback();
    }
  });
}

/**
 * Wire `AudioTransport.onStateChange` → `ControlPanel.setPlaybackRunning`.
 *
 * Keeps the control panel's button disabled states (Play/Stop/Clear)
 * synchronized with the transport's playing state.
 *
 * @returns Unsubscribe function.
 */
export function wireTransportToControlPanel(
  transport: AudioTransport,
  controlPanel: PlaybackStateTarget,
): () => void {
  return transport.onStateChange((event) => {
    controlPanel.setPlaybackRunning(event.playing);
  });
}

/**
 * Wire all transport → rendering connections.
 *
 * Convenience function that wires path, UI state, and control panel
 * subscriptions in one call. Returns a single composite unsubscribe
 * function that removes all listeners.
 */
export function wireAllTransportSubscriptions(options: {
  transport: AudioTransport;
  pathHandle: PathHandle;
  uiState: UIStateController;
  controlPanel: PlaybackStateTarget;
}): () => void {
  const { transport, pathHandle, uiState, controlPanel } = options;

  const unsubs = [
    wireTransportToPath(transport, pathHandle),
    wireTransportToUIState(transport, uiState),
    wireTransportToControlPanel(transport, controlPanel),
  ];

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

// ── Phase 4b: ControlPanel → Transport ──────────────────────────────

/** Options for creating control panel → transport wiring. */
export interface ControlPanelWiringOptions {
  /** AudioTransport for play/stop control. */
  transport: AudioTransport;
  /** UI state controller for state transitions. */
  uiState: UIStateController;
  /** Control panel or sidebar for updating button states. */
  controlPanel: PlaybackStateTarget;
  /** Active PathHandle (may be null if no progression loaded). */
  getPathHandle: () => PathHandle | null;
  /**
   * Called when the user clicks Load with valid progression text.
   * The integration orchestrator implements this to run the full
   * progression pipeline and set up rendering + scheduling.
   * Returns true if loading succeeded, false on error.
   */
  onLoadProgression: (text: string) => boolean;
}

/**
 * Create ControlPanel action callbacks that wire to AudioTransport.
 *
 * Returns the callback functions to be passed to `createControlPanel(options)`:
 * - **onPlay** → `transport.play()` + `uiState.startPlayback()`
 * - **onStop** → `transport.stop()` + `uiState.stopPlayback()` + reset active chord
 * - **onClear** → `transport.cancelSchedule()` + `uiState.clearProgression()` + clear path + panel update
 * - **onLoadProgression** → delegates to the provided `onLoadProgression` callback
 */
export function createControlPanelCallbacks(
  options: ControlPanelWiringOptions,
): {
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onLoadProgression: (text: string) => void;
} {
  const { transport, uiState, controlPanel, getPathHandle, onLoadProgression } =
    options;

  const onPlay = (): void => {
    transport.play();
    // UIState transition is also driven by wireTransportToUIState,
    // but we call it here proactively for immediate UI response.
    uiState.startPlayback();
  };

  const onStop = (): void => {
    transport.stop();
    uiState.stopPlayback();

    // Reset active chord highlight to none
    const pathHandle = getPathHandle();
    if (pathHandle) {
      pathHandle.setActiveChord(-1);
    }
  };

  const onClear = (): void => {
    transport.cancelSchedule();
    uiState.clearProgression();

    // Clear rendered path
    const pathHandle = getPathHandle();
    if (pathHandle) {
      pathHandle.clear();
    }

    // Update panel button states
    controlPanel.setProgressionLoaded(false);
    controlPanel.setPlaybackRunning(false);
  };

  return {
    onPlay,
    onStop,
    onClear,
    onLoadProgression,
  };
}
