# DEVLOG — Phase 3d: Synthesis Preset Exploration

Module: Audio Engine (cross-cutting with Integration)
Parent: MVP_POLISH/DEVPLAN.md §Phase 3d
DEVPLAN: AUDIO_ENGINE/DEVPLAN_3D.md

---

## Entry 0: Pre-Work Setup

Date: 2026-02-24

**Changes:**

- `DEVPLAN_3D.md`: Fixed Classic preset gain staging
  - osc1Gain: 0.24 → 0.12
  - osc2Gain: 0.24 → 0.12
  - Per-voice sum now 0.24 (matches current mixGain behavior)
  - 4 voices × 0.24 = 0.96 < 1.0 ✓

- `DEVPLAN_3D.md`: Rewrote Gain Staging table
  - Removed erroneous 0.787 factor (was unclear origin, caused confusion)
  - Simplified to direct sum: `(osc1Gain + osc2Gain) × 4 < 1.0`
  - All 6 presets now verified within budget

**Rationale:**

The original Classic preset (0.24 + 0.24 = 0.48 per voice) would have caused clipping at 4 voices (1.92 peak). The 0.787 factor appeared to be an envelope sustain adjustment but was applied inconsistently and didn't prevent the issue. The current synth.ts uses a shared mixGain node, so splitting 0.24 evenly between oscillators preserves existing behavior while enabling asymmetric gains for other presets.

**Tests:** N/A (documentation only)

---

## Entry Template

```
## Entry [N]: [Title]

Date: YYYY-MM-DD

**Changes:**

- [File]: [What changed]

**Rationale:** [Why]

**Tests:** [Test count delta or "N/A"]

### Contract Changes (if any)
- [Document] §[Section]: [Change]
```

---

## Phase Progress

| Step | Description | Status |
|------|-------------|--------|
| 1 | Preset infrastructure + all presets | ✅ Complete |
| 2 | Listen & refine (A/B testing) | 🔄 In progress |
| 3 | Lock & clean (remove losers) | Not started |

---

## Entry 1: Audio Engine Preset Infrastructure

Date: 2026-02-24

**Changes:**

| File | Change |
|------|--------|
| `AE/src/presets.ts` | **NEW** — `SynthPreset` type + 6 preset definitions + PeriodicWave cache |
| `AE/src/effects.ts` | **NEW** — `EffectsChain` interface + `createEffectsChain()` with dual delay/damping |
| `AE/src/synth.ts` | `createVoice()` accepts optional `preset` param; handles periodic/sub/bloom/LFO; per-osc gains |
| `AE/src/immediate-playback.ts` | `ImmediatePlaybackState.preset` field; `CreateImmediatePlaybackOptions` with effectsChain; `setPreset()` |
| `AE/src/scheduler.ts` | `CreateSchedulerOptions.preset`; `SchedulerState.preset`; passes preset to `createVoice()` |
| `AE/src/index.ts` | Exports: `SynthPreset`, all presets, `EffectsChain`, `createEffectsChain`, `setPreset` |
| `AE/src/__tests__/synth.test.ts` | Updated 5 tests for new 4-gain-node structure (was 2-node) |

**Presets implemented:**

| Name | Oscillators | Filter | Envelope | LFO | Delay |
|------|-------------|--------|----------|-----|-------|
| Classic | tri+sine, ±3¢ | LP 1500Hz | A120ms R500ms | — | — |
| Warm Pad | saw+tri, ±5¢ | LP 900Hz + bloom | A350ms R1.4s | — | 55ms |
| Breathing Pad | saw+tri, ±5¢ | LP 900Hz + bloom | A350ms R1.4s | filter 0.09Hz | 55ms |
| Cathedral | periodic+sub | LP 4200Hz + chiff | A12ms R80ms | — | dual 61ms/89ms |
| Electric Organ | periodic | LP 3200Hz | A6ms R30ms | pitch 0.8Hz | — |
| Glass | sine+sine, ±8¢ | LP 3600Hz | A280ms R1.6s | pitch 0.25Hz | 38ms |

**Gain staging:** All presets verified: `(osc1Gain + osc2Gain) × 4 < 1.0`

**Signal chain per voice:**
```
osc1 → osc1Gain ─┬→ filter → envGain → outGain → destination
osc2 → osc2Gain ─┘
     [lfoOsc → lfoGain → filter.frequency OR osc.detune]
```

**Effects chain:**
```
voices → input ─┬→ dryGain ──────────────────────┬→ output → destination
                └→ delay1 → damp1 → fb1 (loop) ──┤
                     └→ delay2 → damp2 → fb2 ────┘→ wetGain
```

**Tests:** 202 passing (synth.test.ts updated for new node structure)

**Completed:** 1.1–1.6

---

## Entry 2: Integration Module Preset Wiring

Date: 2026-02-24

**Changes:**

