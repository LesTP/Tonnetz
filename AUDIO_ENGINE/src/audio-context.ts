/**
 * AudioContext initialization and AudioTransport factory.
 *
 * initAudio() creates an AudioContext (resuming if suspended per browser
 * autoplay policy) and returns an AudioTransport instance that serves as
 * the shared transport timebase for both Audio Engine and Rendering/UI.
 *
 * Phase 1b: Time/state queries fully implemented.
 * Phase 2: Transport control methods connected to the scheduler engine.
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

const DEFAULT_TEMPO = 120;

/**
 * Initialize the audio system. Must be called after a user gesture
 * (browser autoplay policy requires user interaction before AudioContext
 * can produce sound).
 *
 * @param options - Optional configuration. Tests inject MockAudioContext
 *   via options.AudioContextClass.
 * @returns AudioTransport instance
 */
export async function initAudio(
  options?: InitAudioOptions,
): Promise<AudioTransport> {
  const Ctor = options?.AudioContextClass ?? globalThis.AudioContext;
  const ctx = new Ctor();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  let tempo = options?.initialTempo ?? DEFAULT_TEMPO;
  let playing = false;
  let currentChordIndex = -1;
  let scheduledEvents: readonly ChordEvent[] = [];
  let pausedBeatOffset = 0;
  let scheduler: SchedulerState | null = null;
  let prevVoicing: number[] = [];

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
    // === Time Queries ===

    getTime(): number {
      return ctx.currentTime;
    },

    getContext(): AudioContext {
      return ctx;
    },

    // === State Queries ===

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

    // === Playback Control ===

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
      currentChordIndex = 0;

      // Create and start the scheduler
      scheduler = createScheduler({
        ctx,
        destination: ctx.destination,
        events: scheduledEvents,
        bpm: tempo,
        beatOffset: pausedBeatOffset,
        prevVoicing,
        onChordChange: emitChordChange,
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
      scheduledEvents = [];
      if (wasPlaying) {
        emitStateChange();
      }
    },

    // === Event Subscriptions ===

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
