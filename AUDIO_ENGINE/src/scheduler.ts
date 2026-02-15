/**
 * Scheduled playback engine (Phase 2).
 *
 * Converts ChordEvent beat-times to AudioContext seconds and schedules
 * synthesis voices using a lookahead timer pattern. Fires onChordChange
 * callbacks at chord boundaries during playback.
 *
 * Architecture:
 *   - beatsToSeconds(): pure beat→time conversion
 *   - SchedulerState: mutable state for the lookahead loop
 *   - startScheduler(): begins the lookahead interval
 *   - stopScheduler(): hard-stops all voices + interval
 *   - pauseScheduler(): soft-stops voices, preserves beat position
 *   - getCurrentBeat(): live beat position query
 */

import type { ChordEvent, ChordChangeEvent } from "./types.js";
import type { VoiceHandle } from "./synth.js";
import { createVoice } from "./synth.js";
import { voiceInRegister, voiceLead } from "./voicing.js";

// ── Constants ────────────────────────────────────────────────────────

/** Lookahead window in seconds. Nodes are scheduled this far ahead. */
export const SCHEDULE_AHEAD_TIME = 0.1;

/** How often the lookahead timer fires (ms). */
export const SCHEDULER_INTERVAL_MS = 25;

// ── Beat ↔ time conversion ──────────────────────────────────────────

/**
 * Convert a beat count to seconds at a given tempo.
 * @param beats - Number of beats (can be fractional)
 * @param bpm - Tempo in beats per minute
 * @returns Time in seconds
 */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

/**
 * Convert seconds to beats at a given tempo.
 * @param seconds - Time in seconds
 * @param bpm - Tempo in beats per minute
 * @returns Beat count
 */
export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds / 60) * bpm;
}

// ── Scheduler state ──────────────────────────────────────────────────

/** A single chord slot with its scheduled voices. */
export interface ScheduledChord {
  readonly event: ChordEvent;
  readonly startTime: number;
  readonly endTime: number;
  voices: VoiceHandle[];
  scheduled: boolean;
  changeFired: boolean;
}

/** Mutable scheduler state. Created per play() invocation. */
export interface SchedulerState {
  readonly ctx: AudioContext;
  readonly destination: AudioNode;
  readonly bpm: number;
  /** AudioContext.currentTime when playback started (beat 0). */
  readonly playbackOrigin: number;
  /** If resuming from pause, the beat offset to account for. */
  readonly beatOffset: number;
  /** All chord slots with computed wall-clock times. */
  readonly chords: ScheduledChord[];
  /** Index of the next chord to schedule. */
  nextToSchedule: number;
  /** Index of the current chord (for chord change tracking). */
  currentChordIndex: number;
  /** Previous voicing for voice-leading continuity. */
  prevVoicing: number[];
  /** Interval ID for the lookahead timer. */
  timerHandle: ReturnType<typeof setInterval> | null;
  /** Master gain for voice-count normalization. */
  readonly masterGain: GainNode;
  /** Chord change callback (delegated from transport). */
  readonly onChordChange: (event: ChordChangeEvent) => void;
  /** Whether the scheduler has been stopped. */
  stopped: boolean;
}

// ── Scheduler creation ───────────────────────────────────────────────

export interface CreateSchedulerOptions {
  ctx: AudioContext;
  destination: AudioNode;
  events: readonly ChordEvent[];
  bpm: number;
  beatOffset?: number;
  prevVoicing?: number[];
  onChordChange: (event: ChordChangeEvent) => void;
}

/**
 * Create a scheduler state from chord events. Does NOT start the timer.
 * Call startScheduler() to begin the lookahead loop.
 */
export function createScheduler(opts: CreateSchedulerOptions): SchedulerState {
  const { ctx, events, bpm, beatOffset = 0, onChordChange } = opts;
  const origin = ctx.currentTime - beatsToSeconds(beatOffset, bpm);

  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(opts.destination);

  const chords: ScheduledChord[] = events.map((event) => ({
    event,
    startTime: origin + beatsToSeconds(event.startBeat, bpm),
    endTime:
      origin +
      beatsToSeconds(event.startBeat + event.durationBeats, bpm),
    voices: [],
    scheduled: false,
    changeFired: false,
  }));

  return {
    ctx,
    destination: opts.destination,
    bpm,
    playbackOrigin: origin,
    beatOffset,
    chords,
    nextToSchedule: 0,
    currentChordIndex: -1,
    prevVoicing: opts.prevVoicing ?? [],
    timerHandle: null,
    masterGain,
    onChordChange,
    stopped: false,
  };
}

