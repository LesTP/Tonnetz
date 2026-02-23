import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initAudio } from "../audio-context.js";
import {
  MockAudioContext,
  MockSuspendedAudioContext,
} from "./web-audio-mock.js";
import { SCHEDULER_INTERVAL_MS } from "../scheduler.js";
import type { ChordEvent } from "../types.js";
import type { Shape } from "harmony-core";

/** Helper: cast MockAudioContext class to the AudioContext constructor shape. */
const asMock = (Cls: typeof MockAudioContext) =>
  Cls as unknown as { new (): AudioContext };

/** Minimal stub Shape for transport control tests. */
const stubShape = {
  covered_pcs: new Set([0, 4, 7]),
} as unknown as Shape;

function stubChordEvent(startBeat: number): ChordEvent {
  return { shape: stubShape, startBeat, durationBeats: 1 };
}

// ── DEVPLAN Phase 1b required tests ──────────────────────────────────

describe("initAudio — Phase 1b", () => {
  it("returns an AudioTransport object", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    expect(transport).toBeDefined();
    expect(typeof transport.getTime).toBe("function");
    expect(typeof transport.getContext).toBe("function");
    expect(typeof transport.getState).toBe("function");
    expect(typeof transport.isPlaying).toBe("function");
    expect(typeof transport.getTempo).toBe("function");
    expect(typeof transport.getCurrentChordIndex).toBe("function");
    expect(typeof transport.setTempo).toBe("function");
    expect(typeof transport.scheduleProgression).toBe("function");
    expect(typeof transport.play).toBe("function");
    expect(typeof transport.stop).toBe("function");
    expect(typeof transport.pause).toBe("function");
    expect(typeof transport.cancelSchedule).toBe("function");
    expect(typeof transport.onStateChange).toBe("function");
    expect(typeof transport.onChordChange).toBe("function");
  });

  it("getTime() returns a number >= 0", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    expect(transport.getTime()).toBeGreaterThanOrEqual(0);
  });

  it("getTime() reflects AudioContext.currentTime", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const ctx = transport.getContext() as unknown as MockAudioContext;
    ctx._currentTime = 1.5;
    expect(transport.getTime()).toBe(1.5);
  });

  it("getContext() returns the AudioContext instance", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const ctx = transport.getContext();
    expect(ctx).toBeDefined();
    expect(ctx.currentTime).toBeGreaterThanOrEqual(0);
    expect(ctx.destination).toBeDefined();
  });

  it("isPlaying() returns false initially", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    expect(transport.isPlaying()).toBe(false);
  });

  it("getTempo() returns default 150 BPM", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    expect(transport.getTempo()).toBe(150);
  });

  it("getTempo() returns custom initial tempo", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
      initialTempo: 90,
    });
    expect(transport.getTempo()).toBe(90);
  });

  it("getCurrentChordIndex() returns -1 initially", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    expect(transport.getCurrentChordIndex()).toBe(-1);
  });
});

// ── Suspended AudioContext handling ──────────────────────────────────

describe("initAudio — suspended context handling", () => {
  it("resumes a suspended AudioContext", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockSuspendedAudioContext),
    });
    const ctx = transport.getContext();
    expect(ctx.state).toBe("running");
  });

  it("does not call resume on an already running context", async () => {
    const resumeSpy = vi.fn().mockResolvedValue(undefined);
    class SpyContext extends MockAudioContext {
      override resume = resumeSpy;
    }
    await initAudio({ AudioContextClass: asMock(SpyContext) });
    expect(resumeSpy).not.toHaveBeenCalled();
  });
});

// ── getState() snapshot ──────────────────────────────────────────────

describe("getState()", () => {
  it("returns correct initial state snapshot", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const state = transport.getState();
    expect(state.playing).toBe(false);
    expect(state.tempo).toBe(150);
    expect(state.currentChordIndex).toBe(-1);
    expect(state.totalChords).toBe(0);
  });

  it("reflects totalChords after scheduleProgression", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.scheduleProgression([stubChordEvent(0), stubChordEvent(1)]);
    expect(transport.getState().totalChords).toBe(2);
  });
});

// ── setTempo() ───────────────────────────────────────────────────────

describe("setTempo()", () => {
  it("updates tempo", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.setTempo(140);
    expect(transport.getTempo()).toBe(140);
  });

  it("ignores zero or negative tempo", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.setTempo(0);
    expect(transport.getTempo()).toBe(150);
    transport.setTempo(-10);
    expect(transport.getTempo()).toBe(150);
  });
});

// ── Transport control stubs ──────────────────────────────────────────

