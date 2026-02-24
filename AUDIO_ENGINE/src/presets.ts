/**
 * Synthesis presets for Phase 3d.
 *
 * Each preset defines oscillator configuration, filter settings, envelope,
 * optional LFO modulation, and optional delay effects. The preset system
 * allows A/B testing different sounds while maintaining the same VoiceHandle
 * interface.
 *
 * Gain staging: (osc1Gain + osc2Gain) × 4 voices < 1.0 to prevent clipping.
 * See DEVPLAN_3D.md §Gain Staging for per-preset calculations.
 */

// ── SynthPreset Type ─────────────────────────────────────────────────

/** Oscillator type extended with preset-specific variants. */
export type PresetOscType = OscillatorType | "periodic" | "sub";

/** Filter bloom automation parameters. */
export interface FilterBloom {
  readonly start: number;
  readonly peak: number;
  readonly settle: number;
  readonly timeConstant: number;
}

/** LFO modulation parameters. */
export interface LfoConfig {
  readonly rate: number;
  readonly depth: number;
  readonly target: "filter" | "pitch";
}

/** Delay effect parameters. */
export interface DelayConfig {
  readonly time1: number;
  readonly feedback1: number;
  readonly damping1: number;
  readonly dampingQ1?: number;
  readonly time2?: number;
  readonly feedback2?: number;
  readonly damping2?: number;
  readonly dampingQ2?: number;
  readonly wet: number;
  readonly dry: number;
}

/** Complete synthesis preset definition. */
export interface SynthPreset {
  readonly name: string;
  readonly label: string;

  // Oscillators
  readonly osc1Type: PresetOscType;
  readonly osc2Type: PresetOscType;
  readonly osc1Gain: number;
  readonly osc2Gain: number;
  readonly detuneCents: number;
  readonly periodicWavePartials?: readonly number[];

  // Filter
  readonly filterCutoff: number;
  readonly filterQ: number;
  readonly filterBloom?: FilterBloom;

  // Envelope
  readonly attackTime: number;
  readonly decayTime: number;
  readonly sustainLevel: number;
  readonly releaseTime: number;

  // LFO (omit for no modulation)
  readonly lfo?: LfoConfig;

  // Global delay (omit for dry)
  readonly delay?: DelayConfig;

  // Output level trim (default 1.0)
  readonly outputGain?: number;
}

// ── Preset Definitions ───────────────────────────────────────────────

/**
 * Classic preset — baseline sound matching current synth.ts behavior.
 * Detuned triangle+sine dual oscillator with LP filter.
 */
export const PRESET_CLASSIC: SynthPreset = {
  name: "classic",
  label: "Classic",

  osc1Type: "triangle",
  osc2Type: "sine",
  osc1Gain: 0.12,
  osc2Gain: 0.12,
  detuneCents: 3,

  filterCutoff: 1500,
  filterQ: 1.0,

  attackTime: 0.12,
  decayTime: 0.2,
  sustainLevel: 0.7,
  releaseTime: 0.5,
};

/**
 * Warm Pad — saw+triangle with lower cutoff and filter bloom.
 * Warm, muffled, slow washes with subtle delay.
 */
export const PRESET_WARM_PAD: SynthPreset = {
  name: "warm-pad",
  label: "Warm Pad",

  osc1Type: "sawtooth",
  osc2Type: "triangle",
  osc1Gain: 0.10,
  osc2Gain: 0.07,
  detuneCents: 5,

  filterCutoff: 900,
  filterQ: 0.85,
  filterBloom: {
    start: 550,
    peak: 1250,
    settle: 900,
    timeConstant: 0.35,
  },

  attackTime: 0.35,
  decayTime: 0.6,
  sustainLevel: 0.78,
  releaseTime: 1.4,

  delay: {
    time1: 0.055,
    feedback1: 0.33,
    damping1: 2400,
    wet: 0.16,
    dry: 0.84,
  },
};

/**
 * Breathing Pad — Warm Pad + slow LFO on filter cutoff.
 * Organic breathing motion.
 */
export const PRESET_BREATHING_PAD: SynthPreset = {
  name: "breathing-pad",
  label: "Breathing Pad",

  osc1Type: "sawtooth",
  osc2Type: "triangle",
  osc1Gain: 0.10,
  osc2Gain: 0.07,
  detuneCents: 5,

  filterCutoff: 900,
  filterQ: 0.85,
  filterBloom: {
    start: 550,
    peak: 1250,
    settle: 900,
    timeConstant: 0.35,
  },

  attackTime: 0.35,
  decayTime: 0.6,
  sustainLevel: 0.78,
  releaseTime: 1.4,

  lfo: {
    rate: 0.09,
    depth: 120,
    target: "filter",
  },

  delay: {
    time1: 0.055,
    feedback1: 0.33,
    damping1: 2400,
    wet: 0.16,
    dry: 0.84,
  },
};

/**
 * Cathedral principals partial array for PeriodicWave.
 * Warm pipe organ with gentle upper partials.
 */
export const CATHEDRAL_PARTIALS: readonly number[] = [
  0, 1.0, 0.42, 0.18, 0.10, 0.06, 0.05, 0, 0.03,
];

/**
 * Cathedral Organ — PeriodicWave principals + sine sub-octave + dual delay.
 * Near-instant attack with brief "chiff" filter bloom.
 */