// ── Voice scheduling ─────────────────────────────────────────────────

const DEFAULT_REGISTER = 60;

function scheduleChordVoices(state: SchedulerState, idx: number): void {
  const slot = state.chords[idx];
  if (slot.scheduled) return;
  slot.scheduled = true;

  const pcs = [...slot.event.shape.covered_pcs];
  if (pcs.length === 0) return;

  // Voice with voice-leading continuity
  const midiNotes =
    state.prevVoicing.length > 0
      ? voiceLead(state.prevVoicing, pcs, DEFAULT_REGISTER)
      : voiceInRegister(pcs, DEFAULT_REGISTER);

  state.prevVoicing = midiNotes;

  // Create voices scheduled at the chord start time
  for (const midi of midiNotes) {
    const voice = createVoice(
      state.ctx,
      state.masterGain,
      midi,
      100,
      slot.startTime,
    );
    // Schedule release at chord end time
    voice.release(slot.endTime);
    slot.voices.push(voice);
  }

  // Update voice-count normalization
  const count = midiNotes.length;
  state.masterGain.gain.value = count > 0 ? 1 / Math.sqrt(count) : 1;
}

// ── Lookahead tick ───────────────────────────────────────────────────

function tick(state: SchedulerState): void {
  if (state.stopped) return;

  const now = state.ctx.currentTime;
  const horizon = now + SCHEDULE_AHEAD_TIME;

  // Schedule upcoming chords within lookahead window
  while (state.nextToSchedule < state.chords.length) {
    const slot = state.chords[state.nextToSchedule];
    if (slot.startTime > horizon) break;
    scheduleChordVoices(state, state.nextToSchedule);
    state.nextToSchedule++;
  }

  // Fire chord change events for chords whose start time has passed
  for (let i = 0; i < state.chords.length; i++) {
    const slot = state.chords[i];
    if (slot.changeFired) continue;
    if (now >= slot.startTime) {
      slot.changeFired = true;
      state.currentChordIndex = i;
      state.onChordChange({
        chordIndex: i,
        shape: slot.event.shape,
        timestamp: now,
      });
    }
  }

  // Check if playback is complete (all chords have ended)
  if (state.chords.length > 0) {
    const lastSlot = state.chords[state.chords.length - 1];
    if (now >= lastSlot.endTime) {
      stopScheduler(state);
    }
  }
}

// ── Scheduler control ────────────────────────────────────────────────

/** Start the lookahead timer loop. */
export function startScheduler(state: SchedulerState): void {
  if (state.timerHandle !== null) return;
  state.stopped = false;
  // Do an immediate tick to schedule any chords in the initial window
  tick(state);
  state.timerHandle = setInterval(() => tick(state), SCHEDULER_INTERVAL_MS);
}

/** Stop all scheduled voices and clear the timer. Hard stop. */
export function stopScheduler(state: SchedulerState): void {
  state.stopped = true;
  if (state.timerHandle !== null) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
  // Hard-stop all active voices
  for (const slot of state.chords) {
    for (const voice of slot.voices) {
      voice.stop();
    }
    slot.voices = [];
  }
  // Disconnect master gain
  state.masterGain.disconnect();
}

/**
 * Pause: stop the timer and release active voices.
 * Returns the current beat position for later resume.
 */
export function pauseScheduler(state: SchedulerState): number {
  state.stopped = true;
  if (state.timerHandle !== null) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
  // Release (not hard-stop) currently sounding voices for smooth tail
  const now = state.ctx.currentTime;
  for (const slot of state.chords) {
    for (const voice of slot.voices) {
      voice.release(now);
    }
  }
  // Calculate current beat position
  const elapsed = now - state.playbackOrigin;
  return secondsToBeats(elapsed, state.bpm);
}

/**
 * Get the current beat position of the scheduler.
 */
export function getCurrentBeat(state: SchedulerState): number {
  const elapsed = state.ctx.currentTime - state.playbackOrigin;
  return secondsToBeats(elapsed, state.bpm);
}
