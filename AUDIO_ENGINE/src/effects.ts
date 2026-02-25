/**
 * Global effects chain for synthesis presets.
 *
 * Provides dry/wet routing with configurable delay feedback loops.
 * Voices connect to the chain's input; the chain's output connects to
 * the AudioContext destination.
 *
 * Signal flow:
 *   voices → input (dry) ─┬─→ dryGain ───────────────────┬→ output → destination
 *                         └─→ delay1 → damp1 → fb1 ──────┤
 *                              └─→ delay2 → damp2 → fb2 ─┤
 *                                                        └→ wetGain
 *
 * The chain supports up to 2 parallel delay lines with independent
 * damping (LP filter) and feedback. Presets with no delay use wet=0/dry=1.
 */

import type { SynthPreset, DelayConfig } from "./presets.js";

// ── EffectsChain Interface ───────────────────────────────────────────

export interface EffectsChain {
  /** Input node — voices connect here. */
  readonly input: GainNode;
  /** Output node — connected to ctx.destination. */
  readonly output: GainNode;
  /**
   * Reconfigure the effects chain for a new preset.
   * Adjusts delay times, feedback, damping, and wet/dry mix.
   * If the preset has no delay, wet=0 and dry=1 (bypass).
   */
  reconfigure(preset: SynthPreset): void;
  /** Disconnect all nodes and release resources. */
  destroy(): void;
}

// ── Internal Types ───────────────────────────────────────────────────

interface DelayLine {
  delay: DelayNode;
  damping: BiquadFilterNode;
  feedback: GainNode;
}

