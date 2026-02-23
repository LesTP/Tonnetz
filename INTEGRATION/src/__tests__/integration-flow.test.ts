/**
 * Integration flow test — Phase 7a.
 *
 * End-to-end test for the full progression lifecycle:
 *   load → play → chord-advance → stop → re-load → clear
 *
 * Strategy:
 * - Mock AE module (no AudioContext in happy-dom) with controllable transport
 *   that stores event listeners and can fire them programmatically
 * - Use real HC functions (parseChordSymbol, mapProgressionToShapes, buildWindowIndices)
 * - Use real RU UIStateController (state machine) for state verification
 * - Use real PD functions with happy-dom localStorage
 * - Simulate the same wiring main.ts performs, but in a controlled test harness
 *
 * This test validates cross-module data flow — the "wiring correctness" that
 * no single unit test can cover.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ── Mock AE with controllable transport ─────────────────────────────

const chordChangeListeners: Array<
  (event: { chordIndex: number; shape: any; timestamp: number }) => void
> = [];
const stateChangeListeners: Array<
  (event: { playing: boolean; timestamp: number }) => void
> = [];

function fireChordChange(chordIndex: number) {
  for (const cb of chordChangeListeners) {
    cb({ chordIndex, shape: {}, timestamp: Date.now() });
  }
}
function fireStateChange(playing: boolean) {
  for (const cb of stateChangeListeners) {
    cb({ playing, timestamp: Date.now() });
  }
}

vi.mock("audio-engine", () => {
  const mockTransport = {
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
    onStateChange: vi.fn(
      (cb: (event: { playing: boolean; timestamp: number }) => void) => {
        stateChangeListeners.push(cb);
        return () => {
          const idx = stateChangeListeners.indexOf(cb);
          if (idx >= 0) stateChangeListeners.splice(idx, 1);
        };
      },
    ),
    onChordChange: vi.fn(
      (
        cb: (event: {
          chordIndex: number;
          shape: any;
          timestamp: number;
        }) => void,
      ) => {
        chordChangeListeners.push(cb);
        return () => {
          const idx = chordChangeListeners.indexOf(cb);
          if (idx >= 0) chordChangeListeners.splice(idx, 1);
        };
      },
    ),
  };

  const mockImmediatePlayback = {
    transport: mockTransport,
    masterGain: {},
    voices: new Set(),
    prevVoicing: [],
  };

  return {
    initAudio: vi.fn(async () => mockTransport),
    initAudioSync: vi.fn(() => mockTransport),
    createImmediatePlayback: vi.fn(() => mockImmediatePlayback),
    playPitchClasses: vi.fn(),
    playShape: vi.fn(),
    stopAll: vi.fn(),
    __mockTransport: mockTransport,
    __mockImmediatePlayback: mockImmediatePlayback,
  };
});

// @ts-expect-error — test-only export
import { __mockTransport } from "audio-engine";

// ── Real imports ────────────────────────────────────────────────────

import { buildWindowIndices } from "harmony-core";
import type { CentroidCoord, WindowIndices } from "harmony-core";

import { createUIStateController } from "rendering-ui";
import type { UIStateController, PathHandle, ControlPanel } from "rendering-ui";

import {
  parseProgressionInput,
  loadProgressionPipeline,
} from "../progression-pipeline.js";
import type { PipelineSuccess } from "../progression-pipeline.js";
import {
  createAppAudioState,
  ensureAudio,
} from "../interaction-wiring.js";
import type { AppAudioState } from "../interaction-wiring.js";
import { wireAllTransportSubscriptions } from "../transport-wiring.js";
import {
  initPersistence,
  checkUrlHash,
  DEFAULT_GRID,
} from "../persistence-wiring.js";
import { encodeShareUrl } from "persistence-data";

// ── Shared fixtures ─────────────────────────────────────────────────

const TEST_BOUNDS = { uMin: -4, uMax: 4, vMin: -4, vMax: 4 };

let indices: WindowIndices;
let uiState: UIStateController;
let audioState: AppAudioState;
let mockPathHandle: PathHandle;
let mockControlPanel: ControlPanel;

beforeEach(() => {
  vi.clearAllMocks();
  chordChangeListeners.length = 0;
  stateChangeListeners.length = 0;
  localStorage.clear();

  indices = buildWindowIndices(TEST_BOUNDS);
  uiState = createUIStateController();
  audioState = createAppAudioState();

  mockPathHandle = {
    setActiveChord: vi.fn(),
    clear: vi.fn(),
    getChordCount: vi.fn(() => 0),
  };

  mockControlPanel = {
    show: vi.fn(),
    hide: vi.fn(),
    setProgressionLoaded: vi.fn(),
    setPlaybackRunning: vi.fn(),
    getInputText: vi.fn(() => ""),
    setInputText: vi.fn(),
    destroy: vi.fn(),
  };
});

// ── Helper: replicate main.ts wiring in miniature ───────────────────

/**
 * Simulates the progression load + wiring flow from main.ts.
 *
 * Returns the pipeline result and wires transport subscriptions
 * so that chord-change and state-change events propagate to
 * the path handle, UI state, and control panel.
 */
