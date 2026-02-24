# DEVPLAN — Phase 3d: Synthesis Preset Exploration

Module: Audio Engine (cross-cutting with Integration)
Parent: MVP_POLISH/DEVPLAN.md §Phase 3d
DEVLOG: AUDIO_ENGINE/DEVLOG_3D.md
References: AUDIO_ENGINE/SOUND_SCULPTING.md, AUDIO_ENGINE/SOUND_SCULPTING_1.md
Date: 2026-02-24

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

**Phase:** Step 2 — A/B listening evaluation.
**Focus:** User testing 6 presets, identifying keepers/problems.
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

  // Output level trim (optional, default 1.0)
  readonly outputGain?: number;
}
```

**`outputGain`** (optional): Post-mix level trim applied after oscillator sum, before effects chain. Allows level-matching presets without changing oscillator balance ratios. Default 1.0. Use during Step 2 listening if presets feel unbalanced.

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
| osc1Gain | 0.12 |
| osc2Gain | 0.12 |
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

Each preset's `osc1Gain + osc2Gain` sum is tuned so that 4 simultaneous voices don't clip. The constraint is: `(osc1Gain + osc2Gain) × 4 < 1.0`.

| Preset | Per-voice sum | 4 voices peak |
|--------|---------------|---------------|
| Classic | 0.12 + 0.12 = 0.24 | 0.96 ✓ |
| Warm Pad | 0.10 + 0.07 = 0.17 | 0.68 ✓ |
| Breathing Pad | (same as Warm Pad) | 0.68 ✓ |
| Cathedral | 0.14 + 0.08 = 0.22 | 0.88 ✓ |
| Electric Organ | 0.18 + 0.00 = 0.18 | 0.72 ✓ |
| Glass | 0.12 + 0.12 = 0.24 | 0.96 ✓ |

**Note:** The current synth.ts uses a shared `mixGain = 0.24` node for both oscillators. The preset system splits this into per-oscillator gains (0.12 + 0.12 for Classic) to allow presets with asymmetric oscillator levels.

---

## Level Balancing (Exploration Topic)

The per-voice sums vary across presets (0.17 to 0.24), which may cause perceived loudness differences when switching presets. This is intentional headroom for:

1. **Effects wet signal** — presets with delay add 14–22% wet on top of dry
2. **Envelope sustain differences** — sustainLevel ranges from 0.65 (Glass) to 0.95 (Electric Organ)
3. **Timbre-dependent perception** — sawtooth/organ harmonics sound louder than sine at equal amplitude

**Possible approaches (evaluate during Step 2 listening):**

| Approach | Pros | Cons |
|----------|------|------|
| **`outputGain` per preset** | Clean separation of timbre vs level; easy A/B tuning | Manual tuning per preset |
| **DynamicsCompressorNode as limiter** | Automatic peak control; masks clipping | Adds 1 global node; doesn't address root gain balance; may color sound |
| **Normalize to equal loudness (LUFS)** | Perceptually matched | Requires measurement; complex |

**Prior discussion:** `DynamicsCompressorNode` was considered as a crackling mitigation for budget tablets but deferred (see `MVP_POLISH/DEVLOG.md` Entry 21). The `SOUND_SCULPTING_1.md` reference notes that gains are conservative because there's no compressor in the node budget.

**Recommendation:** Start with `outputGain = 1.0` for all presets. During Step 2 listening, if presets feel unbalanced, adjust `outputGain` values. If clipping persists despite conservative gains (especially on mobile), reconsider adding a `DynamicsCompressorNode` as a safety limiter at the end of the effects chain.

---

## Test Strategy

- Existing synth/scheduler/immediate-playback tests continue passing (backward compat via `PRESET_CLASSIC` default)
- New `presets.test.ts`: validate all preset objects have required fields, gain staging within limits ✅
- New `effects.test.ts`: delay chain creation, reconfigure, bypass (no delay) ✅
- `createVoice` with each preset type: periodic wave, sub osc, filter bloom, LFO — verify nodes created without error
- Integration: preset change mid-session doesn't crash; voices created after change use new preset

---

## Step 2: Listen & Refine (A/B Testing)

**Work Regime:** Refine (human-evaluable). Correctness requires subjective judgment — no automated tests can verify "sounds good."

**Status:** In progress. Initial evaluation complete. Two issues identified, fixes planned.

### Initial Evaluation Results

**Issues Found:**

| # | Issue | Severity | Affected Presets | Planned Fix |
|---|-------|----------|------------------|-------------|
| 1 | Loop start crackle/pop | High | All (worst: Glass) | DynamicsCompressorNode (AE-D17) |
| 2 | Staccato endings too abrupt | Medium | All | Increase stop fade 10ms → 50ms (AE-D18) |

**Preset Verdicts (preliminary):**

| Preset | Verdict | Notes |
|--------|---------|-------|
| Classic | Keep | Clean baseline |
| Warm Pad | Keep | Pleasant warm wash |
| Breathing Pad | Keep | Organic filter LFO motion |
| Cathedral Organ | Keep | Chiff articulation effective |
| Electric Organ | Keep | Subtle Leslie wobble |
| Glass Harmonica | Keep | Ethereal, but worst loop crackle (long release) |

**Preliminary conclusion:** All 6 presets are musically useful. No removals planned. Final verdict pending after fixes applied.

### Issue 1: Loop Start Crackle/Pop

**Symptom:** Audible crackle at the moment a looped progression restarts. Glass Harmonica is worst despite being the quietest preset.

**Root cause analysis:**

When loop restarts:
1. Last chord's voices are in release phase (up to 1.6s for Glass)
2. Delay effects continue echoing
3. New scheduler starts immediately → new voices attack
4. Sum of (old release tails) + (delay echo) + (new attack) > 1.0
5. Clipping → crackle

**Evidence:** Long-release presets (Glass 1.6s, Warm/Breathing 1.4s) exhibit worse crackling than short-release presets (Cathedral 80ms, Electric 30ms).

**Decision: AE-D17 — DynamicsCompressorNode as safety limiter**

```
AE-D17: Add DynamicsCompressorNode at end of effects chain
Date: 2026-02-24
Status: Open → Closed (pending implementation)
Priority: High
Decision:
Insert a DynamicsCompressorNode after effectsChain.output, before ctx.destination.
Acts as a brickwall limiter to catch transient peaks from loop transitions,
preset switching, or any other unforeseen gain spikes.
Rationale:
- Hard-stopping voices at loop restart would create audible gap
- Compressor catches peaks automatically without audible artifacts
- Also provides safety net for future changes
- +1 global node (max 37 < 40 budget)
Parameters: threshold -6dB, knee 6dB, ratio 12:1, attack 3ms, release 100ms
Revisit if: Compressor causes audible pumping/breathing on sustained chords
```

### Issue 2: Staccato Endings Too Abrupt

**Symptom:** In Staccato mode, chord endings sound like hard cuts rather than musical note endings.

**Root cause:** Current `voice.stop()` uses 10ms fade-out (AE-D14). 10ms is imperceptible as a decay.

**Decision: AE-D18 — Increase stop fade-out to 50ms**

```
AE-D18: Increase voice.stop() fade-out from 10ms to 50ms
Date: 2026-02-24
Status: Open → Closed (pending implementation)
Priority: Medium
Decision:
Change STOP_FADE_TIME constant in synth.ts from 0.01 to 0.05 seconds.
Rationale:
- 50ms is audible as a short decay (not a click)
- Still short enough to maintain rhythmic separation
- At 180 BPM: beat = 333ms, 50ms = 15% of beat (acceptable)
- At 120 BPM: beat = 500ms, 50ms = 10% of beat (comfortable)
Revisit if: Fast-tempo progressions sound smeared
```

### Implementation Plan

| Task | File(s) | Change |
|------|---------|--------|
| Add compressor | `effects.ts` | Create compressor node, insert after output, before destination |
| Expose compressor | `effects.ts` | Add to EffectsChain interface (optional, for testing) |
| Update mock | `web-audio-mock.ts` | Add `MockDynamicsCompressorNode`, `createDynamicsCompressor()` |
| Increase fade | `synth.ts` | `STOP_FADE_TIME = 0.05` (was 0.01) |
| Tests | `effects.test.ts` | Verify compressor node created and connected |

### Goals

1. **Identify keepers** — which presets are musically useful and worth keeping?
2. **Identify problems** — clipping, artifacts, unbalanced levels, unpleasant timbres
3. **Tune parameters** — adjust preset values based on listening feedback
4. **Decide survivors** — at least 2 presets must survive; losers are removed in Step 3

### Evaluation Criteria

For each preset, evaluate on these dimensions:

| Dimension | Good | Bad |
|-----------|------|-----|
| **Timbre** | Pleasant, appropriate for harmonic exploration | Harsh, fatiguing, or inappropriate |
| **Attack** | Clear chord onset, appropriate for tempo range | Too abrupt (clicks) or too slow (mushy) |
| **Release** | Clean decay, no artifacts | Clicks, pops, or abrupt cutoff |
| **Level balance** | Similar perceived loudness to other presets | Noticeably louder/quieter than others |
| **Delay/effects** | Adds depth without muddying | Overwhelming, distracting, or inaudible |
| **LFO** | Subtle motion, enhances sound | Distracting wobble or imperceptible |
| **Playback modes** | Works well in both Staccato and Legato | Broken in one mode |

### Test Protocol

1. **Interactive exploration** — click triangles, edges; hold chords; drag to pan
2. **Progression playback** — load a library progression, play at various tempos (60–180 BPM)
3. **Mode comparison** — test both Staccato and Legato modes
4. **A/B comparison** — switch between presets while same progression plays

### Feedback Template

After listening to each preset, record observations using this format:

```
### [Preset Name]

