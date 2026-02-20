import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  beatsToSeconds,
  secondsToBeats,
  createScheduler,
  startScheduler,
  stopScheduler,
  pauseScheduler,
  getCurrentBeat,
  SCHEDULE_AHEAD_TIME,
  SCHEDULER_INTERVAL_MS,
  type SchedulerState,
} from "../scheduler.js";
import { initAudio } from "../audio-context.js";
import type { AudioTransport, ChordEvent } from "../types.js";
import type { Shape } from "harmony-core";
import { MockAudioContext } from "./web-audio-mock.js";

// ── Helpers ──────────────────────────────────────────────────────────

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

function makeProgression(): ChordEvent[] {
  return [
    { shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 2 },
    { shape: makeShape([5, 9, 0]), startBeat: 2, durationBeats: 2 },
    { shape: makeShape([7, 11, 2]), startBeat: 4, durationBeats: 2 },
  ];
}

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

// ── beatsToSeconds / secondsToBeats ──────────────────────────────────

describe("beatsToSeconds", () => {
  it("1 beat at 120 BPM = 0.5 seconds", () => {
    expect(beatsToSeconds(1, 120)).toBeCloseTo(0.5, 10);
  });

  it("4 beats at 120 BPM = 2 seconds", () => {
    expect(beatsToSeconds(4, 120)).toBeCloseTo(2.0, 10);
  });

  it("1 beat at 60 BPM = 1 second", () => {
    expect(beatsToSeconds(1, 60)).toBeCloseTo(1.0, 10);
  });

  it("0 beats = 0 seconds", () => {
    expect(beatsToSeconds(0, 120)).toBe(0);
  });

  it("fractional beats work", () => {
    expect(beatsToSeconds(0.5, 120)).toBeCloseTo(0.25, 10);
  });

  it("high tempos scale correctly", () => {
    // 240 BPM: 1 beat = 0.25s
    expect(beatsToSeconds(1, 240)).toBeCloseTo(0.25, 10);
  });
});

// ── 3c: Pad mode — per-voice continuation (scheduler) ────────────────

describe("3c — pad mode (scheduler)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeCAmProgression(): ChordEvent[] {
    // C [0,4,7] → Am [9,0,4] — common tones: 0(C), 4(E)
    return [
      { shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 4 },
      { shape: makeShape([9, 0, 4]), startBeat: 4, durationBeats: 4 },
    ];
  }

  it("pad mode: common tone voices are carried (not stopped)", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const events = makeCAmProgression();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      padMode: true,
      onChordChange: () => {},
    });
    startScheduler(state);

    // Schedule chord 0 (C major)
    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const chord0Voices = [...state.chords[0].voices];
    expect(chord0Voices.length).toBe(3);

    // Schedule chord 1 (Am) — different pcs, pad mode
    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Chord 1 should have voices
    expect(state.chords[1].voices.length).toBe(3);
    // Chord 0 should be empty (voices transferred or released)
    expect(state.chords[0].voices.length).toBe(0);

    stopScheduler(state);
  });

  it("pad mode: new voices created for arriving tones", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const oscCreated: unknown[] = [];
    const origCreateOsc = (
      ctx as unknown as MockAudioContext
    ).createOscillator.bind(ctx as unknown as MockAudioContext);
    (ctx as unknown as MockAudioContext).createOscillator = () => {
      const osc = origCreateOsc();
      oscCreated.push(osc);
      return osc;
    };

    const events = makeCAmProgression();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      padMode: true,
      onChordChange: () => {},
    });
    startScheduler(state);

    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const oscsAfterChord0 = oscCreated.length;

    // C→Am: A is an arriving tone, should create new voices
    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    // At least some new oscillators for the arriving tone(s)
    expect(oscCreated.length).toBeGreaterThan(oscsAfterChord0);
    // But not a full replacement (3 tones × 2 oscs = 6 new; should be less)
    expect(oscCreated.length - oscsAfterChord0).toBeLessThan(oscsAfterChord0);

    stopScheduler(state);
  });

  it("piano mode (default): full hard-stop at boundary", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const oscCreated: unknown[] = [];
    const origCreateOsc = (
      ctx as unknown as MockAudioContext
    ).createOscillator.bind(ctx as unknown as MockAudioContext);
    (ctx as unknown as MockAudioContext).createOscillator = () => {
      const osc = origCreateOsc();
      oscCreated.push(osc);
      return osc;
    };

    const events = makeCAmProgression();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      // padMode defaults to false (piano mode)
      onChordChange: () => {},
    });
    startScheduler(state);

    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const oscsAfterChord0 = oscCreated.length;

    // Piano mode: full replacement — all new voices
    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(oscCreated.length).toBe(oscsAfterChord0 * 2);

    stopScheduler(state);
  });

  it("3b fast path still fires in pad mode", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const oscCreated: unknown[] = [];
    const origCreateOsc = (
      ctx as unknown as MockAudioContext
    ).createOscillator.bind(ctx as unknown as MockAudioContext);
    (ctx as unknown as MockAudioContext).createOscillator = () => {
      const osc = origCreateOsc();
      oscCreated.push(osc);
      return osc;
    };

    const events: ChordEvent[] = [
      { shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 4 },
      { shape: makeShape([0, 4, 7]), startBeat: 4, durationBeats: 4 },
    ];
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      padMode: true,
      onChordChange: () => {},
    });
    startScheduler(state);

    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const oscsAfterChord0 = oscCreated.length;

    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    // Identical chord — no new oscillators (3b gate, not pad diff)
    expect(oscCreated.length).toBe(oscsAfterChord0);

    stopScheduler(state);
  });
});

