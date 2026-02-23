# DEVPLAN — Phase 3d: Synthesis Preset Exploration

Module: Audio Engine (cross-cutting with Integration)
Parent: MVP_POLISH/DEVPLAN.md §Phase 3d
References: AUDIO_ENGINE/SOUND_SCULPTING.md, AUDIO_ENGINE/SOUND_SCULPTING_1.md

---

## Cold Start Summary

**What this is:** Preset-toggle system for A/B testing 6 baked sound presets. User picks favorites; losers are discarded. The dropdown UI is temporary scaffolding that stays if 2+ presets survive.

**Key constraints:**
- No changes to `VoiceHandle` interface — release/cancelRelease/stop unchanged
- Node budget: ≤8 per voice × 4 voices + ≤8 global
- Per-voice gain ≤0.24 (AE-D16)
- Presets are static objects — no runtime user-adjustable knobs

**Gotchas:**
- `createVoice()` is called from `immediate-playback.ts` (2×) and `scheduler.ts` (2×) — all 4 call sites must pass the preset
- `PeriodicWave` must be created from an `AudioContext` — build once at init, not per voice
- Global delay feedback loop requires `delayTime` ≥ one render quantum (~2.9ms)
- Scheduler's `scheduleChordVoices()` creates voices at future `slot.startTime` — filter bloom and LFO must work with scheduled `when` parameter
- The `stop()` fade-out (50ms) and `release()` cleanup must disconnect LFO nodes too

---

## Current Status

**Phase:** Not started.
**Blocked/Broken:** None.

---

## SynthPreset Type

```ts
interface SynthPreset {
  readonly name: string;
  readonly label: string;

  // Oscillators
  readonly osc1Type: OscillatorType | "periodic";
  readonly osc2Type: OscillatorType | "periodic" | "sub";
  readonly osc1Gain: number;
  readonly osc2Gain: number;
  readonly detuneCents: number;
  readonly periodicWavePartials?: readonly number[];

  // Filter
  readonly filterCutoff: number;
  readonly filterQ: number;
  readonly filterBloom?: {
    readonly start: number;
    readonly peak: number;
    readonly settle: number;
    readonly timeConstant: number;
  };

  // Envelope
  readonly attackTime: number;
  readonly decayTime: number;
  readonly sustainLevel: number;
  readonly releaseTime: number;

  // LFO (omit for no modulation)
  readonly lfo?: {
    readonly rate: number;
    readonly depth: number;
    readonly target: "filter" | "pitch";
  };

  // Global delay (omit for dry)
  readonly delay?: {
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
  };
}
```

**"periodic"** osc type: `createVoice` builds a `PeriodicWave` from `periodicWavePartials` and sets it on the oscillator. The wave is built once per `AudioContext` and cached (not per voice).

**"sub"** osc2 type: oscillator frequency = `noteHz / 2` (sub-octave). Standard OscillatorType otherwise (`"sine"` implied).

**Filter bloom:** If present, `createVoice` schedules `filter.frequency` automation alongside the ADSR: `setValueAtTime(start)` → `linearRampToValueAtTime(peak)` → `setTargetAtTime(settle, timeConstant)`.

**LFO target "filter":** modulates `filter.frequency` AudioParam. Target "pitch": modulates both `osc1.detune` and `osc2.detune` AudioParams (depth in cents for pitch, Hz for filter).

---

## Preset Definitions

### 1. Classic (baseline)

Current sound, unchanged. Serves as comparison reference.

| Parameter | Value |
|-----------|-------|
| osc1Type | `"triangle"` |
| osc2Type | `"sine"` |
| osc1Gain | 0.24 |
| osc2Gain | 0.24 |
| detuneCents | 3 |
| filterCutoff | 1500 |
| filterQ | 1.0 |
| attackTime | 0.12 |
| decayTime | 0.2 |
| sustainLevel | 0.7 |
| releaseTime | 0.5 |
| lfo | none |
| delay | none |

