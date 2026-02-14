import { describe, it, expect, vi } from "vitest";
import { initAudio } from "../audio-context.js";
import {
  MockAudioContext,
  MockSuspendedAudioContext,
} from "./web-audio-mock.js";
import type { ChordEvent } from "../types.js";
import type { Shape } from "harmony-core";

/** Helper: cast MockAudioContext class to the AudioContext constructor shape. */
const asMock = (Cls: typeof MockAudioContext) =>
  Cls as unknown as { new (): AudioContext };

/** Minimal stub Shape for transport control tests. */
const stubShape = {} as Shape;

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

  it("getTempo() returns default 120 BPM", async () => {
    const transport = await initAudio({
      AudioContextClass: asMock(MockAudioContext),
    });
    expect(transport.getTempo()).toBe(120);
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
    expect(state.tempo).toBe(120);
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
    expect(transport.getTempo()).toBe(120);
    transport.setTempo(-10);
    expect(transport.getTempo()).toBe(120);
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