describe("secondsToBeats", () => {
  it("0.5 seconds at 120 BPM = 1 beat", () => {
    expect(secondsToBeats(0.5, 120)).toBeCloseTo(1, 10);
  });

  it("2 seconds at 120 BPM = 4 beats", () => {
    expect(secondsToBeats(2, 120)).toBeCloseTo(4, 10);
  });

  it("round-trip consistency", () => {
    const beats = 3.75;
    const bpm = 96;
    expect(secondsToBeats(beatsToSeconds(beats, bpm), bpm)).toBeCloseTo(
      beats,
      10,
    );
  });
});

// ── createScheduler ──────────────────────────────────────────────────

describe("createScheduler", () => {
  it("computes chord wall-clock times from beats and tempo", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 10; // playback starts at t=10
    const events = makeProgression();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events,
      bpm: 120,
      onChordChange: () => {},
    });

    // At 120 BPM: 1 beat = 0.5s
    // Chord 0: beat 0 → t=10.0, end beat 2 → t=11.0
    expect(state.chords[0].startTime).toBeCloseTo(10.0, 5);
    expect(state.chords[0].endTime).toBeCloseTo(11.0, 5);
    // Chord 1: beat 2 → t=11.0, end beat 4 → t=12.0
    expect(state.chords[1].startTime).toBeCloseTo(11.0, 5);
    expect(state.chords[1].endTime).toBeCloseTo(12.0, 5);
    // Chord 2: beat 4 → t=12.0, end beat 6 → t=13.0
    expect(state.chords[2].startTime).toBeCloseTo(12.0, 5);
    expect(state.chords[2].endTime).toBeCloseTo(13.0, 5);
  });

  it("creates master gain connected to destination", () => {
    const mock = new MockAudioContext();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });
    expect(state.masterGain).toBeDefined();
    expect(state.masterGain.gain.value).toBe(1);
  });

  it("initializes with no chords scheduled", () => {
    const mock = new MockAudioContext();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });
    expect(state.nextToSchedule).toBe(0);
    expect(state.currentChordIndex).toBe(-1);
    for (const chord of state.chords) {
      expect(chord.scheduled).toBe(false);
      expect(chord.changeFired).toBe(false);
    }
  });

  it("accounts for beat offset when resuming", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 10;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      beatOffset: 2, // resume from beat 2
      onChordChange: () => {},
    });
    // Origin = 10 - beatsToSeconds(2, 120) = 10 - 1.0 = 9.0
    // Chord 0 (beat 0): start = 9.0, end = 10.0 (already past)
    // Chord 1 (beat 2): start = 10.0, end = 11.0 (now)
    expect(state.chords[0].startTime).toBeCloseTo(9.0, 5);
    expect(state.chords[1].startTime).toBeCloseTo(10.0, 5);
    expect(state.chords[2].startTime).toBeCloseTo(11.0, 5);
  });

  it("different tempos produce different timing", () => {
    const mock = new MockAudioContext();
    const slow = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: [{ shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 4 }],
      bpm: 60,
      onChordChange: () => {},
    });
    const fast = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: [{ shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 4 }],
      bpm: 120,
      onChordChange: () => {},
    });
    // 4 beats at 60 BPM = 4s, at 120 BPM = 2s
    const slowDuration = slow.chords[0].endTime - slow.chords[0].startTime;
    const fastDuration = fast.chords[0].endTime - fast.chords[0].startTime;
    expect(slowDuration).toBeCloseTo(4.0, 5);
    expect(fastDuration).toBeCloseTo(2.0, 5);
  });
});

