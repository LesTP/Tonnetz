/**
 * Immediate (non-scheduled) chord playback.
 *
 * Manages a set of active voices and connects to an effects chain.
 * Provides the ARCH §6.2 public API: playShape(), playPitchClasses(), stopAll().
 *
 * Per-voice gain is determined by the preset (osc1Gain + osc2Gain < 0.24)
 * so that up to 4 simultaneous voices never clip.
 */

import type { Shape } from "harmony-core";
import type { AudioTransport, PlayOptions } from "./types.js";
import type { SynthPreset } from "./presets.js";
import type { EffectsChain } from "./effects.js";
import { PRESET_CLASSIC } from "./presets.js";
import { createVoice, type VoiceHandle } from "./synth.js";
import { voiceInRegister, voiceLead } from "./voicing.js";

const DEFAULT_REGISTER = 60;
const DEFAULT_VELOCITY = 100;

// ── Pitch-class comparison ───────────────────────────────────────────

/** Order-independent pitch-class set equality. */
function samePitchClasses(
  a: readonly number[],
  b: readonly number[],
): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

// ── Active voice tracking ────────────────────────────────────────────

/** State for the immediate playback system. Created per-transport. */
export interface ImmediatePlaybackState {
  readonly transport: AudioTransport;
  /** Destination for voices — either effectsChain.input or masterGain */
  readonly voiceDestination: AudioNode;
  /** Master gain node — may be effectsChain.output or standalone */
  readonly masterGain: GainNode;
  /** Effects chain (if provided) */
  readonly effectsChain: EffectsChain | null;
  readonly voices: Set<VoiceHandle>;
  prevVoicing: number[];
  /** Pad mode: per-voice continuation on chord change (3c). */
  padMode: boolean;
  /** Current synthesis preset. Mutable — changed by sidebar dropdown. */
  preset: SynthPreset;
}

/** Options for createImmediatePlayback. */
export interface CreateImmediatePlaybackOptions {
  /** Effects chain to route voices through. If omitted, voices connect directly to destination. */
  effectsChain?: EffectsChain;
  /** Initial preset. Defaults to PRESET_CLASSIC. */
  preset?: SynthPreset;
}

/**
 * Create an immediate playback state bound to a transport.
 * Voices connect to the effects chain input (if provided) or directly to destination.
 */
export function createImmediatePlayback(
  transport: AudioTransport,
  options?: CreateImmediatePlaybackOptions,
): ImmediatePlaybackState {
  const ctx = transport.getContext();
  const effectsChain = options?.effectsChain ?? null;
  const preset = options?.preset ?? PRESET_CLASSIC;

  let voiceDestination: AudioNode;
  let masterGain: GainNode;

  if (effectsChain) {
    // Voices connect to effects chain input; effects chain handles routing to destination
    voiceDestination = effectsChain.input;
    masterGain = effectsChain.output;
    // Apply initial preset to effects chain
    effectsChain.reconfigure(preset);
  } else {
    // No effects chain — create a simple master gain connected to destination
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
    voiceDestination = masterGain;
  }

  return {
    transport,
    voiceDestination,
    masterGain,
    effectsChain,
    voices: new Set(),
    prevVoicing: [],
    padMode: false,
    preset,
  };
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

  // ── 3b gate: sustain identical chords (both modes) ────────────────
  if (state.prevVoicing.length > 0 && state.voices.size > 0) {
    const currentPcs = [...new Set(state.prevVoicing.map((m) => m % 12))].sort(
      (a, b) => a - b,
    );
    const incomingPcs = [...new Set(pcs)].sort((a, b) => a - b);
    if (samePitchClasses(currentPcs, incomingPcs)) {
      return;
    }
  }

  // Voice the pitch classes (needed by both pad and piano modes)
  const midiNotes =
    state.prevVoicing.length > 0
      ? voiceLead(state.prevVoicing, [...pcs], register)
      : voiceInRegister([...pcs], register);

  // ── 3c: pad mode — per-voice continuation ────────────────────────
  if (state.padMode && state.voices.size > 0) {
    const prevByMidi = new Map<number, VoiceHandle>();
    for (const voice of state.voices) {
      if (!prevByMidi.has(voice.midi)) {
        prevByMidi.set(voice.midi, voice);
      }
    }

    const newVoices = new Set<VoiceHandle>();
    for (const midi of midiNotes) {
      const existing = prevByMidi.get(midi);
      if (existing) {
        // Common tone — keep sounding
        newVoices.add(existing);
        prevByMidi.delete(midi);
      } else {
        // Arriving tone — fresh attack with current preset
        const voice = createVoice(
          ctx,
          state.voiceDestination,
          midi,
          velocity,
          undefined,
          state.preset,
        );
        newVoices.add(voice);
      }
    }

    // Departing tones — musical release (500ms tail)
    for (const voice of prevByMidi.values()) {
      voice.release();
    }

    state.voices.clear();
    for (const v of newVoices) {
      state.voices.add(v);
    }
    state.prevVoicing = midiNotes;
    return;
  }

  // ── Piano mode (3a): hard-stop previous, create all new ──────────
  for (const voice of state.voices) {
    voice.stop();
  }
  state.voices.clear();

  // Create new voices with current preset
  for (const midi of midiNotes) {
    const voice = createVoice(
      ctx,
      state.voiceDestination,
      midi,
      velocity,
      undefined,
      state.preset,
    );
    state.voices.add(voice);
  }

  // Save voicing for next voice-leading
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
}

/**
 * Update the preset for immediate playback.
 * Also reconfigures the effects chain if present.
 */
export function setPreset(
  state: ImmediatePlaybackState,
  preset: SynthPreset,
): void {
  state.preset = preset;
  if (state.effectsChain) {
    state.effectsChain.reconfigure(preset);
  }
}
