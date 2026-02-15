/**
 * Tests for transport-wiring.ts — Phase 4a/4b.
 *
 * Phase 4a: Transport → rendering (path, UI state, control panel)
 * Phase 4b: ControlPanel → transport (play, stop, clear, load)
 *
 * Strategy:
 * - Mocks AudioTransport (onChordChange, onStateChange, play, stop, cancelSchedule)
 * - Mocks PathHandle (setActiveChord, clear, getChordCount)
 * - Mocks ControlPanel (setPlaybackRunning, setProgressionLoaded)
 * - Uses real UIStateController from RU for state transition verification
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  wireTransportToPath,
  wireTransportToUIState,
  wireTransportToControlPanel,
  wireAllTransportSubscriptions,
  createControlPanelCallbacks,
} from "../transport-wiring.js";

import { createUIStateController } from "rendering-ui";
import type { UIStateController } from "rendering-ui";

// ── Mock Factories ──────────────────────────────────────────────────

/** Create a mock AudioTransport with capturable event handlers. */
function createMockTransport() {
  const chordChangeListeners: Array<(event: { chordIndex: number; shape: any; timestamp: number }) => void> = [];
  const stateChangeListeners: Array<(event: { playing: boolean; timestamp: number }) => void> = [];

  return {
    transport: {
      getTime: vi.fn(() => 0),
      getContext: vi.fn(),
      getState: vi.fn(() => ({
        playing: false,
        tempo: 120,
        currentChordIndex: -1,
        totalChords: 0,
      })),
      isPlaying: vi.fn(() => false),
      getTempo: vi.fn(() => 120),
      getCurrentChordIndex: vi.fn(() => -1),
      setTempo: vi.fn(),
      scheduleProgression: vi.fn(),
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      cancelSchedule: vi.fn(),
      onStateChange: vi.fn((cb: (event: { playing: boolean; timestamp: number }) => void) => {
        stateChangeListeners.push(cb);
        return () => {
          const idx = stateChangeListeners.indexOf(cb);
          if (idx >= 0) stateChangeListeners.splice(idx, 1);
        };
      }),
      onChordChange: vi.fn((cb: (event: { chordIndex: number; shape: any; timestamp: number }) => void) => {
        chordChangeListeners.push(cb);
        return () => {
          const idx = chordChangeListeners.indexOf(cb);
          if (idx >= 0) chordChangeListeners.splice(idx, 1);
        };
      }),
    },
    fireChordChange(chordIndex: number) {
      for (const cb of chordChangeListeners) {
        cb({ chordIndex, shape: {}, timestamp: 0 });
      }
    },
    fireStateChange(playing: boolean) {
      for (const cb of stateChangeListeners) {
        cb({ playing, timestamp: 0 });
      }
    },
    chordChangeListeners,
    stateChangeListeners,
  };
}

/** Create a mock PathHandle. */
function createMockPathHandle() {
  return {
    setActiveChord: vi.fn(),
    clear: vi.fn(),
    getChordCount: vi.fn(() => 4),
  };
}

/** Create a mock ControlPanel. */
function createMockControlPanel() {
  return {
    show: vi.fn(),
    hide: vi.fn(),
    setProgressionLoaded: vi.fn(),
    setPlaybackRunning: vi.fn(),
    getInputText: vi.fn(() => ""),
    setInputText: vi.fn(),
    destroy: vi.fn(),
  };
}

/** Dummy Shape for UIStateController. */
const dummyShape = {
  chord: {} as any,
  main_tri: null,
  ext_tris: [],
  dot_pcs: [],
  covered_pcs: new Set<number>(),
  root_vertex_index: null,
  centroid_uv: { u: 0, v: 0 },
} as any;

// ── Shared state ────────────────────────────────────────────────────

let uiState: UIStateController;

beforeEach(() => {
  vi.clearAllMocks();
  uiState = createUIStateController();
});

// ═══════════════════════════════════════════════════════════════════
// Phase 4a: Transport → Rendering
// ═══════════════════════════════════════════════════════════════════

describe("wireTransportToPath", () => {
  it("onChordChange → setActiveChord with correct index", () => {
    const { transport, fireChordChange } = createMockTransport();
    const pathHandle = createMockPathHandle();

    wireTransportToPath(transport as any, pathHandle);

    fireChordChange(2);
    expect(pathHandle.setActiveChord).toHaveBeenCalledWith(2);

    fireChordChange(0);
    expect(pathHandle.setActiveChord).toHaveBeenCalledWith(0);
  });

  it("unsubscribe removes listener", () => {
    const { transport, fireChordChange } = createMockTransport();
    const pathHandle = createMockPathHandle();

    const unsub = wireTransportToPath(transport as any, pathHandle);
    unsub();

    fireChordChange(1);
    expect(pathHandle.setActiveChord).not.toHaveBeenCalled();
  });
});