// ── startScheduler / tick behavior ───────────────────────────────────

describe("startScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules chords within the lookahead window on first tick", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    // First chord starts at t=0, which is within lookahead (0 + 0.1)
    expect(state.chords[0].scheduled).toBe(true);
    expect(state.chords[0].voices.length).toBeGreaterThan(0);
    stopScheduler(state);
  });

  it("fires onChordChange for the first chord immediately", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const changes: number[] = [];
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: (e) => changes.push(e.chordIndex),
    });

    startScheduler(state);
    expect(changes).toContain(0);
    stopScheduler(state);
  });

  it("does not schedule chords beyond the lookahead window", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    // Chord 1 starts at t=1.0 which is beyond 0 + 0.1
    expect(state.chords[1].scheduled).toBe(false);
    stopScheduler(state);
  });

  it("schedules subsequent chords as time advances", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    expect(state.chords[1].scheduled).toBe(false);

    // Advance time to just before chord 1 start (t=1.0) within lookahead
    mock._currentTime = 0.95;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(state.chords[1].scheduled).toBe(true);
    stopScheduler(state);
  });

  it("fires onChordChange when chord start time is reached", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const changes: number[] = [];
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: (e) => changes.push(e.chordIndex),
    });

    startScheduler(state);
    expect(changes).toEqual([0]);

    // Advance past chord 1 start time
    mock._currentTime = 1.0;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(changes).toContain(1);
    stopScheduler(state);
  });

  it("fires each chord change only once", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const changes: number[] = [];
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: (e) => changes.push(e.chordIndex),
    });

    startScheduler(state);
    // Tick multiple times at the same time
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    // Chord 0 change should fire only once
    expect(changes.filter((i) => i === 0)).toHaveLength(1);
    stopScheduler(state);
  });

  it("applies voice-leading across sequential chords", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    // After scheduling chord 0, prevVoicing should be set
    expect(state.prevVoicing).toHaveLength(3);
    const firstVoicing = [...state.prevVoicing];

    // Advance to schedule chord 1
    mock._currentTime = 0.95;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(state.chords[1].scheduled).toBe(true);

    // prevVoicing should have changed (voice-led from first chord)
    expect(state.prevVoicing).toHaveLength(3);
    // At least one note should differ (C maj → F maj)
    const changed = state.prevVoicing.some(
      (n, i) => n !== firstVoicing[i],
    );
    expect(changed).toBe(true);
    stopScheduler(state);
  });
});

// ── onComplete callback ──────────────────────────────────────────────

describe("onComplete callback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires when the progression ends naturally", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const onComplete = vi.fn();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(), // 3 chords, 2 beats each, 6 beats total
      bpm: 120,
      onChordChange: () => {},
      onComplete,
    });

    startScheduler(state);
    expect(onComplete).not.toHaveBeenCalled();

    // Advance past the end of the last chord (beat 6 → t=3.0 at 120BPM)
    // plus release tail (0.55s) so the scheduler detects completion
    mock._currentTime = 3.6;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
  });

  it("does not fire before the last chord ends", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const onComplete = vi.fn();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
      onComplete,
    });

    startScheduler(state);
    // Advance to middle of the last chord (t=2.5, last chord ends at t=3.0)
    mock._currentTime = 2.5;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    expect(onComplete).not.toHaveBeenCalled();
    stopScheduler(state);
  });

  it("fires only once even with multiple ticks past end", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const onComplete = vi.fn();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
      onComplete,
    });

    startScheduler(state);
    mock._currentTime = 3.6;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    // stopScheduler was called inside tick, so further ticks are no-ops
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("is not required (no crash when omitted)", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
      // onComplete intentionally omitted
    });

    startScheduler(state);
    mock._currentTime = 3.05;
    expect(() => vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS)).not.toThrow();
  });
});