**Verdict:** Keep | Tune | Remove

**Observations:**
1. [First issue/observation — highest priority]
2. [Second issue]
3. ...

**Parameter adjustments (if Tune):**
- [parameter]: [current] → [proposed]

**Comparison notes:**
- vs Classic: [better/worse/different at X]
- vs [other preset]: [notes]
```

### Iteration Protocol

Per GOVERNANCE.md Refine Feedback Loop:

1. **Show** — run app, select preset, play chords/progression
2. **React** — human lists observations (order = priority)
3. **Triage** — classify each:
   - **Fix now** — parameter tweak, apply immediately
   - **Fix later** — log for batch adjustment
   - **Needs decision** — design question (e.g., "should Cathedral have reverb instead of delay?")
4. **Adjust** — implement "fix now" items, update preset definition
5. **Repeat** — until human declares acceptable or remaining items are deferred

### Time Budget

Step 2 is time-boxed to **one session**. If presets cannot be tuned to satisfaction within the session, defer remaining issues to Step 3 or a future phase.

### Presets to Evaluate

| # | Preset | Key Features | Expected Use Case |
|---|--------|--------------|-------------------|
| 1 | Classic | Baseline tri+sine | Reference comparison |
| 2 | Warm Pad | Saw+tri, filter bloom, delay | Slow ambient exploration |
| 3 | Breathing Pad | Warm Pad + filter LFO | Organic, evolving pads |
| 4 | Cathedral Organ | Periodic wave, sub, dual delay, chiff | Dramatic, organ-like |
| 5 | Electric Organ | Periodic drawbars, pitch LFO | B3/Leslie character |
| 6 | Glass Harmonica | Sine+sine, wide detune, pitch vibrato | Ethereal, crystalline |

---

## Step 3: Lock & Clean

**Work Regime:** Build. Mechanical cleanup based on Step 2 decisions.

### Tasks

1. Remove eliminated presets from `presets.ts` and `ALL_PRESETS`
2. Update tests to reflect final preset count
3. If only 1 preset survives, remove dropdown UI (hardcode preset)
4. If 2+ survive, keep dropdown as permanent feature
5. Update ARCH_AUDIO_ENGINE.md with final preset list
6. Documentation pass: remove exploration artifacts from DEVPLAN
