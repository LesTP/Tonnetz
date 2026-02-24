/**
 * Per-voice synthesis signal chain (AE-D2, Phase 3d).
 *
 * Supports multiple synthesis presets with configurable oscillators,
 * filter, envelope, LFO modulation, and output gain.
 *
 * Signal chain per voice:
 *   2× OscillatorNode (configurable types, detune)
 *   → 2× GainNode (per-osc gain)
 *   → BiquadFilterNode (lowpass, optional bloom automation)
 *   → GainNode (envelope)
 *   → GainNode (output trim)
 *   → destination (passed by caller — typically effectsChain.input)
 *
 * Optional LFO modulates filter frequency or oscillator pitch.
 */

import type { SynthPreset, PresetOscType } from "./presets.js";
import { PRESET_CLASSIC, getPeriodicWave } from "./presets.js";

// ── Synthesis parameters (AE-D2, ARCH §2b) ──────────────────────────
// Preserved for backward compatibility with existing tests.

export const SYNTH_DEFAULTS = {
  osc1Type: "triangle" as OscillatorType,
  osc2Type: "sine" as OscillatorType,
  detuneCents: 3,
  filterCutoff: 1500,
  filterQ: 1.0,
  attackTime: 0.12,
  decayTime: 0.2,
  sustainLevel: 0.7,
  releaseTime: 0.5,
} as const;

/**
 * Safety offset for scheduling Web Audio events on mobile devices.
 *
 * On mobile/tablet, the AudioContext renders in large buffer chunks
 * (512–1024 samples = 12–23ms). ctx.currentTime on the main thread
 * only updates once per buffer, so it can be 12–23ms stale by the time
 * our JavaScript reads it. Events scheduled at ctx.currentTime land in
 * the past on the audio thread, causing:
 *   - Onset: envelope ramp partially elapsed → first sample not silent
 *   - Offset: fade-out ramp end in the past → instant snap to 0 (click)
 *
 * Scheduling events at ctx.currentTime + safeOffset guarantees they land
 * in a future audio buffer. The offset is derived from ctx.baseLatency
 * (when available) which equals the buffer duration, or falls back to
 * a conservative 25ms (covers 1024 samples at 44.1kHz).
 */
function safeOffset(ctx: AudioContext): number {
  return (ctx as { baseLatency?: number }).baseLatency ?? 0.025;
}

// ── MIDI → frequency ─────────────────────────────────────────────────

/** Convert MIDI note number to frequency in Hz. A4 = 440 Hz = MIDI 69. */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

// ── Voice handle ─────────────────────────────────────────────────────

/** Handle for a single active voice. Used to release or stop the voice. */
export interface VoiceHandle {
  /** The MIDI note this voice is playing. */
  readonly midi: number;
  /** Trigger ADSR release phase. Voice self-cleans after release. */
  release(when?: number): void;
  /**
   * Cancel a previously scheduled release, restoring the sustain level.
   * No-op if the voice was never released or has been hard-stopped.
   * Allows a subsequent release() call with a new end time.
   */
  cancelRelease(): void;
  /** Immediate hard stop (disconnect all nodes). */
  stop(): void;
}

// ── Oscillator setup helpers ─────────────────────────────────────────

function setupOscillator(
  ctx: AudioContext,
  osc: OscillatorNode,
  oscType: PresetOscType,
  freq: number,
  detuneCents: number,
  preset: SynthPreset,
  isOsc2: boolean,
): void {
  // Handle "sub" type: osc2 plays one octave below
  if (oscType === "sub") {
    osc.type = "sine";
    osc.frequency.value = freq / 2;
    osc.detune.value = isOsc2 ? -detuneCents : detuneCents;
    return;
  }

  // Handle "periodic" type: use PeriodicWave from preset
  if (oscType === "periodic") {
    const wave = getPeriodicWave(ctx, preset);
    if (wave) {
      osc.setPeriodicWave(wave);
    } else {
      // Fallback to sine if no partials defined
      osc.type = "sine";
    }
    osc.frequency.value = freq;
    osc.detune.value = isOsc2 ? -detuneCents : detuneCents;
    return;
  }

  // Standard oscillator type
  osc.type = oscType;
  osc.frequency.value = freq;
  osc.detune.value = isOsc2 ? -detuneCents : detuneCents;
}