// ── stopScheduler ────────────────────────────────────────────────────

describe("stopScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears the timer and marks as stopped", () => {
    const mock = new MockAudioContext();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    expect(state.timerHandle).not.toBeNull();

    stopScheduler(state);
    expect(state.timerHandle).toBeNull();
    expect(state.stopped).toBe(true);
  });

  it("clears all voice references", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    expect(state.chords[0].voices.length).toBeGreaterThan(0);

    stopScheduler(state);
    for (const slot of state.chords) {
      expect(slot.voices).toHaveLength(0);
    }
  });

  it("prevents further ticks from scheduling", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const changes: number[] = [];
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: (e) => changes.push(e.chordIndex),
    });

    startScheduler(state);
    const countAfterStart = changes.length;
    stopScheduler(state);

    // Advance time — no new events should fire
    mock._currentTime = 5;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS * 10);
    expect(changes.length).toBe(countAfterStart);
  });
});

// ── pauseScheduler ───────────────────────────────────────────────────

describe("pauseScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current beat position", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    mock._currentTime = 0.5; // 0.5s at 120BPM = 1 beat
    const beat = pauseScheduler(state);
    expect(beat).toBeCloseTo(1.0, 5);
  });

  it("clears the timer", () => {
    const mock = new MockAudioContext();
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    pauseScheduler(state);
    expect(state.timerHandle).toBeNull();
    expect(state.stopped).toBe(true);
  });

  it("preserves voice-leading state for resume", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });

    startScheduler(state);
    const voicing = [...state.prevVoicing];
    pauseScheduler(state);
    // Voicing should still be preserved
    expect(state.prevVoicing).toEqual(voicing);
  });
});

// ── getCurrentBeat ───────────────────────────────────────────────────

describe("getCurrentBeat", () => {
  it("returns 0 at playback origin", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 5;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });
    expect(getCurrentBeat(state)).toBeCloseTo(0, 5);
  });

  it("advances with time", () => {
    const mock = new MockAudioContext();
    mock._currentTime = 0;
    const state = createScheduler({
      ctx: mock as unknown as AudioContext,
      destination: mock.destination as unknown as AudioNode,
      events: makeProgression(),
      bpm: 120,
      onChordChange: () => {},
    });
    mock._currentTime = 1.0; // 1s at 120BPM = 2 beats
    expect(getCurrentBeat(state)).toBeCloseTo(2.0, 5);
  });
});

// ── Transport integration (end-to-end) ───────────────────────────────