Nodes/voice: 5. Global: 0.

### 2. Warm Pad

Saw+triangle with lower cutoff and filter bloom. Warm, muffled, slow washes.

| Parameter | Value |
|-----------|-------|
| osc1Type | `"sawtooth"` |
| osc2Type | `"triangle"` |
| osc1Gain | 0.10 |
| osc2Gain | 0.07 |
| detuneCents | 5 |
| filterCutoff | 900 |
| filterQ | 0.85 |
| filterBloom | start: 550, peak: 1250, settle: 900, timeConstant: 0.35 |
| attackTime | 0.35 |
| decayTime | 0.6 |
| sustainLevel | 0.78 |
| releaseTime | 1.4 |
| lfo | none |
| delay | time1: 0.055, feedback1: 0.33, damping1: 2400, wet: 0.16, dry: 0.84 |

Nodes/voice: 6 (2 osc + 2 oscGain + filter + envGain). Global: 4 (delay + dampLP + fbGain + wetGain).

### 3. Breathing Pad

Same as Warm Pad + slow LFO on filter cutoff. Organic breathing motion.

| Parameter | Value |
|-----------|-------|
| (same as Warm Pad except:) | |
| lfo | rate: 0.09, depth: 120, target: `"filter"` |

Nodes/voice: 8 (Warm Pad 6 + lfoOsc + lfoDepthGain). Global: 4.

### 4. Cathedral Organ

PeriodicWave warm principals + sine sub-octave + dual feedback delay bloom. Near-instant attack.

| Parameter | Value |
|-----------|-------|
| osc1Type | `"periodic"` |
| osc2Type | `"sub"` |
| osc1Gain | 0.14 |
| osc2Gain | 0.08 |
| detuneCents | 0 |
| periodicWavePartials | [0, 1.00, 0.42, 0.18, 0.10, 0.06, 0.05, 0, 0.03] |
| filterCutoff | 4200 |
| filterQ | 0.75 |
| filterBloom | start: 4200, peak: 6200, settle: 4200, timeConstant: 0.03 |
| attackTime | 0.012 |
| decayTime | 0.05 |
| sustainLevel | 0.9 |
| releaseTime | 0.08 |
| lfo | none |
| delay | time1: 0.061, feedback1: 0.33, damping1: 2900, time2: 0.089, feedback2: 0.28, damping2: 2400, wet: 0.22, dry: 0.78 |

Nodes/voice: 6 (2 osc + 2 oscGain + filter + envGain). Global: 8 (2× delay + 2× dampLP + 2× fbGain + wetGain + dryGain).

The filterBloom here is the "chiff" — brief cutoff overshoot (4200→6200→4200 in 30ms) for pipe-speech articulation.

### 5. Electric Organ (B3/Leslie)

PeriodicWave drawbars at noteHz/2 + rotary LFO on pitch. Gate-like envelope. No delay (Leslie motion provides the spatial cue).

| Parameter | Value |
|-----------|-------|
| osc1Type | `"periodic"` |
| osc2Type | `"sine"` |
| osc1Gain | 0.18 |
| osc2Gain | 0.0 |
| detuneCents | 0 |
| periodicWavePartials | [0, 0.58, 0.95, 0.55, 0.62, 0, 0.28, 0, 0.24, 0, 0.16, 0, 0.12, 0, 0, 0, 0.08] |
| filterCutoff | 3200 |
| filterQ | 0.6 |
| attackTime | 0.006 |
| decayTime | 0.02 |
| sustainLevel | 0.95 |
| releaseTime | 0.03 |
| lfo | rate: 0.8, depth: 4, target: `"pitch"` |
| delay | none |