describe("wireTransportToUIState", () => {
  it("playing:true → uiState.startPlayback()", () => {
    const { transport, fireStateChange } = createMockTransport();

    // Must be in progression-loaded for startPlayback to take effect
    uiState.loadProgression([dummyShape]);
    expect(uiState.getState()).toBe("progression-loaded");

    wireTransportToUIState(transport as any, uiState);
    fireStateChange(true);

    expect(uiState.getState()).toBe("playback-running");
  });

  it("playing:false → uiState.stopPlayback()", () => {
    const { transport, fireStateChange } = createMockTransport();

    // Get to playback-running state
    uiState.loadProgression([dummyShape]);
    uiState.startPlayback();
    expect(uiState.getState()).toBe("playback-running");

    wireTransportToUIState(transport as any, uiState);
    fireStateChange(false);

    expect(uiState.getState()).toBe("progression-loaded");
  });

  it("unsubscribe removes listener", () => {
    const { transport, fireStateChange } = createMockTransport();

    uiState.loadProgression([dummyShape]);
    const unsub = wireTransportToUIState(transport as any, uiState);
    unsub();

    fireStateChange(true);
    // Should still be progression-loaded (listener was removed)
    expect(uiState.getState()).toBe("progression-loaded");
  });

  it("natural completion (AE-D10) transitions UI to progression-loaded", () => {
    const { transport, fireStateChange } = createMockTransport();

    uiState.loadProgression([dummyShape]);
    uiState.startPlayback();
    expect(uiState.getState()).toBe("playback-running");

    wireTransportToUIState(transport as any, uiState);

    // Simulate natural playback completion (AE fires playing:false)
    fireStateChange(false);
    expect(uiState.getState()).toBe("progression-loaded");
  });
});

describe("wireTransportToControlPanel", () => {
  it("playing:true → setPlaybackRunning(true)", () => {
    const { transport, fireStateChange } = createMockTransport();
    const panel = createMockControlPanel();

    wireTransportToControlPanel(transport as any, panel);
    fireStateChange(true);

    expect(panel.setPlaybackRunning).toHaveBeenCalledWith(true);
  });

  it("playing:false → setPlaybackRunning(false)", () => {
    const { transport, fireStateChange } = createMockTransport();
    const panel = createMockControlPanel();

    wireTransportToControlPanel(transport as any, panel);
    fireStateChange(false);

    expect(panel.setPlaybackRunning).toHaveBeenCalledWith(false);
  });

  it("unsubscribe removes listener", () => {
    const { transport, fireStateChange } = createMockTransport();
    const panel = createMockControlPanel();

    const unsub = wireTransportToControlPanel(transport as any, panel);
    unsub();

    fireStateChange(true);
    expect(panel.setPlaybackRunning).not.toHaveBeenCalled();
  });
});

