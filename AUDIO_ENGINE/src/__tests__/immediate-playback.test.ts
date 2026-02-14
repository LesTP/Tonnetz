import { describe, it, expect, beforeEach } from "vitest";
import {
  createImmediatePlayback,
  playPitchClasses,
  playShape,
  stopAll,
  type ImmediatePlaybackState,
} from "../immediate-playback.js";
import { initAudio } from "../audio-context.js";
import type { AudioTransport } from "../types.js";
import type { Shape } from "harmony-core";
import {
  MockAudioContext,
  MockOscillatorNode,
  MockGainNode,
} from "./web-audio-mock.js";

// ── Helpers ──────────────────────────────────────────────────────────

async function makeTransport(): Promise<{
  transport: AudioTransport;
  mock: MockAudioContext;
}> {
  const transport = await initAudio({
    AudioContextClass: MockAudioContext as unknown as { new (): AudioContext },
  });
  const mock = transport.getContext() as unknown as MockAudioContext;
  return { transport, mock };
}

/** Spy on createOscillator to collect created oscillators. */
function spyOscillators(mock: MockAudioContext): MockOscillatorNode[] {
  const created: MockOscillatorNode[] = [];
  const orig = mock.createOscillator.bind(mock);
  mock.createOscillator = () => {
    const osc = orig();
    created.push(osc);
    return osc;
  };
  return created;
}

/** Spy on createGain to collect created gain nodes. */
function spyGains(mock: MockAudioContext): MockGainNode[] {
  const created: MockGainNode[] = [];
  const orig = mock.createGain.bind(mock);
  mock.createGain = () => {
    const g = orig();
    created.push(g);
    return g;
  };
  return created;
}

/** Minimal Shape stub for testing. */
function makeShape(pcs: number[]): Shape {
  return {
    kind: "chord",
    covered_pcs: new Set(pcs),
    label: "Test",
    root_pc: pcs[0] ?? 0,
    intervals: [],
    member_pcs: new Set(pcs),
    trichords: [],
  } as unknown as Shape;
}

// ── createImmediatePlayback ──────────────────────────────────────────

describe("createImmediatePlayback", () => {
  it("returns a state with master gain connected to destination", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    expect(state.masterGain).toBeDefined();
    expect(state.voices.size).toBe(0);
    expect(state.prevVoicing).toEqual([]);
  });

  it("master gain starts at 1", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    expect(state.masterGain.gain.value).toBe(1);
  });
});

// ── playPitchClasses ─────────────────────────────────────────────────

describe("playPitchClasses", () => {
  let transport: AudioTransport;
  let mock: MockAudioContext;
  let state: ImmediatePlaybackState;

  beforeEach(async () => {
    ({ transport, mock } = await makeTransport());
    state = createImmediatePlayback(transport);
  });

  it("creates audio nodes for each pitch class", () => {
    const oscs = spyOscillators(
      transport.getContext() as unknown as MockAudioContext,
    );
    playPitchClasses(state, [0, 4, 7]);
    expect(oscs.length).toBe(6);
  });

  it("tracks created voices in state", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.voices.size).toBe(3);
  });

  it("updates prevVoicing for subsequent voice-leading", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.prevVoicing).toHaveLength(3);
    for (const midi of state.prevVoicing) {
      expect([0, 4, 7]).toContain(midi % 12);
    }
  });

  it("releases previous voices when playing new chord", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.voices.size).toBe(3);
    playPitchClasses(state, [5, 9, 0]);
    expect(state.voices.size).toBe(3);
  });

  it("applies voice-count normalization to master gain", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.masterGain.gain.value).toBeCloseTo(1 / Math.sqrt(3), 3);
  });

  it("no-ops for empty pitch class array", () => {
    playPitchClasses(state, []);
    expect(state.voices.size).toBe(0);
    expect(state.prevVoicing).toEqual([]);
  });

  it("uses voice-leading from previous voicing on second call", () => {
    playPitchClasses(state, [0, 4, 7]);
    const firstVoicing = [...state.prevVoicing];
    playPitchClasses(state, [5, 9, 0]);
    const secondVoicing = state.prevVoicing;
    let totalMotion = 0;
    for (let i = 0; i < firstVoicing.length; i++) {
      totalMotion += Math.abs(secondVoicing[i] - firstVoicing[i]);
    }
    expect(totalMotion).toBeLessThanOrEqual(20);
  });
});

// ── playShape ────────────────────────────────────────────────────────