**Note:** osc frequency = noteHz/2 (the drawbar trick — partial 2 = unison, partial 1 = sub-octave 16'). This is triggered by the `"periodic"` type + partials array where the fundamental is at noteHz/2.

**Note:** LFO rate 0.8Hz = slow Leslie "chorale" mode. For the MVP preset, we bake in the slow mode. Fast mode (6.3Hz) would need a UI toggle — deferred.

Nodes/voice: 7 (1 osc + 1 oscGain + filter + envGain + lfoOsc + lfoDepthGain; osc2 unused at gain 0). Global: 0.

### 6. Glass Harmonica

Sine+sine with wide detune. Pure, hollow, shimmering. Subtle pitch vibrato + light delay.

| Parameter | Value |
|-----------|-------|
| osc1Type | `"sine"` |
| osc2Type | `"sine"` |
| osc1Gain | 0.12 |
| osc2Gain | 0.12 |
| detuneCents | 8 |
| filterCutoff | 3600 |
| filterQ | 1.05 |
| attackTime | 0.28 |
| decayTime | 0.9 |
| sustainLevel | 0.65 |
| releaseTime | 1.6 |
| lfo | rate: 0.25, depth: 3, target: `"pitch"` |
| delay | time1: 0.038, feedback1: 0.22, damping1: 5200, wet: 0.14, dry: 0.86 |

Nodes/voice: 7 (2 osc + 1 mixGain + filter + envGain + lfoOsc + lfoDepthGain). Global: 4.

---

## Implementation Plan

### File: `AUDIO_ENGINE/src/presets.ts` (new)

```ts
export interface SynthPreset { ... }  // type definition above

export const PRESET_CLASSIC: SynthPreset = { ... };
export const PRESET_WARM_PAD: SynthPreset = { ... };
export const PRESET_BREATHING_PAD: SynthPreset = { ... };
export const PRESET_CATHEDRAL: SynthPreset = { ... };
export const PRESET_ELECTRIC_ORGAN: SynthPreset = { ... };
export const PRESET_GLASS: SynthPreset = { ... };

export const ALL_PRESETS: readonly SynthPreset[] = [ ... ];
export const DEFAULT_PRESET = PRESET_CLASSIC;

// PeriodicWave cache (built once per AudioContext)
const waveCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();

export function getPeriodicWave(ctx: AudioContext, preset: SynthPreset): PeriodicWave | null {
  if (!preset.periodicWavePartials) return null;
  let cache = waveCache.get(ctx);
  if (!cache) { cache = new Map(); waveCache.set(ctx, cache); }
  const key = preset.name;
  let wave = cache.get(key);
  if (!wave) {
    const n = preset.periodicWavePartials.length;
    const real = new Float32Array(n);  // all zeros
    const imag = new Float32Array(preset.periodicWavePartials);
    wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    cache.set(key, wave);
  }
  return wave;
}
```

### File: `AUDIO_ENGINE/src/effects.ts` (new)

```ts
export interface EffectsChain {
  readonly input: GainNode;      // voices connect here
  readonly output: GainNode;     // connected to ctx.destination
  reconfigure(preset: SynthPreset): void;
  destroy(): void;
}

export function createEffectsChain(ctx: AudioContext): EffectsChain {
  // Builds dry/wet routing + delay feedback loop(s)
  // reconfigure() adjusts delay times, feedback, damping, wet/dry per preset
  // If preset has no delay, wet=0 dry=1 (bypass)
}
```

### File: `AUDIO_ENGINE/src/synth.ts` (modified)

- `createVoice()` gains optional `preset?: SynthPreset` parameter (defaults to `SYNTH_DEFAULTS`-equivalent `PRESET_CLASSIC`)
- Reads all parameters from preset instead of `SYNTH_DEFAULTS`
- Handles `"periodic"` osc type: `osc.setPeriodicWave(getPeriodicWave(ctx, preset))`
- Handles `"sub"` osc2 type: `osc2.frequency.value = freq / 2`
- Handles `filterBloom`: schedules `filter.frequency` automation
- Handles `lfo`: creates LFO oscillator + depth gain, connects to target param
- `disconnectAll()` updated to include LFO nodes
- `stop()` updated to stop LFO oscillator
- `SYNTH_DEFAULTS` preserved for backward compat (tests)

### File: `AUDIO_ENGINE/src/immediate-playback.ts` (modified)

- `ImmediatePlaybackState` gains `preset: SynthPreset` field (mutable — sidebar toggle changes it)
- `createImmediatePlayback()` gains `effectsChain: EffectsChain` parameter; voices connect to `effectsChain.input` instead of `masterGain`
- `playPitchClasses()` passes `state.preset` to `createVoice()`
- On preset change, `effectsChain.reconfigure(preset)` updates global delay

### File: `AUDIO_ENGINE/src/scheduler.ts` (modified)

- `CreateSchedulerOptions` gains `preset?: SynthPreset` field
- `SchedulerState.preset` stored for voice creation
- `scheduleChordVoices()` passes `preset` to `createVoice()`

### File: `AUDIO_ENGINE/src/index.ts` (modified)

- Export `SynthPreset`, `ALL_PRESETS`, `DEFAULT_PRESET`, `getPeriodicWave` from presets
- Export `EffectsChain`, `createEffectsChain` from effects

### File: `INTEGRATION/src/sidebar.ts` (modified)

- Add `<select>` dropdown below Staccato/Legato toggle in Play tab
- Options populated from `ALL_PRESETS` (label field)
- `onPresetChange(preset: SynthPreset)` callback
- `Sidebar.getPreset()` / `Sidebar.setPreset()` for state sync

### File: `INTEGRATION/src/main.ts` (modified)

- Create `EffectsChain` during audio init (once)
- Wire sidebar `onPresetChange` → `immediatePlaybackState.preset = preset` + `effectsChain.reconfigure(preset)`
- Pass `effectsChain` to `createImmediatePlayback()`
- Pass `preset` via `CreateSchedulerOptions` when scheduling playback

---

## Node Budget Summary

| Preset | Nodes/voice | Voices | Global | Total |
|--------|------------|--------|--------|-------|
| Classic | 5 | 4 | 0 | 20 |
| Warm Pad | 6 | 4 | 4 | 28 |
| Breathing Pad | 8 | 4 | 4 | 36 |
| Cathedral | 6 | 4 | 8 | 32 |
| Electric Organ | 7 | 4 | 0 | 28 |
| Glass | 7 | 4 | 4 | 32 |

All within the 40-node practical limit for mobile.

---

## Gain Staging

Each preset's `osc1Gain` + `osc2Gain` is tuned so that 4 simultaneous voices don't clip:

| Preset | Max per-voice peak | 4 voices peak |
|--------|-------------------|---------------|
| Classic | 0.24 × 2 × 0.787 = 0.38 | 1.51 → needs review |
| Warm Pad | (0.10 + 0.07) × 0.787 = 0.13 | 0.53 ✓ |
| Breathing Pad | same as Warm Pad | 0.53 ✓ |
| Cathedral | (0.14 + 0.08) × 0.787 = 0.17 | 0.69 ✓ |
| Electric Organ | 0.18 × 0.787 = 0.14 | 0.57 ✓ |
| Glass | (0.12 + 0.12) × 0.787 = 0.19 | 0.76 ✓ |

**Classic preset note:** The current design uses a shared `mixGain = 0.24` for both oscillators (not per-osc gains). This works because the old signal chain routes both oscs into one gain node. The preset system will use per-osc gains, so the Classic preset needs `osc1Gain = 0.12, osc2Gain = 0.12` (split evenly) to match the current behavior. Adjust if needed after listening.

---

## Test Strategy

- Existing synth/scheduler/immediate-playback tests continue passing (backward compat via `PRESET_CLASSIC` default)
- New `presets.test.ts`: validate all preset objects have required fields, gain staging within limits
- New `effects.test.ts`: delay chain creation, reconfigure, bypass (no delay)
- `createVoice` with each preset type: periodic wave, sub osc, filter bloom, LFO — verify nodes created without error
- Integration: preset change mid-session doesn't crash; voices created after change use new preset