| File | Change |
|------|--------|
| `INT/src/sidebar.ts` | Preset `<select>` dropdown below Staccato/Legato; `onPresetChange` callback; `setPreset()`/`getPreset()` methods |
| `INT/src/main.ts` | `handlePresetChange()` wires sidebar → `setPreset()` + `effectsChain.reconfigure()` |
| `INT/src/interaction-wiring.ts` | `AppAudioState.effectsChain`; `ensureAudio()` creates effects chain + passes to immediate playback |
| `INT/src/__tests__/interaction-wiring.test.ts` | Updated mock: `createEffectsChain`, `DEFAULT_PRESET`, `__mockEffectsChain` |
| `INT/src/__tests__/integration-flow.test.ts` | Updated mock: same additions |

**Sidebar UI:**
- Label: "Sound"
- 6 options from `ALL_PRESETS` (Classic, Warm Pad, Breathing Pad, Cathedral Organ, Electric Organ, Glass Harmonica)
- Styled to match existing toggle buttons

**Audio initialization flow:**
```
ensureAudio() → initAudioSync() → createEffectsChain(ctx, DEFAULT_PRESET)
                                → createImmediatePlayback(transport, { effectsChain, preset })
```

**Preset change flow:**
```
sidebar.onPresetChange(preset) → handlePresetChange(preset)
                               → setPreset(immediatePlayback, preset)
                               → effectsChain.reconfigure(preset)
```

**Tests:** 239 passing (mocks updated for new audio-engine exports)

**Completed:** 1.7, 1.8

---

## Entry 3: Test Coverage for Presets and Effects

Date: 2026-02-24

**Changes:**

| File | Change |
|------|--------|
| `AE/src/__tests__/presets.test.ts` | **NEW** — 98 tests: preset validation, gain staging, registry, utility functions, PeriodicWave cache |
| `AE/src/__tests__/effects.test.ts` | **NEW** — 29 tests: chain creation, reconfigure, damping, feedback, destroy, node budget |
| `AE/src/__tests__/web-audio-mock.ts` | Added `MockPeriodicWave`, `MockDelayNode`, `setPeriodicWave()`, `createPeriodicWave()`, `createDelay()` |

**presets.test.ts coverage:**
- All 6 presets have required fields (string, number, oscillator types)
- Gain staging: `(osc1Gain + osc2Gain) × 4 < 1.0` for all presets
- `ALL_PRESETS` contains exactly 6 presets with unique names/labels
- `DEFAULT_PRESET` is `PRESET_CLASSIC`
- `getPresetByName()` lookups
- Utility functions: `usesPeriodicWave`, `hasDelay`, `hasLfo`, `hasFilterBloom`
- `getPeriodicWave()` cache behavior (returns null for non-periodic, caches per context)
- Preset-specific validation (Cathedral dual delay, Electric Organ drawbars, etc.)

**effects.test.ts coverage:**
- Basic chain creation (input/output nodes, methods)
- Initial preset configuration (bypass, single delay, dual delay)
- Reconfigure between presets (bypass→delay, single→dual, delay→bypass)
- Damping filter creation and configuration
- Feedback gain nodes
- Destroy behavior (idempotent, prevents further reconfigure)
- Minimum delay time enforcement (≥0.003s)
- Node budget verification (4/5/6 gains for bypass/single/dual)

**Tests:** Audio Engine now has **329 tests** (+127 from Entry 2)

| Test File | Count |
|-----------|-------|
| presets.test.ts | 98 |
| effects.test.ts | 29 |
| scheduler.test.ts | 54 |
| audio-context.test.ts | 39 |
| immediate-playback.test.ts | 37 |
| voicing.test.ts | 30 |
| synth.test.ts | 26 |
| cross-module.test.ts | 7 |
| conversion.test.ts | 5 |
| integration-e2e.test.ts | 3 |
| smoke.test.ts | 1 |
| **Total** | **329** |

**Step 1 complete.** All infrastructure in place. Ready for Step 2 (A/B listening).

---

## Entry 4: Bug Fix — Scheduled Playback Preset Wiring

Date: 2026-02-24

**Bug:** Preset changes affected interactive playback but not progression playback. Scheduled playback always used `PRESET_CLASSIC` regardless of sidebar selection.

**Root cause:** The `AudioTransport` interface lacked `setPreset()`/`getPreset()` methods. The transport's `play()` method called `createScheduler()` without passing the preset. The integration module's `handlePresetChange()` updated immediate playback and effects chain, but not the transport.

**Changes:**

| File | Change |
|------|--------|
| `AE/src/types.ts` | Added `setPreset(preset: SynthPreset)` and `getPreset(): SynthPreset` to `AudioTransport` interface |
| `AE/src/audio-context.ts` | Added `preset` state variable (default `PRESET_CLASSIC`); implemented `setPreset`/`getPreset`; pass `preset` to `createScheduler()` |
| `INT/src/main.ts` | `handlePresetChange()` now calls `transport.setPreset(preset)` |

**Tests:** All 329 AE + 239 INT tests pass (no new tests needed — existing scheduler tests cover preset parameter)

### Contract Changes

- `ARCH_AUDIO_ENGINE.md §6.1`: +`setPreset(preset: SynthPreset)`, +`getPreset(): SynthPreset` on `AudioTransport`