describe("playShape", () => {
  let transport: AudioTransport;
  let state: ImmediatePlaybackState;

  beforeEach(async () => {
    ({ transport } = await makeTransport());
    state = createImmediatePlayback(transport);
  });

  it("creates audio nodes from Shape.covered_pcs", () => {
    const oscs = spyOscillators(
      transport.getContext() as unknown as MockAudioContext,
    );
    const shape = makeShape([0, 4, 7]);
    playShape(state, shape);
    expect(oscs.length).toBe(6);
  });

  it("tracks voices correctly", () => {
    const shape = makeShape([0, 4, 7]);
    playShape(state, shape);
    expect(state.voices.size).toBe(3);
  });

  it("handles 7th chord shape (4 notes)", () => {
    const shape = makeShape([0, 4, 7, 11]);
    playShape(state, shape);
    expect(state.voices.size).toBe(4);
    expect(state.masterGain.gain.value).toBeCloseTo(0.5, 3);
  });

  it("updates prevVoicing for voice-leading continuity", () => {
    playShape(state, makeShape([0, 4, 7]));
    expect(state.prevVoicing).toHaveLength(3);
    playShape(state, makeShape([5, 9, 0]));
    expect(state.prevVoicing).toHaveLength(3);
  });
});

// ── stopAll ──────────────────────────────────────────────────────────

describe("stopAll", () => {
  let transport: AudioTransport;
  let state: ImmediatePlaybackState;

  beforeEach(async () => {
    ({ transport } = await makeTransport());
    state = createImmediatePlayback(transport);
  });

  it("clears all active voices", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.voices.size).toBe(3);
    stopAll(state);
    expect(state.voices.size).toBe(0);
  });

  it("resets prevVoicing", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.prevVoicing).toHaveLength(3);
    stopAll(state);
    expect(state.prevVoicing).toEqual([]);
  });

  it("resets master gain to 1", () => {
    playPitchClasses(state, [0, 4, 7]);
    expect(state.masterGain.gain.value).not.toBe(1);
    stopAll(state);
    expect(state.masterGain.gain.value).toBe(1);
  });

  it("is safe to call when no voices are active", () => {
    expect(() => stopAll(state)).not.toThrow();
    expect(state.voices.size).toBe(0);
  });

  it("is safe to call multiple times", () => {
    playPitchClasses(state, [0, 4, 7]);
    stopAll(state);
    expect(() => stopAll(state)).not.toThrow();
  });
});

// ── Duration option ──────────────────────────────────────────────────

describe("duration option", () => {
  it("schedules release after specified duration", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    playPitchClasses(state, [0, 4, 7], { duration: 2.0 });
    expect(state.voices.size).toBe(3);
  });

  it("does not auto-release when duration is not specified", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    playPitchClasses(state, [0, 4, 7]);
    expect(state.voices.size).toBe(3);
  });

  it("duration works with playShape", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    playShape(state, makeShape([0, 4, 7]), { duration: 1.5 });
    expect(state.voices.size).toBe(3);
  });
});

// ── Velocity option ──────────────────────────────────────────────────

describe("velocity option", () => {
  it("default velocity creates voices", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    playPitchClasses(state, [0, 4, 7]);
    expect(state.voices.size).toBe(3);
  });

  it("low velocity creates quieter voices", async () => {
    const { transport } = await makeTransport();
    const ctx = transport.getContext() as unknown as MockAudioContext;
    const gains = spyGains(ctx);
    const state = createImmediatePlayback(transport);

    playPitchClasses(state, [0], { velocity: 32 });
    const envelopeGains = gains.filter(
      (g) => g.gain.value !== 1 && g.gain.value !== 0.5,
    );
    expect(envelopeGains.length).toBeGreaterThan(0);
  });

  it("max velocity creates louder voices", async () => {
    const { transport } = await makeTransport();
    const ctx = transport.getContext() as unknown as MockAudioContext;
    const gains = spyGains(ctx);
    const state = createImmediatePlayback(transport);

    playPitchClasses(state, [0], { velocity: 127 });
    expect(gains.length).toBeGreaterThan(0);
  });

  it("velocity option passed through playShape", async () => {
    const { transport } = await makeTransport();
    const state = createImmediatePlayback(transport);
    expect(() =>
      playShape(state, makeShape([0, 4, 7]), { velocity: 64 }),
    ).not.toThrow();
    expect(state.voices.size).toBe(3);
  });
});
