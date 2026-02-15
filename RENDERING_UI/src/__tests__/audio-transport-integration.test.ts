// @vitest-environment happy-dom

/**
 * Phase 4: Rendering/UI ↔ AudioTransport integration tests.
 *
 * Validates that RU components correctly consume/produce data compatible
 * with the AudioTransport contract. Simulates the integration module
 * wiring pattern (RU never imports AE directly).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Shape, Chord, TriRef, WindowBounds } from "harmony-core";
import { getTrianglePcs, getEdgeUnionPcs, parseChordSymbol, buildWindowIndices } from "harmony-core";
import { mapProgressionToShapes } from "harmony-core";
import type {
  AudioTransport,
  TransportState,
  PlaybackStateChange,
  ChordChangeEvent,
  ChordEvent,
} from "audio-engine";
import { shapesToChordEvents } from "audio-engine";
import { createUIStateController } from "../ui-state.js";
import type { UIStateController, UIStateChangeEvent } from "../ui-state.js";
import type { InteractionCallbacks } from "../interaction-controller.js";
import { createControlPanel } from "../control-panel.js";
import type { ControlPanel } from "../control-panel.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChord(rootPc: number): Chord {
  return {
    root_pc: rootPc,
    quality: "maj",
    extension: null,
    chord_pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12],
    main_triad_pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12] as [number, number, number],
  };
}

function makeShape(rootPc: number = 0): Shape {
  const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
  return {
    chord: makeChord(rootPc),
    main_tri: tri,
    ext_tris: [],
    dot_pcs: [],
    covered_pcs: new Set([rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]),
    root_vertex_index: 0,
    centroid_uv: { u: 0.33, v: 0.33 },
  };
}

function makeProgression(): Shape[] {
  return [makeShape(2), makeShape(7), makeShape(0)]; // Dm – G – C
}

/** Minimal AudioTransport mock satisfying the full interface. */
function createMockTransport(): AudioTransport & {
  _stateListeners: Set<(e: PlaybackStateChange) => void>;
  _chordListeners: Set<(e: ChordChangeEvent) => void>;
  _scheduled: ChordEvent[] | null;
  _playing: boolean;
  _tempo: number;
  _chordIndex: number;
  fireStateChange: (playing: boolean) => void;
  fireChordChange: (index: number, shape: Shape) => void;
} {
  const stateListeners = new Set<(e: PlaybackStateChange) => void>();
  const chordListeners = new Set<(e: ChordChangeEvent) => void>();
  let scheduled: ChordEvent[] | null = null;
  let playing = false;
  let tempo = 120;
  let chordIndex = -1;

  const mock = {
    _stateListeners: stateListeners,
    _chordListeners: chordListeners,
    _scheduled: scheduled,
    _playing: playing,
    _tempo: tempo,
    _chordIndex: chordIndex,

    // Time queries
    getTime: vi.fn(() => 0),
    getContext: vi.fn(() => ({}) as AudioContext),

    // State queries
    getState: vi.fn((): TransportState => ({
      playing: mock._playing,
      tempo: mock._tempo,
      currentChordIndex: mock._chordIndex,
      totalChords: mock._scheduled?.length ?? 0,
    })),
    isPlaying: vi.fn(() => mock._playing),
    getTempo: vi.fn(() => mock._tempo),
    getCurrentChordIndex: vi.fn(() => mock._chordIndex),

    // Playback control
    setTempo: vi.fn((bpm: number) => { mock._tempo = bpm; }),
    scheduleProgression: vi.fn((events: readonly ChordEvent[]) => {
      mock._scheduled = [...events];
    }),
    play: vi.fn(() => {
      mock._playing = true;
      mock.fireStateChange(true);
    }),
    stop: vi.fn(() => {
      mock._playing = false;
      mock._chordIndex = -1;
      mock.fireStateChange(false);
    }),
    pause: vi.fn(() => {
      mock._playing = false;
      mock.fireStateChange(false);
    }),
    cancelSchedule: vi.fn(() => {
      mock._scheduled = null;
      mock._playing = false;
      mock._chordIndex = -1;
    }),

    // Event subscriptions
    onStateChange: vi.fn((cb: (e: PlaybackStateChange) => void) => {
      stateListeners.add(cb);
      return () => { stateListeners.delete(cb); };
    }),
    onChordChange: vi.fn((cb: (e: ChordChangeEvent) => void) => {
      chordListeners.add(cb);
      return () => { chordListeners.delete(cb); };
    }),

    // Test helpers
    fireStateChange(isPlaying: boolean): void {
      mock._playing = isPlaying;
      const event: PlaybackStateChange = { playing: isPlaying, timestamp: 0 };
      for (const cb of stateListeners) cb(event);
    },
    fireChordChange(index: number, shape: Shape): void {
      mock._chordIndex = index;
      const event: ChordChangeEvent = { chordIndex: index, shape, timestamp: 0 };
      for (const cb of chordListeners) cb(event);
    },
  };

  return mock;
}