describe("wireAllTransportSubscriptions", () => {
  it("wires path, UIState, and controlPanel in one call", () => {
    const { transport, fireChordChange, fireStateChange } = createMockTransport();
    const pathHandle = createMockPathHandle();
    const panel = createMockControlPanel();

    uiState.loadProgression([dummyShape]);

    wireAllTransportSubscriptions({
      transport: transport as any,
      pathHandle,
      uiState,
      controlPanel: panel,
    });

    // Chord change → path
    fireChordChange(1);
    expect(pathHandle.setActiveChord).toHaveBeenCalledWith(1);

    // State change → UI state + panel
    fireStateChange(true);
    expect(uiState.getState()).toBe("playback-running");
    expect(panel.setPlaybackRunning).toHaveBeenCalledWith(true);
  });

  it("composite unsubscribe removes all listeners", () => {
    const {
      transport,
      fireChordChange,
      fireStateChange,
      chordChangeListeners,
      stateChangeListeners,
    } = createMockTransport();
    const pathHandle = createMockPathHandle();
    const panel = createMockControlPanel();

    uiState.loadProgression([dummyShape]);

    const unsub = wireAllTransportSubscriptions({
      transport: transport as any,
      pathHandle,
      uiState,
      controlPanel: panel,
    });

    // Verify listeners registered
    expect(chordChangeListeners.length).toBe(1);
    expect(stateChangeListeners.length).toBe(2); // UIState + ControlPanel

    unsub();

    expect(chordChangeListeners.length).toBe(0);
    expect(stateChangeListeners.length).toBe(0);

    // Events after unsub should have no effect
    fireChordChange(0);
    fireStateChange(true);
    expect(pathHandle.setActiveChord).not.toHaveBeenCalled();
    expect(panel.setPlaybackRunning).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 4b: ControlPanel → Transport
// ═══════════════════════════════════════════════════════════════════

describe("createControlPanelCallbacks", () => {
  describe("onPlay", () => {
    it("calls transport.play() and uiState.startPlayback()", () => {
      const { transport } = createMockTransport();
      const panel = createMockControlPanel();
      const pathHandle = createMockPathHandle();

      uiState.loadProgression([dummyShape]);
      expect(uiState.getState()).toBe("progression-loaded");

      const callbacks = createControlPanelCallbacks({
        transport: transport as any,
        uiState,
        controlPanel: panel,
        getPathHandle: () => pathHandle,
        onLoadProgression: vi.fn(() => true),
      });

      callbacks.onPlay();

      expect(transport.play).toHaveBeenCalledOnce();
      expect(uiState.getState()).toBe("playback-running");
    });
  });

  describe("onStop", () => {
    it("calls transport.stop(), uiState.stopPlayback(), and resets active chord", () => {
      const { transport } = createMockTransport();
      const panel = createMockControlPanel();
      const pathHandle = createMockPathHandle();

      uiState.loadProgression([dummyShape]);
      uiState.startPlayback();
      expect(uiState.getState()).toBe("playback-running");

      const callbacks = createControlPanelCallbacks({
        transport: transport as any,
        uiState,
        controlPanel: panel,
        getPathHandle: () => pathHandle,
        onLoadProgression: vi.fn(() => true),
      });

      callbacks.onStop();

      expect(transport.stop).toHaveBeenCalledOnce();
      expect(uiState.getState()).toBe("progression-loaded");
      expect(pathHandle.setActiveChord).toHaveBeenCalledWith(-1);
    });

    it("handles null pathHandle gracefully", () => {
      const { transport } = createMockTransport();
      const panel = createMockControlPanel();

      uiState.loadProgression([dummyShape]);
      uiState.startPlayback();

      const callbacks = createControlPanelCallbacks({
        transport: transport as any,
        uiState,
        controlPanel: panel,
        getPathHandle: () => null,
        onLoadProgression: vi.fn(() => true),
      });

      // Should not throw even with null pathHandle
      expect(() => callbacks.onStop()).not.toThrow();
      expect(transport.stop).toHaveBeenCalledOnce();
    });
  });

  describe("onClear", () => {
    it("cancels schedule, clears progression, clears path, and updates panel", () => {
      const { transport } = createMockTransport();
      const panel = createMockControlPanel();
      const pathHandle = createMockPathHandle();

      uiState.loadProgression([dummyShape]);
      expect(uiState.getState()).toBe("progression-loaded");

      const callbacks = createControlPanelCallbacks({
        transport: transport as any,
        uiState,
        controlPanel: panel,
        getPathHandle: () => pathHandle,
        onLoadProgression: vi.fn(() => true),
      });

      callbacks.onClear();

      expect(transport.cancelSchedule).toHaveBeenCalledOnce();
      expect(uiState.getState()).toBe("idle");
      expect(pathHandle.clear).toHaveBeenCalledOnce();
      expect(panel.setProgressionLoaded).toHaveBeenCalledWith(false);
      expect(panel.setPlaybackRunning).toHaveBeenCalledWith(false);
    });

    it("handles null pathHandle gracefully", () => {
      const { transport } = createMockTransport();
      const panel = createMockControlPanel();

      uiState.loadProgression([dummyShape]);

      const callbacks = createControlPanelCallbacks({
        transport: transport as any,
        uiState,
        controlPanel: panel,
        getPathHandle: () => null,
        onLoadProgression: vi.fn(() => true),
      });

      expect(() => callbacks.onClear()).not.toThrow();
      expect(transport.cancelSchedule).toHaveBeenCalledOnce();
    });
  });

  describe("onLoadProgression", () => {
    it("delegates to provided callback", () => {
      const { transport } = createMockTransport();
      const panel = createMockControlPanel();
      const loadSpy = vi.fn(() => true);

      const callbacks = createControlPanelCallbacks({
        transport: transport as any,
        uiState,
        controlPanel: panel,
        getPathHandle: () => null,
        onLoadProgression: loadSpy,
      });

      callbacks.onLoadProgression("Dm7 | G7 | Cmaj7");
      expect(loadSpy).toHaveBeenCalledWith("Dm7 | G7 | Cmaj7");
    });
  });
});