interface EffectsChainState {
  ctx: AudioContext;
  input: GainNode;
  output: GainNode;
  dryGain: GainNode;
  wetGain: GainNode;
  delay1: DelayLine | null;
  delay2: DelayLine | null;
  destroyed: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

/** Minimum delay time to avoid feedback loop issues (~1 render quantum). */
const MIN_DELAY_TIME = 0.003;

/** Default damping filter Q. */
const DEFAULT_DAMPING_Q = 0.7;

// ── Helper Functions ─────────────────────────────────────────────────

function createDelayLine(
  ctx: AudioContext,
  time: number,
  feedback: number,
  damping: number,
  dampingQ: number = DEFAULT_DAMPING_Q,
): DelayLine {
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = Math.max(time, MIN_DELAY_TIME);

  const dampFilter = ctx.createBiquadFilter();
  dampFilter.type = "lowpass";
  dampFilter.frequency.value = damping;
  dampFilter.Q.value = dampingQ;

  const fbGain = ctx.createGain();
  fbGain.gain.value = feedback;

  // Connect: delay → damping → feedback → delay (loop)
  delay.connect(dampFilter);
  dampFilter.connect(fbGain);
  fbGain.connect(delay);

  return { delay, damping: dampFilter, feedback: fbGain };
}

function updateDelayLine(
  line: DelayLine,
  time: number,
  feedback: number,
  damping: number,
  dampingQ: number = DEFAULT_DAMPING_Q,
): void {
  line.delay.delayTime.value = Math.max(time, MIN_DELAY_TIME);
  line.feedback.gain.value = feedback;
  line.damping.frequency.value = damping;
  line.damping.Q.value = dampingQ;
}

function disconnectDelayLine(line: DelayLine): void {
  line.delay.disconnect();
  line.damping.disconnect();
  line.feedback.disconnect();
}

// ── EffectsChain Factory ─────────────────────────────────────────────

/**
 * Create a global effects chain.
 *
 * @param ctx - AudioContext
 * @param initialPreset - Optional initial preset to configure delays
 * @returns EffectsChain instance
 */
export function createEffectsChain(
  ctx: AudioContext,
  initialPreset?: SynthPreset,
): EffectsChain {
  // Input node — voices connect here
  const input = ctx.createGain();
  input.gain.value = 1.0;

  // Output node — connects to destination
  const output = ctx.createGain();
  output.gain.value = 1.0;

  // Dry path
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1.0;

  // Wet path (sum of delay outputs)
  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.0;

  // Connect dry path: input → dryGain → output
  input.connect(dryGain);
  dryGain.connect(output);

  // Wet path connects to output (delay lines connect to wetGain)
  wetGain.connect(output);

  const state: EffectsChainState = {
    ctx,
    input,
    output,
    dryGain,
    wetGain,
    delay1: null,
    delay2: null,
    destroyed: false,
  };

  // Connect output to destination
  output.connect(ctx.destination);

  const chain: EffectsChain = {
    input,
    output,

    reconfigure(preset: SynthPreset): void {
      if (state.destroyed) return;

      const delay = preset.delay;

      if (!delay) {
        // No delay — bypass (dry=1, wet=0)
        state.dryGain.gain.value = 1.0;
        state.wetGain.gain.value = 0.0;

        // Disconnect existing delay lines if any
        if (state.delay1) {
          state.delay1.delay.disconnect();
          state.delay1.damping.disconnect();
          state.input.disconnect(state.delay1.delay);
          disconnectDelayLine(state.delay1);
          state.delay1 = null;
        }
        if (state.delay2) {
          state.delay2.delay.disconnect();
          state.delay2.damping.disconnect();
          state.input.disconnect(state.delay2.delay);
          disconnectDelayLine(state.delay2);
          state.delay2 = null;
        }
        return;
      }

      // Set wet/dry mix
      state.dryGain.gain.value = delay.dry;
      state.wetGain.gain.value = delay.wet;

      // Configure delay line 1
      if (state.delay1) {
        updateDelayLine(
          state.delay1,
          delay.time1,
          delay.feedback1,
          delay.damping1,
          delay.dampingQ1,
        );
      } else {
        state.delay1 = createDelayLine(
          state.ctx,
          delay.time1,
          delay.feedback1,
          delay.damping1,
          delay.dampingQ1,
        );
        // Connect: input → delay1, damping1 → wetGain
        state.input.connect(state.delay1.delay);
        state.delay1.damping.connect(state.wetGain);
      }

      // Configure delay line 2 (optional)
      if (delay.time2 !== undefined && delay.feedback2 !== undefined && delay.damping2 !== undefined) {
        if (state.delay2) {
          updateDelayLine(
            state.delay2,
            delay.time2,
            delay.feedback2,
            delay.damping2,
            delay.dampingQ2,
          );
        } else {
          state.delay2 = createDelayLine(
            state.ctx,
            delay.time2,
            delay.feedback2,
            delay.damping2,
            delay.dampingQ2,
          );
          // Connect: input → delay2, damping2 → wetGain
          state.input.connect(state.delay2.delay);
          state.delay2.damping.connect(state.wetGain);
        }
      } else if (state.delay2) {
        // Preset doesn't use delay2 but we have one — disconnect it
        state.input.disconnect(state.delay2.delay);
        disconnectDelayLine(state.delay2);
        state.delay2 = null;
      }
    },

    destroy(): void {
      if (state.destroyed) return;
      state.destroyed = true;

      // Disconnect all nodes
      state.input.disconnect();
      state.dryGain.disconnect();
      state.wetGain.disconnect();
      state.output.disconnect();

      if (state.delay1) {
        disconnectDelayLine(state.delay1);
      }
      if (state.delay2) {
        disconnectDelayLine(state.delay2);
      }
    },
  };

  // Apply initial preset if provided
  if (initialPreset) {
    chain.reconfigure(initialPreset);
  }

  return chain;
}

/**
 * Check if an effects chain is in bypass mode (no delay, wet=0).
 */
export function isEffectsBypassed(chain: EffectsChain): boolean {
  // We can't directly access wetGain from the interface, so check
  // if the wetGain connected to output has value 0
  // This is a heuristic — for tests, inspect the state directly
  return false; // Placeholder — actual bypass detection requires state access
}
