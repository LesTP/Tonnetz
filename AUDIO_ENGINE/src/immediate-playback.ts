/**
 * Immediate (non-scheduled) chord playback.
 *
 * Manages a set of active voices and a master gain node.
 * Provides the ARCH §6.2 public API: playShape(), playPitchClasses(), stopAll().
 *
 * Voice-count normalization: master gain = 1 / sqrt(voiceCount)
 * to prevent clipping while maintaining perceived loudness (ARCH §2b).
 */

import type { Shape } from "harmony-core";
import type { AudioTransport, PlayOptions } from "./types.js";
import { createVoice, type VoiceHandle } from "./synth.js";
import { voiceInRegister, voiceLead } from "./voicing.js";

const DEFAULT_REGISTER = 60;
const DEFAULT_VELOCITY = 100;

// ── Active voice tracking ────────────────────────────────────────────

/** State for the immediate playback system. Created per-transport. */
export interface ImmediatePlaybackState {
  readonly transport: AudioTransport;
  readonly masterGain: GainNode;
  readonly voices: Set<VoiceHandle>;
  prevVoicing: number[];
}

/**
 * Create an immediate playback state bound to a transport.
 * The master gain node is connected to the AudioContext destination.
 */
export function createImmediatePlayback(
  transport: AudioTransport,
): ImmediatePlaybackState {
  const ctx = transport.getContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  return {
    transport,
    masterGain,
    voices: new Set(),
    prevVoicing: [],
  };
}

// ── Voice-count normalization ────────────────────────────────────────

function updateMasterGain(state: ImmediatePlaybackState): void {
  const count = state.voices.size;
  state.masterGain.gain.value = count > 0 ? 1 / Math.sqrt(count) : 1;
}

// ── Public API (ARCH §6.2) ───────────────────────────────────────────

/**
 * Play a set of pitch classes immediately.
 * Releases any currently active voices before starting new ones.
 *
 * @param state - Immediate playback state from createImmediatePlayback()
 * @param pcs - Pitch classes (0–11) to play
 * @param options - Register, velocity, duration
 */
export function playPitchClasses(
  state: ImmediatePlaybackState,
  pcs: readonly number[],
  options?: PlayOptions,
): void {
  if (pcs.length === 0) return;

  const ctx = state.transport.getContext();
  const register = options?.register ?? DEFAULT_REGISTER;
  const velocity = options?.velocity ?? DEFAULT_VELOCITY;

  // Hard-stop previous voices (clean cut, no release-tail overlap).
  // The 10ms fade-out in stop() prevents DC clicks while being far
  // shorter than the 500ms release tail that caused crackling.
  // (Phase 3a envelope cleanup)
  for (const voice of state.voices) {
    voice.stop();
  }
  state.voices.clear();

  // Voice the pitch classes
  const midiNotes =
    state.prevVoicing.length > 0
      ? voiceLead(state.prevVoicing, [...pcs], register)
      : voiceInRegister([...pcs], register);

  // Create new voices
  for (const midi of midiNotes) {
    const voice = createVoice(
      ctx,
      state.masterGain,
      midi,
      velocity,
    );
    state.voices.add(voice);
  }

  // Update normalization and save voicing for next voice-leading
  updateMasterGain(state);
  state.prevVoicing = midiNotes;

  // Auto-release after duration (if specified)
  if (options?.duration != null && options.duration > 0) {
    const releaseTime = ctx.currentTime + options.duration;
    for (const voice of state.voices) {
      voice.release(releaseTime);
    }
  }
}

/**
 * Play a Shape immediately (interactive mode).
 * Uses the Shape's covered_pcs for voicing.
 *
 * @param state - Immediate playback state
 * @param shape - Shape from Harmony Core
 * @param options - Register, velocity, duration
 */
export function playShape(
  state: ImmediatePlaybackState,
  shape: Shape,
  options?: PlayOptions,
): void {
  const pcs = [...shape.covered_pcs];
  playPitchClasses(state, pcs, options);
}

/**
 * Stop all currently sounding notes immediately (hard stop).
 * Clears previous voicing state.
 */
export function stopAll(state: ImmediatePlaybackState): void {
  for (const voice of state.voices) {
    voice.stop();
  }
  state.voices.clear();
  state.prevVoicing = [];
  updateMasterGain(state);
}