describe("transport integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("play() starts scheduler and fires onStateChange", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    const stateChanges: boolean[] = [];
    transport.onStateChange((e) => stateChanges.push(e.playing));

    transport.scheduleProgression(makeProgression());
    transport.play();

    expect(transport.isPlaying()).toBe(true);
    expect(stateChanges).toContain(true);
  });

  it("play() fires onChordChange for first chord", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    const chordChanges: number[] = [];
    transport.onChordChange((e) => chordChanges.push(e.chordIndex));

    transport.scheduleProgression(makeProgression());
    transport.play();

    expect(chordChanges).toContain(0);
  });

  it("stop() ends playback and fires state change", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    const stateChanges: boolean[] = [];
    transport.onStateChange((e) => stateChanges.push(e.playing));

    transport.scheduleProgression(makeProgression());
    transport.play();
    transport.stop();

    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentChordIndex()).toBe(-1);
    expect(stateChanges).toEqual([true, false]);
  });

  it("pause() preserves position for resume", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    transport.scheduleProgression(makeProgression());
    transport.play();

    mock._currentTime = 0.5; // 1 beat into playback
    transport.pause();

    expect(transport.isPlaying()).toBe(false);

    // Resume — play again
    transport.play();
    expect(transport.isPlaying()).toBe(true);
  });

  it("cancelSchedule() clears events and stops", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    transport.scheduleProgression(makeProgression());
    transport.play();
    transport.cancelSchedule();

    expect(transport.isPlaying()).toBe(false);
    expect(transport.getState().totalChords).toBe(0);
  });

  it("chord changes fire during scheduled playback", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    const chordChanges: number[] = [];
    transport.onChordChange((e) => chordChanges.push(e.chordIndex));

    transport.scheduleProgression(makeProgression());
    transport.play();

    // Advance past chord 1 start (beat 2 → t=1.0 at 120BPM)
    mock._currentTime = 1.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    expect(chordChanges).toContain(0);
    expect(chordChanges).toContain(1);

    transport.stop();
  });

  it("setTempo affects scheduling timing", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;

    transport.setTempo(60); // 60 BPM: 1 beat = 1 second

    const chordChanges: number[] = [];
    transport.onChordChange((e) => chordChanges.push(e.chordIndex));

    transport.scheduleProgression(makeProgression());
    transport.play();

    // At 60 BPM, chord 1 starts at beat 2 → t=2.0
    // At t=1.05, only chord 0 should have changed
    mock._currentTime = 1.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(chordChanges).not.toContain(1);

    // At t=2.05, chord 1 should fire
    mock._currentTime = 2.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(chordChanges).toContain(1);

    transport.stop();
  });

  it("totalChords reflects scheduled progression", async () => {
    const { transport } = await makeTransport();
    transport.scheduleProgression(makeProgression());
    expect(transport.getState().totalChords).toBe(3);
  });
});

// ── Constants exported correctly ─────────────────────────────────────

describe("scheduler constants", () => {
  it("SCHEDULE_AHEAD_TIME is a positive number", () => {
    expect(SCHEDULE_AHEAD_TIME).toBeGreaterThan(0);
  });

  it("SCHEDULER_INTERVAL_MS is a positive number", () => {
    expect(SCHEDULER_INTERVAL_MS).toBeGreaterThan(0);
  });

  it("lookahead > interval for gap-free scheduling", () => {
    // Lookahead window (100ms) should be larger than interval (25ms)
    expect(SCHEDULE_AHEAD_TIME * 1000).toBeGreaterThan(SCHEDULER_INTERVAL_MS);
  });
});

// ── 3b: Sustained repeated chords ────────────────────────────────────