// ---------------------------------------------------------------------------
// 1. AudioTransport mock conformance
// ---------------------------------------------------------------------------

describe("AudioTransport mock — interface conformance", () => {
  it("satisfies all 14 AudioTransport methods", () => {
    const transport = createMockTransport();
    const required: (keyof AudioTransport)[] = [
      "getTime", "getContext",
      "getState", "isPlaying", "getTempo", "getCurrentChordIndex",
      "setTempo", "scheduleProgression", "play", "stop", "pause", "cancelSchedule",
      "onStateChange", "onChordChange",
    ];
    for (const method of required) {
      expect(typeof transport[method]).toBe("function");
    }
  });

  it("getState returns valid TransportState shape", () => {
    const transport = createMockTransport();
    const state = transport.getState();
    expect(state).toHaveProperty("playing");
    expect(state).toHaveProperty("tempo");
    expect(state).toHaveProperty("currentChordIndex");
    expect(state).toHaveProperty("totalChords");
  });

  it("onStateChange returns unsubscribe function", () => {
    const transport = createMockTransport();
    const unsub = transport.onStateChange(vi.fn());
    expect(typeof unsub).toBe("function");
    unsub();
    expect(transport._stateListeners.size).toBe(0);
  });

  it("onChordChange returns unsubscribe function", () => {
    const transport = createMockTransport();
    const unsub = transport.onChordChange(vi.fn());
    expect(typeof unsub).toBe("function");
    unsub();
    expect(transport._chordListeners.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. InteractionCallbacks → AE playPitchClasses type compatibility
// ---------------------------------------------------------------------------

describe("InteractionCallbacks → AE type compatibility", () => {
  it("onTriangleSelect pcs array is valid for playPitchClasses", () => {
    const receivedPcs: number[] = [];
    const callbacks: InteractionCallbacks = {
      onTriangleSelect: (_triId, pcs) => { receivedPcs.push(...pcs); },
    };

    // Simulate what interaction-controller does: getTrianglePcs → spread
    const pcs = getTrianglePcs({ orientation: "U", anchor: { u: 0, v: 0 } });
    callbacks.onTriangleSelect!("U0,0" as any, [...pcs]);

    expect(receivedPcs).toHaveLength(3);
    receivedPcs.forEach(pc => {
      expect(typeof pc).toBe("number");
      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThan(12);
    });
  });

  it("onEdgeSelect pcs array produces 4 pitch classes for 7th chords", () => {
    const receivedPcs: number[] = [];
    const callbacks: InteractionCallbacks = {
      onEdgeSelect: (_edgeId, _triIds, pcs) => { receivedPcs.push(...pcs); },
    };

    // Simulate edge union: 4 pitch classes from two adjacent triangles
    // We'll pass a synthetic 4-pc array (what getEdgeUnionPcs would return)
    const edgePcs = [0, 4, 7, 11]; // Cmaj7
    callbacks.onEdgeSelect!("e0" as any, ["U0,0" as any, "D0,0" as any], edgePcs);

    expect(receivedPcs).toHaveLength(4);
    receivedPcs.forEach(pc => {
      expect(typeof pc).toBe("number");
      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThan(12);
    });
  });

  it("onDragScrub pcs array is compatible with playPitchClasses", () => {
    const receivedPcs: number[] = [];
    const callbacks: InteractionCallbacks = {
      onDragScrub: (_triId, pcs) => { receivedPcs.push(...pcs); },
    };

    const pcs = getTrianglePcs({ orientation: "D", anchor: { u: 1, v: 1 } });
    callbacks.onDragScrub!("D1,1" as any, [...pcs]);

    expect(receivedPcs).toHaveLength(3);
    receivedPcs.forEach(pc => {
      expect(typeof pc).toBe("number");
    });
  });

  it("onPointerUp fires with no args — compatible with stopAll(state)", () => {
    let upFired = false;
    const callbacks: InteractionCallbacks = {
      onPointerUp: () => { upFired = true; },
    };

    callbacks.onPointerUp!();
    expect(upFired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. ControlPanel Play/Stop → transport wiring simulation
// ---------------------------------------------------------------------------

describe("ControlPanel → AudioTransport wiring", () => {
  let container: HTMLElement;
  let panel: ControlPanel;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    transport = createMockTransport();
  });

  it("Play button click calls transport.play()", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay: () => transport.play(),
      onStop: () => transport.stop(),
    });
    panel.setProgressionLoaded(true);

    const playBtn = container.querySelector('[data-testid="play-btn"]') as HTMLButtonElement;
    playBtn.click();

    expect(transport.play).toHaveBeenCalledTimes(1);

    panel.destroy();
    container.remove();
  });

  it("Stop button click calls transport.stop()", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay: () => transport.play(),
      onStop: () => transport.stop(),
    });
    panel.setProgressionLoaded(true);
    panel.setPlaybackRunning(true);

    const stopBtn = container.querySelector('[data-testid="stop-btn"]') as HTMLButtonElement;
    stopBtn.click();

    expect(transport.stop).toHaveBeenCalledTimes(1);

    panel.destroy();
    container.remove();
  });

  it("Play button disabled during playback prevents double-play", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay: () => transport.play(),
      onStop: () => transport.stop(),
    });
    panel.setProgressionLoaded(true);
    panel.setPlaybackRunning(true);

    const playBtn = container.querySelector('[data-testid="play-btn"]') as HTMLButtonElement;
    expect(playBtn.disabled).toBe(true);

    panel.destroy();
    container.remove();
  });
});