describe("transport control (Phase 1b stubs)", () => {
  it("play() is no-op without scheduled progression", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.play();
    expect(transport.isPlaying()).toBe(false);
  });

  it("play() starts playback with scheduled progression", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(transport.isPlaying()).toBe(true);
    expect(transport.getCurrentChordIndex()).toBe(0);
  });

  it("play() is no-op if already playing", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    transport.onStateChange(cb);
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    transport.play();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("stop() resets to beginning", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    transport.stop();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentChordIndex()).toBe(-1);
  });

  it("stop() is no-op if not playing", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    transport.onStateChange(cb);
    transport.stop();
    expect(cb).not.toHaveBeenCalled();
  });

  it("pause() stops playback but preserves chord index", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.scheduleProgression([stubChordEvent(0), stubChordEvent(1)]);
    transport.play();
    transport.pause();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentChordIndex()).toBe(0);
  });

  it("cancelSchedule() clears progression and stops", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    transport.cancelSchedule();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.getCurrentChordIndex()).toBe(-1);
    expect(transport.getState().totalChords).toBe(0);
  });

  it("cancelSchedule() is silent if not playing", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    transport.onStateChange(cb);
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.cancelSchedule();
    expect(cb).not.toHaveBeenCalled();
    expect(transport.getState().totalChords).toBe(0);
  });
});

// ── Voice-leading state reset on stop (bug #2d) ─────────────────────

describe("stop() resets voice-leading state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stop() clears prevVoicing so replay starts with voiceInRegister", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    // Two different progressions with identical first chords
    const prog = [stubChordEvent(0), stubChordEvent(1)];
    transport.scheduleProgression(prog);
    transport.play();

    // Advance to schedule both chords (voice-leading builds state)
    mock._currentTime = 0.95;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Stop — prevVoicing should be cleared
    transport.stop();

    // Collect chord changes from a second play
    const chordChanges: number[] = [];
    transport.onChordChange((e) => chordChanges.push(e.chordIndex));

    // Re-play the same progression — first chord should start fresh
    mock._currentTime = 2.0;
    transport.play();

    // First chord (index 0) should fire
    expect(chordChanges).toContain(0);
    expect(transport.getCurrentChordIndex()).toBe(0);

    transport.stop();
  });

  it("pause() preserves prevVoicing for voice-leading continuity on resume", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    transport.scheduleProgression([
      stubChordEvent(0),
      stubChordEvent(1),
      stubChordEvent(2),
    ]);
    transport.play();

    // Advance into chord 1
    mock._currentTime = 0.55;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Pause — voicing should be preserved (not cleared)
    transport.pause();

    // Resume — voice-leading should continue from the paused voicing
    mock._currentTime = 0.7;
    transport.play();

    // Advance to chord 2 — it should voice-lead from chord 1's voicing
    // Pause captured ~1.1 beats. Resume at t=0.7, origin = 0.7 - 0.55 = 0.15.
    // Chord 2 starts at origin + beatsToSeconds(2, 120) = 0.15 + 1.0 = 1.15.
    mock._currentTime = 1.2;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(transport.getCurrentChordIndex()).toBe(2);

    transport.stop();
  });

  it("cancelSchedule() clears prevVoicing", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();

    // Advance to build voice-leading state
    mock._currentTime = 0.3;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    transport.cancelSchedule();

    // Schedule a new progression and play — should start fresh
    transport.scheduleProgression([stubChordEvent(0)]);
    mock._currentTime = 1.0;
    transport.play();
    expect(transport.getCurrentChordIndex()).toBe(0);

    transport.stop();
  });
});

// ── Pause/resume chord index correctness (bug #2c) ──────────────────

