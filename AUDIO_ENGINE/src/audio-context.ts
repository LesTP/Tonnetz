/**
 * AudioContext initialization and AudioTransport factory.
 *
 * initAudioSync() creates an AudioContext synchronously and calls resume()
 * within the same call stack — required for iOS Safari autoplay policy.
 * initAudio() is an async wrapper that awaits the resume() promise for
 * callers that need the fully-resolved context (tests, non-gesture paths).
 *
 * Phase 1b: Time/state queries fully implemented.
 * Phase 2: Transport control methods connected to the scheduler engine.
 * Phase 4d-1: Synchronous init for iOS Safari compatibility (POL-D28).
 */

import type {
  AudioTransport,
  ChordChangeEvent,
  ChordEvent,
  InitAudioOptions,
  PlaybackStateChange,
  TransportState,
} from "./types.js";
import {
  createScheduler,
  startScheduler,
  stopScheduler,
  pauseScheduler,
  type SchedulerState,
} from "./scheduler.js";
import type { SynthPreset } from "./presets.js";
import { PRESET_CLASSIC } from "./presets.js";

const DEFAULT_TEMPO = 150;

/**
 * Build an AudioTransport from an already-created AudioContext.
 * Pure factory — no async, no resume. Used by both initAudioSync and initAudio.
 */
function buildTransport(ctx: AudioContext, initialTempo?: number): AudioTransport {
  let tempo = initialTempo ?? DEFAULT_TEMPO;
  let playing = false;
  let currentChordIndex = -1;
  let scheduledEvents: readonly ChordEvent[] = [];
  let pausedBeatOffset = 0;
  let scheduler: SchedulerState | null = null;
  let prevVoicing: number[] = [];
  let padMode = false;
  let loop = false;
  let preset: SynthPreset = PRESET_CLASSIC;

  const stateListeners = new Set<(e: PlaybackStateChange) => void>();
  const chordListeners = new Set<(e: ChordChangeEvent) => void>();

  function emitStateChange(): void {
    const event: PlaybackStateChange = {
      playing,
      timestamp: ctx.currentTime,
    };
    for (const cb of stateListeners) {
      cb(event);
    }
  }

  function emitChordChange(event: ChordChangeEvent): void {
    currentChordIndex = event.chordIndex;
    for (const cb of chordListeners) {
      cb(event);
    }
  }

  function cleanupScheduler(): void {
    if (scheduler) {
      stopScheduler(scheduler);
      prevVoicing = scheduler.prevVoicing;
      scheduler = null;
    }
  }

  const transport: AudioTransport = {
    getTime(): number {
      return ctx.currentTime;
    },

    getContext(): AudioContext {
      return ctx;
    },

    getState(): TransportState {
      return {
        playing,
        tempo,
        currentChordIndex,
        totalChords: scheduledEvents.length,
      };
    },

    isPlaying(): boolean {
      return playing;
    },

    getTempo(): number {
      return tempo;
    },

    getCurrentChordIndex(): number {
      return currentChordIndex;
    },

    setTempo(bpm: number): void {
      if (bpm <= 0) return;
      tempo = bpm;
    },

    scheduleProgression(events: readonly ChordEvent[]): void {
      scheduledEvents = events;
    },

    play(): void {
      if (scheduledEvents.length === 0) return;
      if (playing) return;
      playing = true;
      if (pausedBeatOffset === 0) {
        currentChordIndex = 0;
      }

      scheduler = createScheduler({
        ctx,
        destination: ctx.destination,
        events: scheduledEvents,
        bpm: tempo,
        beatOffset: pausedBeatOffset,
        prevVoicing,
        padMode,
        loop,
        preset,
        onChordChange: emitChordChange,
        onComplete() {
          playing = false;
          currentChordIndex = -1;
          pausedBeatOffset = 0;
          scheduler = null;
          emitStateChange();
        },
      });
      startScheduler(scheduler);

      emitStateChange();
    },

    stop(): void {
      if (!playing) return;
      playing = false;
      currentChordIndex = -1;
      pausedBeatOffset = 0;
      cleanupScheduler();
      prevVoicing = [];
      emitStateChange();
    },

    pause(): void {
      if (!playing) return;
      playing = false;
      if (scheduler) {
        pausedBeatOffset = pauseScheduler(scheduler);
        prevVoicing = scheduler.prevVoicing;
        scheduler = null;
      }
      emitStateChange();
    },

    cancelSchedule(): void {
      const wasPlaying = playing;
      playing = false;
      currentChordIndex = -1;
      pausedBeatOffset = 0;
      cleanupScheduler();
      prevVoicing = [];
      scheduledEvents = [];
      if (wasPlaying) {
        emitStateChange();
      }
    },

    setPadMode(enabled: boolean): void {
      padMode = enabled;
    },

    getPadMode(): boolean {
      return padMode;
    },

    setLoop(enabled: boolean): void {
      loop = enabled;
    },

    getLoop(): boolean {
      return loop;
    },

    setPreset(p: SynthPreset): void {
      preset = p;
    },

    getPreset(): SynthPreset {
      return preset;
    },

    onStateChange(callback: (event: PlaybackStateChange) => void): () => void {
      stateListeners.add(callback);
      return () => {
        stateListeners.delete(callback);
      };
    },

    onChordChange(callback: (event: ChordChangeEvent) => void): () => void {
      chordListeners.add(callback);
      return () => {
        chordListeners.delete(callback);
      };
    },
  };

  return transport;
}

/**
 * Initialize the audio system synchronously (Phase 4d-1).
 *
 * Creates an AudioContext and calls resume() in the same synchronous call
 * stack. On iOS Safari, this is required — resume() must be called within
 * the user gesture handler. The resume() Promise is fire-and-forget; the
 * context transitions to "running" before the next audio buffer renders.
 *
 * @param options - Optional configuration. Tests inject MockAudioContext
 *   via options.AudioContextClass.
 * @returns AudioTransport instance (synchronous — no Promise)
 */
export function initAudioSync(
  options?: InitAudioOptions,
): AudioTransport {
  const Ctor = options?.AudioContextClass ?? globalThis.AudioContext;
  const ctx = new Ctor();

  if (ctx.state === "suspended") {
    // Call resume() synchronously — do NOT await.
    // iOS Safari unblocks the context as a side effect of calling resume()
    // within a user gesture handler. The Promise resolves later but the
    // context is already usable for scheduling.
    void ctx.resume();
  }

  return buildTransport(ctx, options?.initialTempo);
}

/**
 * Initialize the audio system (async version).
 *
 * Thin wrapper around initAudioSync that awaits ctx.resume() for callers
 * that need the fully-resolved context (tests, non-gesture code paths).
 * Existing tests use this — preserved for backward compatibility.
 *
 * @param options - Optional configuration.
 * @returns AudioTransport instance (async)
 */
export async function initAudio(
  options?: InitAudioOptions,
): Promise<AudioTransport> {
  const Ctor = options?.AudioContextClass ?? globalThis.AudioContext;
  const ctx = new Ctor();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  return buildTransport(ctx, options?.initialTempo);
}