// ---------------------------------------------------------------------------
// 4. Transport onStateChange → UIStateController transitions
// ---------------------------------------------------------------------------

describe("AudioTransport events → UIStateController", () => {
  let uiState: UIStateController;
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    uiState = createUIStateController();
    transport = createMockTransport();
  });

  it("transport playing:true → uiState.startPlayback()", () => {
    // Load progression first (required for startPlayback)
    uiState.loadProgression(makeProgression());
    expect(uiState.getState()).toBe("progression-loaded");

    // Wire transport → UI (integration module pattern)
    transport.onStateChange((event) => {
      if (event.playing) {
        uiState.startPlayback();
      } else {
        uiState.stopPlayback();
      }
    });

    transport.fireStateChange(true);
    expect(uiState.getState()).toBe("playback-running");
  });

  it("transport playing:false → uiState.stopPlayback()", () => {
    uiState.loadProgression(makeProgression());
    uiState.startPlayback();
    expect(uiState.getState()).toBe("playback-running");

    transport.onStateChange((event) => {
      if (event.playing) {
        uiState.startPlayback();
      } else {
        uiState.stopPlayback();
      }
    });

    transport.fireStateChange(false);
    expect(uiState.getState()).toBe("progression-loaded");
  });

  it("transport events ignored when UI not in compatible state", () => {
    // idle state — startPlayback() should be no-op
    expect(uiState.getState()).toBe("idle");

    transport.onStateChange((event) => {
      if (event.playing) {
        uiState.startPlayback();
      }
    });

    transport.fireStateChange(true);
    expect(uiState.getState()).toBe("idle"); // unchanged
  });
});

// ---------------------------------------------------------------------------
// 5. Transport onChordChange → UI chord index tracking
// ---------------------------------------------------------------------------

describe("AudioTransport onChordChange → UI sync", () => {
  let transport: ReturnType<typeof createMockTransport>;

  it("chord change events deliver valid index + shape", () => {
    transport = createMockTransport();
    const shapes = makeProgression();
    const received: ChordChangeEvent[] = [];

    transport.onChordChange((event) => {
      received.push(event);
    });

    // Simulate playback chord progression
    transport.fireChordChange(0, shapes[0]);
    transport.fireChordChange(1, shapes[1]);
    transport.fireChordChange(2, shapes[2]);

    expect(received).toHaveLength(3);
    expect(received[0].chordIndex).toBe(0);
    expect(received[0].shape).toBe(shapes[0]);
    expect(received[1].chordIndex).toBe(1);
    expect(received[2].chordIndex).toBe(2);
  });

  it("chord change index matches transport state query", () => {
    transport = createMockTransport();
    const shapes = makeProgression();

    transport.fireChordChange(1, shapes[1]);

    expect(transport.getCurrentChordIndex()).toBe(1);
    expect(transport.getState().currentChordIndex).toBe(1);
  });

  it("unsubscribe stops chord change delivery", () => {
    transport = createMockTransport();
    const received: ChordChangeEvent[] = [];
    const unsub = transport.onChordChange((e) => received.push(e));

    transport.fireChordChange(0, makeShape());
    expect(received).toHaveLength(1);

    unsub();
    transport.fireChordChange(1, makeShape());
    expect(received).toHaveLength(1); // no new events
  });
});

