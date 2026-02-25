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

## Entry 5: PeriodicWave Lazy Caching

Date: 2026-02-24

**Changes:**

| File | Change |
|------|--------|
| `AE/src/presets.ts` | Lazy PeriodicWave creation via `getPeriodicWave()` — waves built on first use per AudioContext, cached in WeakMap |

**Rationale:**

PeriodicWave objects require an AudioContext to create. The `getPeriodicWave()` function creates waves lazily on first voice creation (not at module load), ensuring the context is available. A WeakMap keyed by AudioContext prevents memory leaks when contexts are garbage collected.

**Tests:** 329 AE tests pass (existing coverage sufficient)

---

## Entry 6: Limiter Implementation (AE-D17)

Date: 2026-02-25

**Issue:** Loop restart produced audible crackle/pop on first chord. Root cause: multiple voices starting simultaneously exceeded 0dB momentarily before envelope attack smoothed the level.

**Solution:** Added DynamicsCompressorNode as limiter in the effects chain output stage.

**Changes:**

| File | Change |
|------|--------|
| `AE/src/effects.ts` | Added `limiter` (DynamicsCompressorNode) between wetGain/dryGain sum and output; threshold -6dB, ratio 12:1, attack 0.003s, release 0.1s |
| `AE/src/__tests__/effects.test.ts` | +3 tests for limiter node presence and configuration |

**Decision:** AE-D17 (Limiter for loop start crackle)

**Signal chain update:**
```
voices → input ─┬→ dryGain ──────────────────────┬→ limiter → output → destination
                └→ delay1 → damp1 → fb1 (loop) ──┤
                     └→ delay2 → damp2 → fb2 ────┘→ wetGain
```

**Tests:** 332 AE tests pass (+3 limiter tests)

---

## Entry 7: Step 2 Completion — Preset Evaluation Results

Date: 2026-02-25

**Evaluation:** A/B listening through all 6 presets with progression playback (loop, various tempos) and interactive taps. Both Staccato and Legato modes tested.

**Verdicts:**

| Preset | Verdict | Notes |
|--------|---------|-------|
| Classic | **Rename → Soft Pad** | Sound is a soft synth pad, not piano-like. Name was misleading. |
| Warm Pad | Keep | Pleasant warm wash, good contrast with Soft Pad |
| Breathing Pad | **Remove** | Too similar to Warm Pad; filter LFO difference not worth the extra dropdown entry |
| Cathedral Organ | Keep | Chiff articulation effective, good for dramatic progressions |
| Electric Organ | Keep | Subtle Leslie wobble, distinct character |
| Glass Harmonica | **Remove** | Liked the sound but crackles even on desktop due to long release tails (1.6s). Simplicity wins. |

**Issues resolved in Entry 6:**
- Loop start crackle → DynamicsCompressorNode limiter (AE-D17) ✅
- Staccato endings → already 50ms fade (AE-D18) ✅

---

## Entry 8: Step 3 — Lock & Clean

Date: 2026-02-25

**Changes:**

| File | Change |
|------|--------|
| `AE/src/presets.ts` | Renamed `PRESET_CLASSIC` → `PRESET_SOFT_PAD`. Removed `PRESET_BREATHING_PAD` + `PRESET_GLASS`. `PRESET_CLASSIC` retained as deprecated alias. |
| `AE/src/presets.ts` | `ALL_PRESETS`: 6 → 4 entries |
| `AE/src/index.ts` | Exports: +`PRESET_SOFT_PAD`, −`PRESET_BREATHING_PAD`, −`PRESET_GLASS` |
| `AE/src/__tests__/presets.test.ts` | Updated: 98 → 74 tests (removed presets' tests removed) |
| `INT/src/__tests__/integration-flow.test.ts` | Mock: `"classic"` → `"soft-pad"` |
| `INT/src/__tests__/interaction-wiring.test.ts` | Mock: `"classic"` → `"soft-pad"` |

**Final preset lineup (4):**

| # | Name | Label | Character |
|---|------|-------|-----------|
| 1 | `soft-pad` | Soft Pad | Clean tri+sine baseline (default) |
| 2 | `warm-pad` | Warm Pad | Saw+tri, filter bloom, delay |
| 3 | `cathedral` | Cathedral Organ | PeriodicWave + sub + dual delay, chiff |
| 4 | `electric-organ` | Electric Organ | PeriodicWave drawbars + rotary LFO |

Dropdown UI kept (4 presets > 1).

**Tests:** AE 305, INT 239 — all passing.

**Phase 3d closed.** Revisitable if future listening reveals issues during normal use.

---

## Phase Progress

| Step | Description | Status |
|------|-------------|--------|
| 1 | Preset infrastructure + all presets | ✅ Complete (Entries 1–6) |
| 2 | Listen & refine (A/B testing) | ✅ Complete (Entry 7) |
| 3 | Lock & clean (remove losers) | ✅ Complete (Entry 8) |

**Phase 3d closed.** 4 presets ship. Revisitable if future listening reveals issues.

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