export const PRESET_CATHEDRAL: SynthPreset = {
  name: "cathedral",
  label: "Cathedral Organ",

  osc1Type: "periodic",
  osc2Type: "sub",
  osc1Gain: 0.14,
  osc2Gain: 0.08,
  detuneCents: 0,
  periodicWavePartials: CATHEDRAL_PARTIALS,

  filterCutoff: 4200,
  filterQ: 0.75,
  filterBloom: {
    start: 4200,
    peak: 6200,
    settle: 4200,
    timeConstant: 0.03,
  },

  attackTime: 0.012,
  decayTime: 0.05,
  sustainLevel: 0.9,
  releaseTime: 0.08,

  delay: {
    time1: 0.061,
    feedback1: 0.33,
    damping1: 2900,
    time2: 0.089,
    feedback2: 0.28,
    damping2: 2400,
    wet: 0.22,
    dry: 0.78,
  },
};

/**
 * Electric organ drawbar partial array for PeriodicWave.
 * Hammond-style drawbar registration (freq = noteHz/2).
 */
export const ELECTRIC_ORGAN_PARTIALS: readonly number[] = [
  0, 0.58, 0.95, 0.55, 0.62, 0, 0.28, 0, 0.24, 0, 0.16, 0, 0.12, 0, 0, 0, 0.08,
];

/**
 * Electric Organ (B3/Leslie) — PeriodicWave drawbars + rotary LFO on pitch.
 * Gate-like envelope, no delay (Leslie motion provides spatial cue).
 */
export const PRESET_ELECTRIC_ORGAN: SynthPreset = {
  name: "electric-organ",
  label: "Electric Organ",

  osc1Type: "periodic",
  osc2Type: "sine",
  osc1Gain: 0.18,
  osc2Gain: 0.0,
  detuneCents: 0,
  periodicWavePartials: ELECTRIC_ORGAN_PARTIALS,

  filterCutoff: 3200,
  filterQ: 0.6,

  attackTime: 0.006,
  decayTime: 0.02,
  sustainLevel: 0.95,
  releaseTime: 0.03,

  lfo: {
    rate: 0.8,
    depth: 4,
    target: "pitch",
  },
};

/**
 * Glass Harmonica — sine+sine with wide detune.
 * Pure, hollow, shimmering with subtle pitch vibrato and light delay.
 */
export const PRESET_GLASS: SynthPreset = {
  name: "glass",
  label: "Glass Harmonica",

  osc1Type: "sine",
  osc2Type: "sine",
  osc1Gain: 0.12,
  osc2Gain: 0.12,
  detuneCents: 8,

  filterCutoff: 3600,
  filterQ: 1.05,

  attackTime: 0.28,
  decayTime: 0.9,
  sustainLevel: 0.65,
  releaseTime: 1.6,

  lfo: {
    rate: 0.25,
    depth: 3,
    target: "pitch",
  },

  delay: {
    time1: 0.038,
    feedback1: 0.22,
    damping1: 5200,
    wet: 0.14,
    dry: 0.86,
  },
};

// ── Preset Registry ──────────────────────────────────────────────────

/** All available presets in display order. */
export const ALL_PRESETS: readonly SynthPreset[] = [
  PRESET_CLASSIC,
  PRESET_WARM_PAD,
  PRESET_BREATHING_PAD,
  PRESET_CATHEDRAL,
  PRESET_ELECTRIC_ORGAN,
  PRESET_GLASS,
];

/** Default preset for new sessions. */
export const DEFAULT_PRESET: SynthPreset = PRESET_CLASSIC;

/** Look up a preset by name. Returns undefined if not found. */
export function getPresetByName(name: string): SynthPreset | undefined {
  return ALL_PRESETS.find((p) => p.name === name);
}

// ── PeriodicWave Cache ───────────────────────────────────────────────

/**
 * WeakMap cache for PeriodicWave objects keyed by AudioContext.
 * Each AudioContext has its own Map of preset name → PeriodicWave.
 * PeriodicWaves are built once per context and reused across voices.
 */
const waveCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();

/**
 * Get or create a PeriodicWave for a preset.
 * Returns null if the preset doesn't use periodic oscillators.
 *
 * @param ctx - AudioContext to create the wave for
 * @param preset - SynthPreset with periodicWavePartials
 * @returns PeriodicWave or null if preset has no partials
 */
export function getPeriodicWave(
  ctx: AudioContext,
  preset: SynthPreset,
): PeriodicWave | null {
  if (!preset.periodicWavePartials) {
    return null;
  }

  let cache = waveCache.get(ctx);
  if (!cache) {
    cache = new Map();
    waveCache.set(ctx, cache);
  }

  const key = preset.name;
  let wave = cache.get(key);
  if (!wave) {
    const n = preset.periodicWavePartials.length;
    const real = new Float32Array(n); // All zeros (cosine terms)
    const imag = new Float32Array(preset.periodicWavePartials as number[]);
    wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    cache.set(key, wave);
  }

  return wave;
}

/**
 * Check if a preset uses PeriodicWave oscillators.
 */
export function usesPeriodicWave(preset: SynthPreset): boolean {
  return preset.osc1Type === "periodic" || preset.osc2Type === "periodic";
}

/**
 * Check if a preset has delay effects.
 */
export function hasDelay(preset: SynthPreset): boolean {
  return preset.delay !== undefined;
}

/**
 * Check if a preset has LFO modulation.
 */
export function hasLfo(preset: SynthPreset): boolean {
  return preset.lfo !== undefined;
}

/**
 * Check if a preset has filter bloom automation.
 */
export function hasFilterBloom(preset: SynthPreset): boolean {
  return preset.filterBloom !== undefined;
}

/**
 * Validate preset gain staging.
 * Returns true if 4 simultaneous voices won't clip.
 */
export function validateGainStaging(preset: SynthPreset): boolean {
  const perVoiceSum = preset.osc1Gain + preset.osc2Gain;
  const fourVoicesPeak = perVoiceSum * 4;
  return fourVoicesPeak < 1.0;
}