// ---------------------------------------------------------------------------
// 6. Full round-trip: HC → RU UIState → AE Transport → RU update
// ---------------------------------------------------------------------------

describe("Full round-trip integration", () => {
  it("loadProgression → shapesToChordEvents → scheduleProgression → play → chordChange → UI update", () => {
    const transport = createMockTransport();
    const uiState = createUIStateController();
    const chordChanges: ChordChangeEvent[] = [];

    // Parse progression via HC (needs WindowIndices for placement)
    const bounds: WindowBounds = { uMin: -2, uMax: 4, vMin: -2, vMax: 4 };
    const indices = buildWindowIndices(bounds);
    const chords = ["Dm", "G", "C"].map(s => parseChordSymbol(s)!);
    expect(chords.every(c => c !== null)).toBe(true);

    const shapes = mapProgressionToShapes(chords, { u: 0, v: 0 }, indices);
    expect(shapes.length).toBe(3);

    // Step 1: RU loads progression
    uiState.loadProgression(shapes);
    expect(uiState.getState()).toBe("progression-loaded");

    // Step 2: Integration module converts shapes to chord events
    const events = shapesToChordEvents(shapes, 1);
    expect(events).toHaveLength(3);
    expect(events[0].startBeat).toBe(0);
    expect(events[1].startBeat).toBe(1);
    expect(events[2].startBeat).toBe(2);

    // Step 3: Schedule on transport
    transport.scheduleProgression(events);
    expect(transport.scheduleProgression).toHaveBeenCalledWith(events);
    expect(transport._scheduled).toHaveLength(3);

    // Step 4: Wire transport events → UI
    transport.onStateChange((e) => {
      if (e.playing) uiState.startPlayback();
      else uiState.stopPlayback();
    });
    transport.onChordChange((e) => chordChanges.push(e));

    // Step 5: Play
    transport.play();
    expect(uiState.getState()).toBe("playback-running");

    // Step 6: Chord changes fire during playback
    transport.fireChordChange(0, shapes[0]);
    transport.fireChordChange(1, shapes[1]);
    transport.fireChordChange(2, shapes[2]);
    expect(chordChanges).toHaveLength(3);
    expect(chordChanges[2].shape.covered_pcs).toEqual(shapes[2].covered_pcs);

    // Step 7: Stop
    transport.stop();
    expect(uiState.getState()).toBe("progression-loaded");
    expect(transport.getCurrentChordIndex()).toBe(-1);
  });

  it("interaction tap → pcs compatible with AE immediate playback", () => {
    // Simulate the integration module wiring:
    // InteractionCallbacks.onTriangleSelect → playPitchClasses(state, pcs)
    const playedPcs: number[][] = [];
    const stoppedCount = { value: 0 };

    // Mock what integration module does: wire RU callbacks to AE functions
    const callbacks: InteractionCallbacks = {
      onTriangleSelect: (_triId, pcs) => {
        playedPcs.push(pcs);
      },
      onEdgeSelect: (_edgeId, _triIds, pcs) => {
        playedPcs.push(pcs);
      },
      onPointerUp: () => {
        stoppedCount.value++;
      },
    };

    // Simulate triangle tap (3 pcs)
    const triPcs = getTrianglePcs({ orientation: "U", anchor: { u: 0, v: 0 } });
    callbacks.onTriangleSelect!("U0,0" as any, [...triPcs]);
    expect(playedPcs[0]).toHaveLength(3);

    // Simulate edge tap (4 pcs)
    callbacks.onEdgeSelect!("e" as any, ["U0,0" as any, "D0,0" as any], [0, 4, 7, 11]);
    expect(playedPcs[1]).toHaveLength(4);

    // Simulate pointer release
    callbacks.onPointerUp!();
    expect(stoppedCount.value).toBe(1);
  });

  it("progression preserved through play/stop cycle via transport", () => {
    const transport = createMockTransport();
    const uiState = createUIStateController();
    const shapes = makeProgression();

    uiState.loadProgression(shapes);

    transport.onStateChange((e) => {
      if (e.playing) uiState.startPlayback();
      else uiState.stopPlayback();
    });

    // Play → stop cycle
    transport.fireStateChange(true);
    expect(uiState.getState()).toBe("playback-running");

    transport.fireStateChange(false);
    expect(uiState.getState()).toBe("progression-loaded");
    expect(uiState.getProgression()).toBe(shapes); // preserved
  });
});