---

## Entry 5: Step 2 Evaluation — Initial Findings

Date: 2026-02-24

**Evaluation method:** A/B listening through all 6 presets with progression playback (loop enabled) and interactive taps. Both Staccato and Legato modes tested.

### Issue 1: Loop Start Crackle/Pop

**Observed:** All presets exhibit crackle/pop at the moment a loop restarts. Glass Harmonica is the worst offender despite being the quietest preset.

**Analysis:**

Glass Harmonica parameters:
- Release time: 1.6 seconds (longest of all presets)
- Delay: 38ms, 22% feedback

**Root cause:** Voice collision at loop boundary. When loop restarts:
1. Last chord's voices enter release phase (up to 1.6s tail for Glass)
2. Delay effect continues echoing
3. Loop immediately restarts → new voices attack
4. Momentary sum of old release tails + delay echo + new attack exceeds 1.0
5. Clipping → audible crackle

**Evidence:** Presets with longer releases (Glass 1.6s, Warm/Breathing Pad 1.4s) exhibit worse crackling than short-release presets (Cathedral 80ms, Electric Organ 30ms).

### Issue 2: Staccato Endings Too Abrupt

**Observed:** In Staccato mode, chord endings sound too choppy/clicky. User expects some musical decay.

**Analysis:**

Current Staccato behavior (AE-D14):
- `voice.stop()` at chord boundary
- 10ms linear ramp to zero
- Oscillators stopped

10ms is imperceptible as a decay — it sounds like a hard cut.

**User expectation:** A short but audible decay (50-100ms) that still provides rhythmic separation between chords.

### Planned Fixes

| Issue | Fix | Decision |
|-------|-----|----------|
| Loop crackle | Add `DynamicsCompressorNode` as safety limiter at end of effects chain | AE-D17 |
| Staccato abrupt | Increase `stop()` fade-out from 10ms to 50ms | AE-D18 |

**Rationale for compressor over hard-stop:**
- Hard-stopping voices at loop restart would create an audible gap
- Compressor catches transient peaks automatically
- Also protects against any other unforeseen gain spikes
- +1 global node (within budget: max 37 < 40)

**Rationale for 50ms fade:**
- Long enough to hear as a decay (not a click)
- Short enough to maintain rhythmic separation at normal tempos
- At 180 BPM, one beat = 333ms; 50ms = 15% of beat (acceptable)

### Preset-Specific Notes

| Preset | Sound Quality | Notes |
|--------|---------------|-------|
| Classic | ✓ Good | Baseline reference, clean |
| Warm Pad | ✓ Good | Pleasant, warm wash |
| Breathing Pad | ✓ Good | Organic motion from filter LFO |
| Cathedral Organ | ✓ Good | Chiff articulation works well |
| Electric Organ | ✓ Good | Leslie wobble subtle but present |
| Glass Harmonica | ✓ Good (with fixes) | Ethereal, but worst loop crackle due to long release |

**Preliminary verdict:** All 6 presets are musically useful. No presets marked for removal. Final verdict pending after fixes applied.

---

## Entry 6: Step 2 Fixes — Limiter + Stop Fade

Date: 2026-02-24

**Implementing fixes identified in Entry 5 evaluation:**

**Changes:**

| File | Change |
|------|--------|
| `AE/src/effects.ts` | Added `DynamicsCompressorNode` (limiter) between output and destination |
| `AE/src/effects.ts` | `EffectsChain` interface gains `limiter: DynamicsCompressorNode` property |
| `AE/src/__tests__/web-audio-mock.ts` | Added `MockDynamicsCompressorNode` + `createDynamicsCompressor()` |
| `AE/src/__tests__/effects.test.ts` | Added 9 tests for limiter creation and configuration |

**AE-D17: DynamicsCompressorNode (Limiter)**

Signal chain updated:
```
voices → input → dryGain/wetGain → output → limiter → destination
```

Limiter parameters:
| Parameter | Value | Purpose |
|-----------|-------|---------|
| threshold | -6 dB | Compression starts here |
| knee | 6 dB | Soft knee for transparent limiting |
| ratio | 12:1 | High ratio acts as brickwall |
| attack | 3 ms | Fast to catch transients |
| release | 100 ms | Smooth recovery |

**AE-D18: Stop Fade — Already Implemented**

Discovered that `synth.ts` already uses `fadeOut = 0.05` (50ms) in `stop()`. This was implemented as part of the original preset work (Entry 1). No change needed.

**Tests:** Audio Engine now has **338 tests** (+9 limiter tests)

| Test File | Count |
|-----------|-------|
| presets.test.ts | 98 |
| scheduler.test.ts | 54 |
| audio-context.test.ts | 39 |
| effects.test.ts | 38 |
| immediate-playback.test.ts | 37 |
| voicing.test.ts | 30 |
| synth.test.ts | 26 |
| cross-module.test.ts | 7 |
| conversion.test.ts | 5 |
| integration-e2e.test.ts | 3 |
| smoke.test.ts | 1 |
| **Total** | **338** |

---