describe("pause/resume chord index", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves currentChordIndex across pause/resume", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    // 3 chords: each 1 beat at 120BPM = 0.5s each
    // chord 0: 0.0–0.5s, chord 1: 0.5–1.0s, chord 2: 1.0–1.5s
    transport.scheduleProgression([
      stubChordEvent(0),
      stubChordEvent(1),
      stubChordEvent(2),
    ]);
    transport.play();

    // Advance into chord 1 (t=0.55 is past chord 1 start at t=0.5)
    mock._currentTime = 0.55;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(transport.getCurrentChordIndex()).toBe(1);

    // Pause — chord index should be preserved
    transport.pause();
    expect(transport.getCurrentChordIndex()).toBe(1);

    // Resume — chord index must NOT reset to 0
    mock._currentTime = 0.7;
    transport.play();
    expect(transport.getCurrentChordIndex()).toBe(1);

    transport.stop();
  });

  it("resets currentChordIndex to 0 on fresh play (not resume)", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    transport.scheduleProgression([
      stubChordEvent(0),
      stubChordEvent(1),
    ]);
    transport.play();

    // Advance into chord 1 (t=0.55 is past chord 1 start at t=0.5)
    mock._currentTime = 0.55;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(transport.getCurrentChordIndex()).toBe(1);

    // Full stop — resets everything
    transport.stop();
    expect(transport.getCurrentChordIndex()).toBe(-1);

    // Fresh play — should start at chord 0
    mock._currentTime = 2.0;
    transport.play();
    expect(transport.getCurrentChordIndex()).toBe(0);

    transport.stop();
  });

  it("fires correct onChordChange after resume (no spurious index 0)", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    const chordChanges: number[] = [];
    transport.onChordChange((e) => chordChanges.push(e.chordIndex));

    transport.scheduleProgression([
      stubChordEvent(0),
      stubChordEvent(1),
      stubChordEvent(2),
    ]);
    transport.play();

    // Advance into chord 1 (t=0.55)
    mock._currentTime = 0.55;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Pause mid-playback at chord 1
    transport.pause();
    chordChanges.length = 0; // clear history

    // Resume — the scheduler resumes from the paused beat offset.
    // Since chord 0 and 1 are already in the past, the scheduler should
    // only fire chord change for chord 2 going forward.
    mock._currentTime = 1.5;
    transport.play();

    // Advance to trigger chord 2
    mock._currentTime = 1.6;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    // Chord 0 should not appear in post-resume changes
    expect(chordChanges).not.toContain(0);

    transport.stop();
  });
});

// ── Event subscriptions ──────────────────────────────────────────────

describe("event subscriptions", () => {
  it("onStateChange fires on play", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    transport.onStateChange(cb);
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ playing: true, timestamp: 0 }),
    );
  });

  it("onStateChange fires on stop", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    transport.onStateChange(cb);
    transport.stop();
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ playing: false }),
    );
  });

  it("unsubscribe removes listener", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    const unsub = transport.onStateChange(cb);
    unsub();
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(cb).not.toHaveBeenCalled();
  });

  it("multiple subscribers all receive events", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    transport.onStateChange(cb1);
    transport.onStateChange(cb2);
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("onChordChange subscription returns unsubscribe function", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const cb = vi.fn();
    const unsub = transport.onChordChange(cb);
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("state change timestamp reflects AudioContext.currentTime", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const ctx = transport.getContext() as unknown as MockAudioContext;
    ctx._currentTime = 2.5;
    const cb = vi.fn();
    transport.onStateChange(cb);
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: 2.5 }),
    );
  });
});

// ── Natural progression completion (bug #2b) ─────────────────────────

describe("natural progression completion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("transport transitions to not-playing when progression ends naturally", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    // Schedule a single 1-beat chord at 120 BPM (0.5s duration)
    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(transport.isPlaying()).toBe(true);

    // Advance past the end of the chord (0.5s) plus release tail (~0.55s)
    mock._currentTime = 1.1;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    expect(transport.isPlaying()).toBe(false);
  });

  it("fires onStateChange with playing=false when progression ends naturally", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    const stateChanges: boolean[] = [];
    transport.onStateChange((e) => stateChanges.push(e.playing));

    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(stateChanges).toEqual([true]);

    // Advance past the progression end + release tail
    mock._currentTime = 1.1;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    expect(stateChanges).toEqual([true, false]);
  });

  it("resets currentChordIndex to -1 when progression ends naturally", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();
    expect(transport.getCurrentChordIndex()).toBe(0);

    mock._currentTime = 1.1;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    expect(transport.getCurrentChordIndex()).toBe(-1);
  });

  it("getState() reflects completed state after natural end", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    transport.scheduleProgression([stubChordEvent(0), stubChordEvent(1)]);
    transport.play();

    // Advance past the end of both chords (beat 2 → 1.0s at 120BPM) + release tail
    mock._currentTime = 1.6;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);

    const state = transport.getState();
    expect(state.playing).toBe(false);
    expect(state.currentChordIndex).toBe(-1);
    expect(state.totalChords).toBe(2); // progression still loaded
  });

  it("can replay the progression after natural completion", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    const mock = transport.getContext() as unknown as MockAudioContext;
    mock._currentTime = 0;

    transport.scheduleProgression([stubChordEvent(0)]);
    transport.play();

    // Let it finish (past release tail)
    mock._currentTime = 1.1;
    vi.advanceTimersByTime(SCHEDULER_INTERVAL_MS);
    expect(transport.isPlaying()).toBe(false);

    // Replay
    mock._currentTime = 2.0;
    transport.play();
    expect(transport.isPlaying()).toBe(true);
    expect(transport.getCurrentChordIndex()).toBe(0);

    transport.stop();
  });
});
