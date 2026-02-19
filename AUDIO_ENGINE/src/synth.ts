/**
 * Per-voice synthesis signal chain (AE-D2).
 *
 * Detuned dual-oscillator pad with low-pass filter.
 * Signal chain per voice:
 *   2× OscillatorNode (triangle +detune, sine −detune)
 *   → GainNode (mix)
 *   → BiquadFilterNode (lowpass)
 *   → GainNode (envelope)
 *   → destination (passed by caller — typically a master gain)
 */

// ── Synthesis parameters (AE-D2, ARCH §2b) ──────────────────────────

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
  /** Immediate hard stop (disconnect all nodes). */
  stop(): void;
}

// ── Voice creation ───────────────────────────────────────────────────

/**
 * Create and start a single synthesizer voice.
 *
 * @param ctx - AudioContext
 * @param destination - AudioNode to connect to (e.g., master GainNode)
 * @param midi - MIDI note number (0–127)
 * @param velocity - Velocity 0–127, scales peak gain (default: 100)
 * @param when - AudioContext time to start (default: ctx.currentTime)
 * @returns VoiceHandle for release/stop control
 */
export function createVoice(
  ctx: AudioContext,
  destination: AudioNode,
  midi: number,
  velocity: number = 100,
  when?: number,
): VoiceHandle {
  const now = when ?? ctx.currentTime;
  const freq = midiToFreq(midi);
  const peakGain = velocity / 127;

  const {
    osc1Type,
    osc2Type,
    detuneCents,
    filterCutoff,
    filterQ,
    attackTime,
    decayTime,
    sustainLevel,
    releaseTime,
  } = SYNTH_DEFAULTS;

  // Oscillator 1: triangle, positive detune
  const osc1 = ctx.createOscillator();
  osc1.type = osc1Type;
  osc1.frequency.value = freq;
  osc1.detune.value = detuneCents;

  // Oscillator 2: sine, negative detune
  const osc2 = ctx.createOscillator();
  osc2.type = osc2Type;
  osc2.frequency.value = freq;
  osc2.detune.value = -detuneCents;

  // Mix gain (equal blend at 0.5 each)
  const mixGain = ctx.createGain();
  mixGain.gain.value = 0.5;

  // Low-pass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterCutoff;
  filter.Q.value = filterQ;

  // Envelope gain (ADSR)
  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0, now);
  // Attack: ramp to peak
  envGain.gain.linearRampToValueAtTime(peakGain, now + attackTime);
  // Decay: ramp to sustain
  envGain.gain.linearRampToValueAtTime(
    peakGain * sustainLevel,
    now + attackTime + decayTime,
  );

  // Connect: osc1,osc2 → mixGain → filter → envGain → destination
  osc1.connect(mixGain);
  osc2.connect(mixGain);
  mixGain.connect(filter);
  filter.connect(envGain);
  envGain.connect(destination);

  // Start oscillators
  osc1.start(now);
  osc2.start(now);

  let released = false;
  let stopped = false;

  const handle: VoiceHandle = {
    midi,

    release(releaseWhen?: number): void {
      if (released || stopped) return;
      released = true;
      const t = releaseWhen ?? ctx.currentTime;
      // Cancel any scheduled ramps, then ramp to zero
      envGain.gain.cancelScheduledValues(t);
      envGain.gain.setValueAtTime(envGain.gain.value, t);
      envGain.gain.linearRampToValueAtTime(0, t + releaseTime);
      // Stop oscillators after release completes
      osc1.stop(t + releaseTime + 0.01);
      osc2.stop(t + releaseTime + 0.01);
    },

    stop(): void {
      if (stopped) return;
      stopped = true;
      released = true;
      // Short fade-out (10ms) to avoid DC click from instant disconnect,
      // but far shorter than releaseTime (500ms) so no audible overlap
      // with the next chord's attack. (Phase 3a envelope cleanup)
      const fadeOut = 0.01;
      const t = ctx.currentTime;
      try {
        envGain.gain.cancelScheduledValues(t);
        envGain.gain.setValueAtTime(envGain.gain.value, t);
        envGain.gain.linearRampToValueAtTime(0, t + fadeOut);
        osc1.stop(t + fadeOut + 0.01);
        osc2.stop(t + fadeOut + 0.01);
      } catch {
        // Already stopped — force disconnect
        try { osc1.stop(); } catch { /* noop */ }
        try { osc2.stop(); } catch { /* noop */ }
      }
      // Schedule disconnect after fade completes
      setTimeout(() => {
        osc1.disconnect();
        osc2.disconnect();
        mixGain.disconnect();
        filter.disconnect();
        envGain.disconnect();
      }, (fadeOut + 0.02) * 1000);
    },
  };

  return handle;
}