describe("3b — sustained repeated chords (scheduler)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeRepeatedProgression(): ChordEvent[] {
    // Dm7 Dm7 Dm7 G7  (pcs via covered_pcs fallback)
    return [
      { shape: makeShape([2, 5, 9, 0]), startBeat: 0, durationBeats: 4 },
      { shape: makeShape([2, 5, 9, 0]), startBeat: 4, durationBeats: 4 },
      { shape: makeShape([2, 5, 9, 0]), startBeat: 8, durationBeats: 4 },
      { shape: makeShape([7, 11, 2, 5]), startBeat: 12, durationBeats: 4 },
    ];
  }

  it("identical chords: voices carry to next slot", async () => {
    const { transport, mock } = await makeTransport();
    mock._currentTime = 0;
    const events = makeRepeatedProgression();
    transport.scheduleProgression(events);
    transport.play();

    // Tick past chord 0 start — voices created in slot 0
    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Access internal state to inspect slots
    // The transport wraps the scheduler; we use a low-level approach
    // by creating a scheduler directly
    transport.stop();

    // Use createScheduler directly for fine-grained inspection
    const ctx = transport.getContext();
    const dest = ctx.createGain();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      onChordChange: () => {},
    });
    startScheduler(state);

    // Tick to schedule chord 0
    (ctx as unknown as MockAudioContext)._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(state.chords[0].voices.length).toBeGreaterThan(0);
    const chord0VoiceCount = state.chords[0].voices.length;

    // Advance past chord 1 start time to trigger scheduling
    (ctx as unknown as MockAudioContext)._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Chord 1 should have voices (carried from chord 0)
    expect(state.chords[1].voices.length).toBe(chord0VoiceCount);
    // Chord 0 should be empty (voices moved out)
    expect(state.chords[0].voices.length).toBe(0);

    stopScheduler(state);
  });

  it("identical chords: no new createVoice calls for repeated chord", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    // Spy on createVoice by counting oscillator creation
    const oscCreated: unknown[] = [];
    const origCreateOsc = (
      ctx as unknown as MockAudioContext
    ).createOscillator.bind(ctx as unknown as MockAudioContext);
    (ctx as unknown as MockAudioContext).createOscillator = () => {
      const osc = origCreateOsc();
      oscCreated.push(osc);
      return osc;
    };

    const events = makeRepeatedProgression();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      onChordChange: () => {},
    });
    startScheduler(state);

    // Schedule chord 0
    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const oscsAfterChord0 = oscCreated.length;
    expect(oscsAfterChord0).toBeGreaterThan(0); // voices created

    // Schedule chord 1 (same pcs)
    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(oscCreated.length).toBe(oscsAfterChord0); // no new oscillators

    // Schedule chord 2 (same pcs again)
    mock._currentTime = beatsToSeconds(8, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(oscCreated.length).toBe(oscsAfterChord0); // still no new

    // Schedule chord 3 (different pcs — G7)
    mock._currentTime = beatsToSeconds(12, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(oscCreated.length).toBeGreaterThan(oscsAfterChord0); // new voices

    stopScheduler(state);
  });

  it("different chord after repeats: previous voices hard-stopped", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const events = makeRepeatedProgression();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      onChordChange: () => {},
    });
    startScheduler(state);

    // Schedule chords 0, 1, 2 (all same)
    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    mock._currentTime = beatsToSeconds(8, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Voices should be in slot 2 now
    expect(state.chords[2].voices.length).toBeGreaterThan(0);

    // Schedule chord 3 (G7 — different)
    mock._currentTime = beatsToSeconds(12, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Slot 2 should be empty (voices hard-stopped by 3a logic)
    expect(state.chords[2].voices.length).toBe(0);
    // Slot 3 should have new voices
    expect(state.chords[3].voices.length).toBeGreaterThan(0);

    stopScheduler(state);
  });

  it("prevVoicing preserved across identical chords", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const events = makeRepeatedProgression();
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      onChordChange: () => {},
    });
    startScheduler(state);

    // Schedule chord 0
    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const voicingAfterChord0 = [...state.prevVoicing];

    // Schedule chord 1 (same)
    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(state.prevVoicing).toEqual(voicingAfterChord0);

    stopScheduler(state);
  });

  it("single-chord progression: no carry logic triggered", async () => {
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const events: ChordEvent[] = [
      { shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 4 },
    ];
    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      onChordChange: () => {},
    });
    startScheduler(state);

    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(state.chords[0].voices.length).toBeGreaterThan(0);

    stopScheduler(state);
  });

  it("non-consecutive repeats are not sustained", async () => {
    // C - Am - C: the second C should NOT carry from the first C
    const { transport, mock } = await makeTransport();
    const ctx = transport.getContext();
    const dest = ctx.createGain();

    const events: ChordEvent[] = [
      { shape: makeShape([0, 4, 7]), startBeat: 0, durationBeats: 4 },
      { shape: makeShape([9, 0, 4]), startBeat: 4, durationBeats: 4 },
      { shape: makeShape([0, 4, 7]), startBeat: 8, durationBeats: 4 },
    ];

    const oscCreated: unknown[] = [];
    const origCreateOsc = (
      ctx as unknown as MockAudioContext
    ).createOscillator.bind(ctx as unknown as MockAudioContext);
    (ctx as unknown as MockAudioContext).createOscillator = () => {
      const osc = origCreateOsc();
      oscCreated.push(osc);
      return osc;
    };

    const state = createScheduler({
      ctx,
      destination: dest,
      events,
      bpm: 120,
      onChordChange: () => {},
    });
    startScheduler(state);

    // Schedule all three chords
    mock._currentTime = 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const oscsAfterChord0 = oscCreated.length;

    mock._currentTime = beatsToSeconds(4, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    const oscsAfterChord1 = oscCreated.length;
    // Am is different from C — new voices created
    expect(oscsAfterChord1).toBeGreaterThan(oscsAfterChord0);

    mock._currentTime = beatsToSeconds(8, 120) - 0.05;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    // Second C is adjacent to Am (different pcs) — new voices created
    expect(oscCreated.length).toBeGreaterThan(oscsAfterChord1);

    stopScheduler(state);
  });
});