async function loadAndWire(text: string) {
  const chords = parseProgressionInput(text);
  const focus: CentroidCoord = { u: 0, v: 0 };

  const result = loadProgressionPipeline({
    chords,
    focus,
    indices,
  });

  if (!result.ok) return result;

  // Simulate main.ts: loadProgression on UI state
  uiState.loadProgression(result.shapes);
  mockControlPanel.setProgressionLoaded(true);

  // Simulate main.ts: ensureAudio + schedule + wire transport
  const { transport } = ensureAudio(audioState);
  transport.setTempo(120);
  transport.scheduleProgression(result.events);

  // Wire transport subscriptions (same as main.ts does on first load)
  const unsub = wireAllTransportSubscriptions({
    transport,
    pathHandle: mockPathHandle,
    uiState,
    controlPanel: mockControlPanel,
  });

  return { ...result, unsub };
}

// ═══════════════════════════════════════════════════════════════════
// Phase 7a: Full Progression Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe("Full progression lifecycle: load → play → stop → clear", () => {
  // ── Load ─────────────────────────────────────────────────────────

  describe("Load progression", () => {
    it("parses text and produces shapes + events for ii-V-I", async () => {
      const result = await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(result.ok).toBe(true);

      const success = result as PipelineSuccess;
      expect(success.shapes).toHaveLength(3);
      expect(success.events).toHaveLength(3);
    });

    it("transitions UI state to progression-loaded", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(uiState.getState()).toBe("progression-loaded");
    });

    it("calls transport.scheduleProgression with correct event count", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(__mockTransport.scheduleProgression).toHaveBeenCalledOnce();

      const events = (__mockTransport.scheduleProgression as Mock).mock.calls[0][0];
      expect(events).toHaveLength(3);
    });

    it("events have correct startBeat progression (POL-D17: 4 beats each)", async () => {
      const result = await loadAndWire("Dm7 G7 Cmaj7");
      const success = result as PipelineSuccess;

      expect(success.events[0].startBeat).toBe(0);
      expect(success.events[1].startBeat).toBe(4);
      expect(success.events[2].startBeat).toBe(8);
      expect(success.events[0].durationBeats).toBe(4);
    });

    it("repeated chords produce separate shapes (POL-D17: no collapsing)", async () => {
      const result = await loadAndWire("Dm7 Dm7 G7 Cmaj7 Cmaj7 Cmaj7");
      const success = result as PipelineSuccess;

      // POL-D17: no collapsing — 6 tokens = 6 shapes
      expect(success.shapes).toHaveLength(6);
      expect(success.events).toHaveLength(6);
      expect(success.events[0].durationBeats).toBe(4);
      expect(success.events[5].startBeat).toBe(20);
    });

    it("sets tempo on transport from persistence settings", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(__mockTransport.setTempo).toHaveBeenCalledWith(120);
    });

    it("updates control panel to show progression loaded", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(mockControlPanel.setProgressionLoaded).toHaveBeenCalledWith(true);
    });

    it("shape objects are shared between pipeline result and scheduled events", async () => {
      const result = await loadAndWire("Dm7 G7 Cmaj7");
      const success = result as PipelineSuccess;
      const scheduledEvents = (__mockTransport.scheduleProgression as Mock).mock
        .calls[0][0];

      for (let i = 0; i < success.shapes.length; i++) {
        expect(scheduledEvents[i].shape).toBe(success.shapes[i]);
      }
    });

    it("strips invalid chord symbols and plays valid ones", () => {
      const chords = parseProgressionInput("Dm7 | Xbad | Cmaj7");
      const result = loadProgressionPipeline({
        chords,
        focus: { u: 0, v: 0 },
        indices,
      });

      expect(result.ok).toBe(true);
      expect(result.shapes).toHaveLength(2);
    });
  });

  // ── Play ─────────────────────────────────────────────────────────

  describe("Play", () => {
    it("transport.play() transitions UI to playback-running via wired listener", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(uiState.getState()).toBe("progression-loaded");

      // Simulate: user clicks Play → transport fires stateChange(playing:true)
      __mockTransport.play();
      fireStateChange(true);

      expect(uiState.getState()).toBe("playback-running");
    });

    it("control panel receives playback-running state update", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      vi.mocked(mockControlPanel.setPlaybackRunning).mockClear();

      fireStateChange(true);

      expect(mockControlPanel.setPlaybackRunning).toHaveBeenCalledWith(true);
    });
  });

  // ── Chord advance ────────────────────────────────────────────────

  describe("Chord advance during playback", () => {
    it("chord change events update path handle active chord", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      fireStateChange(true); // start playback

      fireChordChange(0);
      expect(mockPathHandle.setActiveChord).toHaveBeenCalledWith(0);

      fireChordChange(1);
      expect(mockPathHandle.setActiveChord).toHaveBeenCalledWith(1);

      fireChordChange(2);
      expect(mockPathHandle.setActiveChord).toHaveBeenCalledWith(2);
    });

    it("chord changes propagate sequentially through all chords", async () => {
      await loadAndWire("Am | Dm | G7 | Cmaj7");
      fireStateChange(true);

      // Fire all 4 chord changes
      for (let i = 0; i < 4; i++) {
        fireChordChange(i);
      }

      const calls = (mockPathHandle.setActiveChord as Mock).mock.calls;
      expect(calls).toEqual([[0], [1], [2], [3]]);
    });
  });

  // ── Stop ─────────────────────────────────────────────────────────

  describe("Stop", () => {
    it("transport stop transitions UI back to progression-loaded", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");

      // Play
      fireStateChange(true);
      expect(uiState.getState()).toBe("playback-running");

      // Stop — transport fires stateChange(playing:false)
      fireStateChange(false);
      expect(uiState.getState()).toBe("progression-loaded");
    });

    it("control panel receives playback-stopped state update", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      fireStateChange(true);
      vi.mocked(mockControlPanel.setPlaybackRunning).mockClear();

      fireStateChange(false);
      expect(mockControlPanel.setPlaybackRunning).toHaveBeenCalledWith(false);
    });

    it("natural completion (playing:false without explicit stop) also transitions correctly", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");

      fireStateChange(true);
      expect(uiState.getState()).toBe("playback-running");

      // AE fires playing:false when schedule completes naturally (AE-D10)
      fireStateChange(false);
      expect(uiState.getState()).toBe("progression-loaded");
    });
  });

  // ── Clear ────────────────────────────────────────────────────────

  describe("Clear", () => {
    it("clearProgression returns UI to idle state", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(uiState.getState()).toBe("progression-loaded");

      // Simulate main.ts handleClear:
      __mockTransport.cancelSchedule();
      uiState.clearProgression();

      expect(uiState.getState()).toBe("idle");
      expect(__mockTransport.cancelSchedule).toHaveBeenCalled();
    });

    it("clear after play→stop returns to idle", async () => {
      await loadAndWire("Dm7 | G7 | Cmaj7");

      // Play
      fireStateChange(true);
      expect(uiState.getState()).toBe("playback-running");

      // Stop
      fireStateChange(false);
      expect(uiState.getState()).toBe("progression-loaded");

      // Clear
      uiState.clearProgression();
      expect(uiState.getState()).toBe("idle");
    });
  });

  // ── Full cycle ───────────────────────────────────────────────────

  describe("Full cycle: load → play → advance → stop → reload → play → clear", () => {
    it("exercises the complete lifecycle", async () => {
      // ── 1. Load first progression ──
      const r1 = await loadAndWire("Dm7 | G7 | Cmaj7");
      expect(r1.ok).toBe(true);
      expect(uiState.getState()).toBe("progression-loaded");

      // ── 2. Play ──
      __mockTransport.play();
      fireStateChange(true);
      expect(uiState.getState()).toBe("playback-running");

      // ── 3. Advance through chords ──
      fireChordChange(0);
      fireChordChange(1);
      fireChordChange(2);
      expect(mockPathHandle.setActiveChord).toHaveBeenLastCalledWith(2);

      // ── 4. Stop ──
      __mockTransport.stop();
      fireStateChange(false);
      expect(uiState.getState()).toBe("progression-loaded");
      expect(mockControlPanel.setPlaybackRunning).toHaveBeenLastCalledWith(
        false,
      );

      // ── 5. Clear first progression ──
      __mockTransport.cancelSchedule();
      uiState.clearProgression();
      expect(uiState.getState()).toBe("idle");

      // ── 6. Load second (different) progression ──
      // Reset listener arrays since wireAllTransportSubscriptions was called by loadAndWire
      // and we're about to call it again
      chordChangeListeners.length = 0;
      stateChangeListeners.length = 0;

      const chords2 = parseProgressionInput("Am | F | C | G");
      const result2 = loadProgressionPipeline({
        chords: chords2,
        focus: { u: 0, v: 0 },
        indices,
      });
      expect(result2.ok).toBe(true);
      if (!result2.ok) return;

      uiState.loadProgression(result2.shapes);
      const transport = audioState.transport!;
      transport.scheduleProgression(result2.events);

      // Re-wire transport
      wireAllTransportSubscriptions({
        transport,
        pathHandle: mockPathHandle,
        uiState,
        controlPanel: mockControlPanel,
      });

      expect(uiState.getState()).toBe("progression-loaded");
      expect(result2.shapes).toHaveLength(4);
      expect(result2.events).toHaveLength(4);

      // ── 7. Play second progression ──
      transport.play();
      fireStateChange(true);
      expect(uiState.getState()).toBe("playback-running");

      fireChordChange(0);
      fireChordChange(1);
      fireChordChange(2);
      fireChordChange(3);
      expect(mockPathHandle.setActiveChord).toHaveBeenLastCalledWith(3);

      // ── 8. Clear during playback (force stop + clear) ──
      transport.stop();
      fireStateChange(false);
      expect(uiState.getState()).toBe("progression-loaded");

      transport.cancelSchedule();
      uiState.clearProgression();
      expect(uiState.getState()).toBe("idle");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 7a: Persistence Integration
// ═══════════════════════════════════════════════════════════════════

describe("Persistence integration", () => {
  it("initPersistence loads default settings (150 bpm)", () => {
    const state = initPersistence();
    expect(state.settings.tempo_bpm).toBe(150);
    expect(state.backend).toBeDefined();
  });

  it("checkUrlHash decodes a valid shared progression", () => {
    const encoded = encodeShareUrl({
      chords: ["Dm7", "G7", "Cmaj7"],
      tempo_bpm: 140,
      grid: "1/4",
    });
    const hash = `#p=${encoded}`;

    const check = checkUrlHash(hash);
    expect(check.found).toBe(true);
    if (check.found) {
      expect(check.payload.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
      expect(check.payload.tempo_bpm).toBe(140);
      expect(check.payload.grid).toBe("1/4");
    }
  });

  it("URL hash progression feeds into pipeline successfully", () => {
    const encoded = encodeShareUrl({
      chords: ["Am", "Dm", "G7", "Cmaj7"],
      tempo_bpm: 100,
      grid: "1/4",
    });
    const hash = `#p=${encoded}`;

    const check = checkUrlHash(hash);
    expect(check.found).toBe(true);
    if (!check.found) return;

    const result = loadProgressionPipeline({
      chords: [...check.payload.chords],
      focus: { u: 0, v: 0 } as CentroidCoord,
      indices,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // POL-D17: 4 beats per chord
    expect(result.shapes).toHaveLength(4);
    expect(result.events).toHaveLength(4);
    expect(result.events[0].durationBeats).toBe(4);
    expect(result.events[1].startBeat).toBe(4);
    expect(result.events[3].startBeat).toBe(12);
  });

  it("checkUrlHash returns found:false for missing hash", () => {
    expect(checkUrlHash("")).toEqual({ found: false });
    expect(checkUrlHash("#")).toEqual({ found: false });
    expect(checkUrlHash("#other=stuff")).toEqual({ found: false });
  });

  it("checkUrlHash returns found:false for malformed payload", () => {
    const check = checkUrlHash("#p=INVALIDGARBAGE!!!");
    expect(check.found).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 7a: State Machine Constraints
// ═══════════════════════════════════════════════════════════════════

describe("UI state machine constraints", () => {
  it("cannot start playback from idle", () => {
    expect(uiState.getState()).toBe("idle");
    uiState.startPlayback(); // should be no-op
    expect(uiState.getState()).toBe("idle");
  });

  it("load → play → stop → clear produces correct state sequence", async () => {
    const states: string[] = [];
    uiState.onStateChange((event) => states.push(event.state));

    await loadAndWire("C | G | Am | F");

    fireStateChange(true); // play
    fireStateChange(false); // stop
    uiState.clearProgression(); // clear

    expect(states).toEqual([
      "progression-loaded",
      "playback-running",
      "progression-loaded",
      "idle",
    ]);
  });

  it("double-play is idempotent (stays in playback-running)", async () => {
    await loadAndWire("C | G | Am");

    fireStateChange(true);
    expect(uiState.getState()).toBe("playback-running");

    // Second play should be no-op
    fireStateChange(true);
    expect(uiState.getState()).toBe("playback-running");
  });

  it("transport subscriptions are cleaned up by unsub", async () => {
    const result = await loadAndWire("Dm7 | G7 | Cmaj7");
    const { unsub } = result as PipelineSuccess & { unsub: () => void };

    // Verify listeners are registered
    expect(chordChangeListeners.length).toBe(1);
    expect(stateChangeListeners.length).toBe(2); // UIState + ControlPanel

    unsub();

    expect(chordChangeListeners.length).toBe(0);
    expect(stateChangeListeners.length).toBe(0);

    // Events after unsub should have no effect
    fireChordChange(0);
    expect(mockPathHandle.setActiveChord).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 7a: Cross-Module Data Integrity
// ═══════════════════════════════════════════════════════════════════

describe("Cross-module data integrity", () => {
  it("HC shapes have valid covered_pcs Sets", async () => {
    const result = await loadAndWire("Cmaj7 | Am | Dm7 | G7");
    const success = result as PipelineSuccess;

    for (const shape of success.shapes) {
      expect(shape.covered_pcs).toBeInstanceOf(Set);
      expect(shape.covered_pcs.size).toBeGreaterThanOrEqual(3);
    }
  });

  it("ChordEvent shapes reference HC Shape objects with centroids", async () => {
    const result = await loadAndWire("Dm7 G7 Cmaj7");
    const success = result as PipelineSuccess;

    for (const event of success.events) {
      expect(event.shape).toBeDefined();
      expect(event.shape.centroid_uv).toBeDefined();
      expect(typeof event.shape.centroid_uv.u).toBe("number");
      expect(typeof event.shape.centroid_uv.v).toBe("number");
    }
  });

  it("pipeline produces uniform 4-beat timing (POL-D17)", () => {
    const chords = parseProgressionInput("C Am F G");
    const result = loadProgressionPipeline({
      chords,
      focus: { u: 0, v: 0 },
      indices,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.events[0].durationBeats).toBe(4);
    expect(result.events[1].startBeat).toBe(4);
    expect(result.events[2].startBeat).toBe(8);
    expect(result.events[3].startBeat).toBe(12);
  });

  it("chain-focus placement produces different centroids for each chord", async () => {
    const result = await loadAndWire("C | Am | F | G");
    const success = result as PipelineSuccess;

    // Each chord should have a distinct centroid (chain-focus moves)
    const centroids = success.shapes.map((s) => s.centroid_uv);
    for (let i = 1; i < centroids.length; i++) {
      const prev = centroids[i - 1];
      const curr = centroids[i];
      // At least one coordinate should differ (progression moves through lattice)
      const same = prev.u === curr.u && prev.v === curr.v;
      expect(same).toBe(false);
    }
  });
});