// ── Voice creation ───────────────────────────────────────────────────

/**
 * Create and start a single synthesizer voice.
 *
 * @param ctx - AudioContext
 * @param destination - AudioNode to connect to (e.g., effectsChain.input)
 * @param midi - MIDI note number (0–127)
 * @param velocity - Velocity 0–127, scales peak gain (default: 100)
 * @param when - AudioContext time to start (default: ctx.currentTime)
 * @param preset - SynthPreset to use (default: PRESET_CLASSIC)
 * @returns VoiceHandle for release/stop control
 */
export function createVoice(
  ctx: AudioContext,
  destination: AudioNode,
  midi: number,
  velocity: number = 100,
  when?: number,
  preset: SynthPreset = PRESET_CLASSIC,
): VoiceHandle {
  const offset = safeOffset(ctx);
  const now = when ?? ctx.currentTime;
  // Oscillators start in the future to guarantee the envelope is at 0
  // before any signal reaches the destination. See safeOffset() docs.
  const oscStart = now + offset;
  const freq = midiToFreq(midi);
  const peakGain = velocity / 127;

  // Extract preset parameters
  const {
    osc1Type,
    osc2Type,
    osc1Gain,
    osc2Gain,
    detuneCents,
    filterCutoff,
    filterQ,
    filterBloom,
    attackTime,
    decayTime,
    sustainLevel,
    releaseTime,
    lfo,
    outputGain = 1.0,
  } = preset;

  // ── Oscillators ──────────────────────────────────────────────────

  const osc1 = ctx.createOscillator();
  setupOscillator(ctx, osc1, osc1Type, freq, detuneCents, preset, false);

  const osc2 = ctx.createOscillator();
  setupOscillator(ctx, osc2, osc2Type, freq, detuneCents, preset, true);

  // Per-oscillator gain nodes (allows asymmetric mixing)
  const osc1GainNode = ctx.createGain();
  osc1GainNode.gain.value = osc1Gain;

  const osc2GainNode = ctx.createGain();
  osc2GainNode.gain.value = osc2Gain;

  // ── Filter ───────────────────────────────────────────────────────

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterCutoff;
  filter.Q.value = filterQ;

  // Filter bloom automation (optional)
  if (filterBloom) {
    filter.frequency.setValueAtTime(filterBloom.start, oscStart);
    filter.frequency.linearRampToValueAtTime(
      filterBloom.peak,
      oscStart + attackTime,
    );
    filter.frequency.setTargetAtTime(
      filterBloom.settle,
      oscStart + attackTime,
      filterBloom.timeConstant,
    );
  }

  // ── Envelope ─────────────────────────────────────────────────────

  const envGain = ctx.createGain();
  envGain.gain.value = 0;
  envGain.gain.setValueAtTime(0, now);
  envGain.gain.setValueAtTime(0, oscStart);
  // Attack: ramp to peak
  envGain.gain.linearRampToValueAtTime(peakGain, oscStart + attackTime);
  // Decay: ramp to sustain
  envGain.gain.linearRampToValueAtTime(
    peakGain * sustainLevel,
    oscStart + attackTime + decayTime,
  );

  // ── Output gain (trim) ───────────────────────────────────────────

  const outGain = ctx.createGain();
  outGain.gain.value = outputGain;

  // ── LFO (optional) ───────────────────────────────────────────────

  let lfoOsc: OscillatorNode | null = null;
  let lfoGain: GainNode | null = null;

  if (lfo) {
    lfoOsc = ctx.createOscillator();
    lfoOsc.type = "sine";
    lfoOsc.frequency.value = lfo.rate;

    lfoGain = ctx.createGain();
    lfoGain.gain.value = lfo.depth;

    lfoOsc.connect(lfoGain);

    if (lfo.target === "filter") {
      // Modulate filter frequency
      lfoGain.connect(filter.frequency);
    } else {
      // Modulate pitch (detune on both oscillators)
      lfoGain.connect(osc1.detune);
      lfoGain.connect(osc2.detune);
    }

    lfoOsc.start(oscStart);
  }

  // ── Connect signal chain ─────────────────────────────────────────

  // osc1 → osc1Gain → filter
  // osc2 → osc2Gain → filter
  // filter → envGain → outGain → destination
  osc1.connect(osc1GainNode);
  osc2.connect(osc2GainNode);
  osc1GainNode.connect(filter);
  osc2GainNode.connect(filter);
  filter.connect(envGain);
  envGain.connect(outGain);
  outGain.connect(destination);

  // Start oscillators at the safe future time
  osc1.start(oscStart);
  osc2.start(oscStart);

  // ── Voice state ──────────────────────────────────────────────────

  let released = false;
  let stopped = false;
  let releaseCleanupId: ReturnType<typeof setTimeout> | null = null;

  function disconnectAll(): void {
    osc1.disconnect();
    osc2.disconnect();
    osc1GainNode.disconnect();
    osc2GainNode.disconnect();
    filter.disconnect();
    envGain.disconnect();
    outGain.disconnect();
    if (lfoOsc) {
      lfoOsc.disconnect();
      lfoGain?.disconnect();
    }
  }

  function stopLfo(): void {
    if (lfoOsc) {
      try {
        lfoOsc.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  const handle: VoiceHandle = {
    midi,

    release(releaseWhen?: number): void {
      if (released || stopped) return;
      released = true;
      const t = releaseWhen ?? ctx.currentTime;
      envGain.gain.cancelScheduledValues(t);
      // Use the known sustain level, not envGain.gain.value — when
      // release() is called at scheduling time (before the voice plays),
      // gain.value returns 0 (initial value), not the sustain level the
      // envelope will be at when t arrives. That would snap to 0 → click.
      envGain.gain.setValueAtTime(peakGain * sustainLevel, t);
      envGain.gain.linearRampToValueAtTime(0, t + releaseTime);
      // Schedule silent cleanup after release tail completes.
      // Don't call stop() — the envelope is already at zero and
      // stop()'s setValueAtTime/ramp would create a micro-spike.
      // Just stop oscillators and disconnect nodes silently.
      const cleanupDelay = t - ctx.currentTime + releaseTime + 0.05;
      releaseCleanupId = setTimeout(() => {
        releaseCleanupId = null;
        if (stopped) return;
        stopped = true;
        try {
          osc1.stop();
        } catch {
          /* already stopped */
        }
        try {
          osc2.stop();
        } catch {
          /* already stopped */
        }
        stopLfo();
        disconnectAll();
      }, cleanupDelay * 1000);
    },

    cancelRelease(): void {
      if (!released || stopped) return;
      released = false;
      // Cancel the pending cleanup setTimeout from the previous release()
      if (releaseCleanupId !== null) {
        clearTimeout(releaseCleanupId);
        releaseCleanupId = null;
      }
      const t = ctx.currentTime;
      envGain.gain.cancelScheduledValues(t);
      envGain.gain.setValueAtTime(peakGain * sustainLevel, t);
    },

    stop(): void {
      if (stopped) return;
      stopped = true;
      released = true;
      // Cancel any pending release cleanup timer
      if (releaseCleanupId !== null) {
        clearTimeout(releaseCleanupId);
        releaseCleanupId = null;
      }
      // Fade-out long enough (50ms) to survive stale ctx.currentTime on
      // mobile (12–23ms staleness). Unlike createVoice's safeOffset, we
      // do NOT push t into the future here — that would cancel the
      // envelope automation scheduled at oscStart when ctx.currentTime
      // hasn't changed between voice creation and stop (same audio buffer).
      const fadeOut = 0.05;
      const t = ctx.currentTime;
      try {
        envGain.gain.cancelScheduledValues(t);
        envGain.gain.setValueAtTime(peakGain * sustainLevel, t);
        envGain.gain.linearRampToValueAtTime(0, t + fadeOut);
        osc1.stop(t + fadeOut + 0.01);
        osc2.stop(t + fadeOut + 0.01);
        if (lfoOsc) {
          lfoOsc.stop(t + fadeOut + 0.01);
        }
      } catch {
        // Already stopped — force disconnect
        try {
          osc1.stop();
        } catch {
          /* noop */
        }
        try {
          osc2.stop();
        } catch {
          /* noop */
        }
        stopLfo();
      }
      setTimeout(() => disconnectAll(), (fadeOut + 0.02) * 1000);
    },
  };

  return handle;
}
