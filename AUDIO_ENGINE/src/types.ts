/**
 * Audio Engine type definitions.
 * Interfaces per ARCH_AUDIO_ENGINE.md Section 6.
 */

import type { Shape } from "harmony-core";
import type { SynthPreset } from "./presets.js";

// ── Transport State ──────────────────────────────────────────────────

/** Transport state snapshot for progression playback. */
export interface TransportState {
  /** True if scheduled playback is active. */
  readonly playing: boolean;
  /** Current tempo in beats per minute. */
  readonly tempo: number;
  /** Index of the currently active chord (0-based), or -1 if not playing. */
  readonly currentChordIndex: number;
  /** Total number of chords in the scheduled progression. */
  readonly totalChords: number;
}

// ── Chord Event ──────────────────────────────────────────────────────

/** Scheduled chord event for progression playback. */
export interface ChordEvent {
  /** Shape to play (from Harmony Core). */
  readonly shape: Shape;
  /** Start time in beats (relative to playback start). */
  readonly startBeat: number;
  /** Duration in beats. */
  readonly durationBeats: number;
}

// ── Event Payloads ───────────────────────────────────────────────────

/** Playback state change event payload. */
export interface PlaybackStateChange {
  readonly playing: boolean;
  /** AudioContext.currentTime at state change. */
  readonly timestamp: number;
}

/** Chord change event payload (fired when active chord changes during playback). */
export interface ChordChangeEvent {
  readonly chordIndex: number;
  readonly shape: Shape;
  readonly timestamp: number;
}

// ── AudioTransport Interface ─────────────────────────────────────────

/**
 * Shared transport timebase for synchronized playback.
 *
 * Audio Engine owns the AudioContext instance. Rendering/UI queries the
 * transport for animation synchronization.
 */
export interface AudioTransport {
  // === Time Queries ===

  /** Returns the current AudioContext time in seconds. */
  getTime(): number;

  /** Returns the AudioContext instance. */
  getContext(): AudioContext;

  // === State Queries ===

  /** Returns the current transport state snapshot. */
  getState(): TransportState;

  /** Returns true if scheduled playback is active. */
  isPlaying(): boolean;

  /** Returns the current tempo in BPM. */
  getTempo(): number;

  /** Returns the index of the currently playing chord, or -1 if not playing. */
  getCurrentChordIndex(): number;

  // === Playback Control ===

  /** Sets the tempo for scheduled playback. */
  setTempo(bpm: number): void;

  /** Schedules a progression for playback. Does not start playback. */
  scheduleProgression(events: readonly ChordEvent[]): void;

  /** Starts scheduled playback from the beginning. No-op if nothing scheduled. */
  play(): void;

  /** Stops playback and resets to the beginning. */
  stop(): void;

  /** Pauses playback at the current position. */
  pause(): void;

  /** Cancels the scheduled progression and stops playback. */
  cancelSchedule(): void;

  /** Sets pad mode for voice continuation at chord boundaries (3c). */
  setPadMode(enabled: boolean): void;

  /** Returns true if pad mode is active. */
  getPadMode(): boolean;

  /** Sets loop mode: last chord hard-stops at endTime (no release tail). */
  setLoop(enabled: boolean): void;

  /** Returns true if loop mode is active. */
  getLoop(): boolean;

  /** Sets the synthesis preset for scheduled playback. Takes effect on next play(). */
  setPreset(preset: SynthPreset): void;

  /** Returns the current synthesis preset. */
  getPreset(): SynthPreset;

  // === Event Subscriptions ===

  /** Subscribes to playback state changes. Returns unsubscribe function. */
  onStateChange(callback: (event: PlaybackStateChange) => void): () => void;

  /** Subscribes to chord change events during playback. Returns unsubscribe function. */
  onChordChange(callback: (event: ChordChangeEvent) => void): () => void;
}

/** Audio playback mode for chord transitions. */
export type PlaybackMode = "piano" | "pad";

// ── Immediate Playback Options ───────────────────────────────────────

/** Options for immediate (non-scheduled) chord playback. */
export interface PlayOptions {
  /** Target register in MIDI note number (default: 60 = middle C). */
  readonly register?: number;
  /** Velocity 0–127 (default: 100). */
  readonly velocity?: number;
  /** Duration in seconds (default: sustained until stopAll). */
  readonly duration?: number;
}

// ── Init Options ─────────────────────────────────────────────────────

/** Options for initAudio(). AudioContextClass enables test injection. */
export interface InitAudioOptions {
  /**
   * AudioContext constructor override.
   * Default: globalThis.AudioContext.
   * Tests inject a mock via this parameter.
   */
  readonly AudioContextClass?: {
    new (): AudioContext;
  };

  /** Initial tempo in BPM (default: 120). */
  readonly initialTempo?: number;
}
