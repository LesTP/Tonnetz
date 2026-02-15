# DEVLOG — Audio Engine

Module: Audio Engine
Started: 2026-02-14

---

## Entry 1 — Phase 0: Pre-Implementation Setup (Complete)

**Date:** 2026-02-14
**Mode:** Discuss

### Summary

Created module documentation (DEVPLAN.md, DEVLOG.md) per project governance. Reviewed architecture document (ARCH_AUDIO_ENGINE.md Draft 0.4) and cross-module dependencies with Rendering/UI.

### Context

Audio Engine is the third subsystem to begin development, after Harmony Core (complete) and Rendering/UI (MVP complete). Rendering/UI has deferred two items that are blocked on Audio Engine:

1. **Playback animation** — subscribe to `AudioTransport.onChordChange()`, call `PathHandle.setActiveChord()`
2. **Transport sync** — rAF loop with `AudioTransport.getTime()` for smooth path progress

The `AudioTransport` interface (ARCH_AUDIO_ENGINE.md §6) is the primary cross-module contract.

### Open Items

| Item | Status | Notes |
|------|--------|-------|
| AE-D2: Synthesis model | Open | Must resolve before Phase 1 coding |
| AE-D4: Drag debounce timing | Tentative | Needs interaction testing data |
| HC dependency setup | Pending | Follow RU pattern: `"harmony-core": "file:../HARMONY_CORE"` |
| Test framework | Pending | Vitest assumed (consistent with HC and RU) |

### Architecture Observations

- The public API (§6) defines three interface groups:
  1. `AudioTransport` — transport timebase, state queries, playback control, event subscriptions
  2. Immediate playback — `initAudio()`, `playShape()`, `playPitchClasses()`, `stopAll()`
  3. Cross-module pattern — event-driven + polling hybrid (AE-D8)
- Voicing model (§3) is straightforward: pitch-class set → octave placement → greedy voice-leading → MIDI notes
- Playback modes (§4–5) map cleanly to UI states defined in Rendering/UI's `UIStateController`

### Next Steps

- Discuss session to resolve AE-D2 (synthesis model choice)
- Confirm AE-D4 debounce approach
- Begin Phase 1a (project scaffolding) after decisions are closed

---

## Entry 2 — Phase 0: AE-D2 Synthesis Model Resolution (Complete)

**Date:** 2026-02-14
**Mode:** Discuss

### Summary

Resolved AE-D2 (default synthesis model) — the last critical open decision blocking Phase 1 implementation. Chose detuned dual-oscillator pad with low-pass filter.

### Analysis

Evaluated four synthesis model candidates against existing constraints:

| Constraint | Source |
|-----------|--------|
| "Soft pad-like sound with overlapping release tails" | AE-D5 (Closed) |
| "Simple synthesis model" | SPEC Known Limitations |
| "Client-side operation" — no large payloads | SPEC NFR |
| Two playback modes with low latency | AE-D7 |
| "Simplest solutions possible" | GOVERNANCE.md |

**Candidates evaluated:**

| Option | Model | Sound | Complexity | AE-D5 Fit |
|--------|-------|-------|------------|-----------|
| A | Single oscillator + ADSR | Thin, organ-like | Lowest | ❌ No warmth |
| B | **Dual-oscillator + LP filter + ADSR** | **Warm pad** | **Low-moderate** | **✅ Matches** |
| C | 2-operator FM | Electric piano-ish | Moderate | ❌ Percussive |
| D | Sample-based | Excellent fidelity | High | ❌ No blending tails, large payload |

### Decision

**Option B** selected — detuned dual-oscillator pad with low-pass filter.

Per-voice signal chain: `2× Oscillator (triangle + sine, ±2–4 cents detune) → GainNode (mix) → BiquadFilterNode (LP ~2 kHz) → GainNode (ADSR: 50/200/0.7/500 ms) → master GainNode`.

Key properties:
- 5 Web Audio nodes per voice — negligible CPU for 3–4 note chords
- Detuning produces natural chorusing without complexity
- LP filter softens harmonics for pad character
- 500 ms release enables overlapping tail blending (AE-D5)
- Zero payload — all synthesized client-side
- Master gain normalized by `1 / sqrt(voiceCount)` to prevent clipping

### Documents Updated

| Document | Changes |
|----------|---------|
| DEVPLAN.md | AE-D2 closed in decisions section; Cold Start constraints updated; Current Status reflects no blockers |
| ARCH_AUDIO_ENGINE.md | AE-D2 marked Closed in §2; new §2b added with full signal chain, parameter table, normalization strategy |
| DEVLOG.md | This entry |

### Remaining Phase 0 Items

| Item | Status |
|------|--------|
| AE-D4: Drag debounce timing | Tentative — defer to Phase 1d testing |
| HC dependency setup | Pending — confirm during 1a scaffolding |
| Test framework | Pending — confirm during 1a scaffolding |

### Next Steps

All critical decisions are closed. Ready to begin Phase 1a (project scaffolding) in a Code session.

---

## Entry 3 — Phase 1a: Project Scaffolding (Complete)

**Date:** 2026-02-14
**Mode:** Code

### Summary

Created the AUDIO_ENGINE project scaffolding: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, and smoke tests. All tooling confirmed working.

### Files Created

| File | Purpose |
|------|---------|
| `package.json` | `type: "module"`, HC via `file:../HARMONY_CORE`, Vitest 3.2.4, TypeScript 5.x |
| `tsconfig.json` | ES2022 target, bundler resolution, strict mode — identical config to RU/HC |
| `vitest.config.ts` | `src/**/*.test.ts` glob |
| `src/index.ts` | Barrel stub — re-exports HC `Shape` and `Chord` types |
| `src/__tests__/smoke.test.ts` | 2 smoke tests |

### Tooling Decisions Confirmed

| Item | Choice | Rationale |
|------|--------|-----------|
| HC dependency | `"harmony-core": "file:../HARMONY_CORE"` | Same pattern as RU (RU-DEV-D3) |
| Test framework | Vitest 3.x | Consistent with HC and RU |
| `happy-dom` | **Not included** | Audio Engine tests don't need DOM/SVG; Web Audio requires different mocking (to be added in Phase 1b) |
| `exports` field | `{ ".": { "import": "./src/index.ts", "types": "./src/index.ts" } }` | Matches HC pattern; allows direct TS import without build step |

### Test Results

```
✓ src/__tests__/smoke.test.ts (2 tests) 16ms
Tests: 2 passed (2)
tsc --noEmit: clean (0 errors)
```

### Package Stats

- 53 packages installed, 0 vulnerabilities
- 1 source file, 1 test file

### Next Steps

Phase 1b: AudioContext initialization (`src/audio-context.ts`). Will need to determine Web Audio API mocking strategy for unit tests (AudioContext is not available in Node.js/Vitest without a polyfill or mock).

---

## Entry 4 — Phase 1b: AudioContext Initialization (Complete)

**Date:** 2026-02-14
**Mode:** Code

### Summary

Implemented AudioContext initialization, the full `AudioTransport` interface from ARCH §6, and the Web Audio mocking strategy. 28 new tests passing.

### Key Decision: Web Audio Mocking Strategy (AE-DEV-D1)

```
AE-DEV-D1: Dependency injection for Web Audio mocking
Date: 2026-02-14
Status: Closed
Priority: High
Decision:
initAudio(options?) accepts AudioContextClass constructor override via
InitAudioOptions. Tests inject MockAudioContext; production uses
globalThis.AudioContext. Lightweight manual mock in test utilities —
no npm dependencies.
Rationale:
Simplest approach. Avoids polluting globals (vi.stubGlobal), avoids npm
mock packages (standardized-audio-context-mock), gives full control over
mock surface. Consistent with zero-runtime-dependency constraint.
```

### Files Created

| File | Purpose | Tests |
|------|---------|-------|
| `src/types.ts` | All ARCH §6 interfaces: TransportState, ChordEvent, PlaybackStateChange, ChordChangeEvent, AudioTransport, PlayOptions, InitAudioOptions | — |
| `src/audio-context.ts` | `initAudio()` factory → AudioTransport | — |
| `src/__tests__/web-audio-mock.ts` | MockAudioContext, MockSuspendedAudioContext, mock nodes (GainNode, OscillatorNode, BiquadFilterNode, AudioParam) | — |
| `src/__tests__/audio-context.test.ts` | 28 tests across 6 describe blocks | 28 |

### Implementation Details

**initAudio() behavior:**
1. Instantiate AudioContext (or injected mock)
2. If `state === "suspended"`, call `resume()` (browser autoplay policy)
3. Initialize transport state: playing=false, tempo=120, chordIndex=-1
4. Return AudioTransport object with all 14 interface methods

**Transport control (implemented ahead of Phase 2 plan):**
The DEVPLAN originally stubbed transport controls for Phase 2. During implementation, the state machine logic was simple enough to implement inline (play/stop/pause/schedule/cancel), reducing Phase 2 scope to the scheduler engine and audio scheduling — the harder parts. Event emission wiring was also trivial and is fully tested.

**Mock architecture:**
- `MockAudioContext` — `_currentTime` (mutable for tests), `_state`, `resume()`, `close()`, audio node factories
- `MockSuspendedAudioContext` — extends with `state = "suspended"` for autoplay policy tests
- `MockAudioParam` — `value`, `setValueAtTime`, `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, `setTargetAtTime`, `cancelScheduledValues` (all instant-apply for test simplicity)
- `MockAudioNode` — `connect()`, `disconnect()`, context ref
- `MockGainNode`, `MockOscillatorNode`, `MockBiquadFilterNode` — typed wrappers with appropriate params

### Test Results

```
✓ src/__tests__/smoke.test.ts (2 tests) 28ms
✓ src/__tests__/audio-context.test.ts (28 tests) 15ms
Tests: 30 passed (30)
tsc --noEmit: clean (0 errors)
```

### Barrel Export Updates

`src/index.ts` now exports:
- HC re-exports: `Shape`, `Chord`
- All 7 type interfaces from `types.ts`
- `initAudio` function from `audio-context.ts`

### Phase 2 Scope Adjustment

Since transport control state machine is implemented in Phase 1b, Phase 2 can focus on:
- **2a:** Wiring transport controls to actual audio scheduling (lookahead buffer, beat→time conversion)
- **2b:** Firing `onChordChange` events during real playback (timer-based)
- **2c:** Voicing integration with scheduled playback

### Next Steps

Phase 1c: Voicing Model (`src/voicing.ts`). Pitch-class set → MIDI note array with greedy voice-leading.

---

## Entry 5 — Phase 1c: Voicing Model (Complete)

**Date:** 2026-02-14
**Mode:** Code

### Summary

Implemented the voicing model: pitch-class to MIDI conversion with greedy minimal-motion voice-leading (AE-D3). 30 new tests, all passing.

### Files Created

| File | Purpose | Tests |
|------|---------|-------|
| `src/voicing.ts` | `nearestMidiNote`, `voiceInRegister`, `voiceLead` | — |
| `src/__tests__/voicing.test.ts` | 30 tests across 6 describe blocks | 30 |

### Algorithm Design

**`nearestMidiNote(target, pc)`**
Core primitive. Given a MIDI note `target` and a pitch class `pc` (0–11), computes the MIDI note with that pitch class closest to `target`. Uses modular arithmetic: `diff = ((pc - targetPc) % 12 + 12) % 12`, then compares `target + diff` vs `target + diff - 12`. Tritone ties (distance = 6 both ways) prefer upward. Result clamped to [0, 127].

**`voiceInRegister(pcs, register?)`**
Initial placement (no previous voicing). Maps each pc to `nearestMidiNote(register, pc)`. Default register: 60 (middle C). Produces compact voicings clustered around the register.

**`voiceLead(prevVoicing, newPcs, register?)`**
Greedy minimal-motion algorithm per AE-D3:
1. For every (prev note, new pc) combination, compute nearest MIDI note and distance
2. Pick the pair with minimum distance, assign, remove both from pools
3. Repeat until one pool is exhausted
4. If new pcs remain (e.g., triad → 7th chord): place near centroid of prev voicing
5. If prev notes remain (e.g., 7th chord → triad): excess ignored
6. Empty prevVoicing: falls back to `voiceInRegister`

**Output order:** `result[i]` always corresponds to `newPcs[i]` — preserves caller's pitch-class ordering.

### Musical Validation

Test suite includes real musical progressions to verify voice-leading quality:

| Progression | Total Motion | Verdict |
|-------------|-------------|---------|
| C → F major | 3 semitones | ✅ Smooth |
| C → Am (relative minor) | 2 semitones | ✅ Common tones preserved |
| C → E major (chromatic mediant) | 2 semitones | ✅ Efficient |
| ii–V–I (Dm7 → G7 → Cmaj7) | ≤12 per step | ✅ Smooth |
| C → Db (chromatic) | ≤2 per voice | ✅ Semitone motion |

### Test Results

```
✓ src/__tests__/smoke.test.ts (2 tests)
✓ src/__tests__/audio-context.test.ts (28 tests)
✓ src/__tests__/voicing.test.ts (30 tests)
Tests: 60 passed (60)
tsc --noEmit: clean (0 errors)
```

### Barrel Export Updates

`src/index.ts` now additionally exports: `nearestMidiNote`, `voiceInRegister`, `voiceLead`.

### Next Steps

Phase 1d: Immediate Playback (`src/immediate-playback.ts`). Wire voicing → synthesis signal chain (AE-D2) → `playShape()`, `playPitchClasses()`, `stopAll()`.

---

## Entry 6 — Phase 1d: Immediate Playback (Complete)

**Date:** 2026-02-14
**Mode:** Code

### Summary

Implemented the full immediate playback pipeline: per-voice AE-D2 synthesis (`synth.ts`) and high-level playback API (`immediate-playback.ts`). 43 new tests, 103 total passing. Phase 1 complete.

### Architecture Split

Split synthesis into two modules for separation of concerns:

| Module | Level | Responsibility |
|--------|-------|---------------|
| `src/synth.ts` | Low-level | Per-voice signal chain: 2× oscillator → mix gain → LP filter → ADSR envelope → destination |
| `src/immediate-playback.ts` | High-level | Voice set management, voice-leading integration, voice-count normalization, Shape→pcs extraction |

This mirrors the ARCH §2b node budget design: `synth.ts` owns the 5 nodes per voice, `immediate-playback.ts` owns the master gain and voice lifecycle.

### Files Created

| File | Purpose | Tests |
|------|---------|-------|
| `src/synth.ts` | `SYNTH_DEFAULTS`, `midiToFreq`, `VoiceHandle`, `createVoice` | — |
| `src/immediate-playback.ts` | `ImmediatePlaybackState`, `createImmediatePlayback`, `playPitchClasses`, `playShape`, `stopAll` | — |
| `src/__tests__/synth.test.ts` | 18 tests: midiToFreq, signal chain, velocity, release/stop | 18 |
| `src/__tests__/immediate-playback.test.ts` | 25 tests: playback, stopAll, duration, velocity | 25 |

### Implementation Details

**synth.ts — Per-Voice Signal Chain (AE-D2):**
- `SYNTH_DEFAULTS`: triangle/sine oscillators, ±3 cents detune, 2kHz LP filter, ADSR (50/200/0.7/500 ms)
- `midiToFreq(midi)`: standard A4=440Hz tuning, `440 × 2^((midi-69)/12)`
- `createVoice(ctx, dest, midi, velocity?, when?)`: builds full signal chain, returns `VoiceHandle`
- `VoiceHandle.release(when?)`: triggers ADSR release phase, schedules oscillator stop after release tail
- `VoiceHandle.stop()`: immediate hard stop, disconnects all nodes
- Both release and stop are idempotent (safe to call multiple times)

**immediate-playback.ts — High-Level API:**
- `createImmediatePlayback(transport)`: creates master gain → destination, initializes voice tracking
- `playPitchClasses(state, pcs, options?)`: releases prev voices → voice-leads new pcs → creates voices → normalizes gain
- `playShape(state, shape, options?)`: extracts `covered_pcs` from Shape, delegates to `playPitchClasses`
- `stopAll(state)`: hard-stops all voices, clears voicing state, resets master gain
- Voice-count normalization: `masterGain = 1 / √(voiceCount)` per ARCH §2b
- Duration option: schedules `release(currentTime + duration)` for auto-release
- Velocity option: passed through to `createVoice` as MIDI velocity (0–127)

### Barrel Export Updates

`src/index.ts` now additionally exports:
- `createVoice`, `midiToFreq`, `SYNTH_DEFAULTS`, `VoiceHandle` from `synth.ts`
- `createImmediatePlayback`, `playPitchClasses`, `playShape`, `stopAll`, `ImmediatePlaybackState` from `immediate-playback.ts`

### Test Results

```
✓ src/__tests__/smoke.test.ts (2 tests)
✓ src/__tests__/audio-context.test.ts (28 tests)
✓ src/__tests__/voicing.test.ts (30 tests)
✓ src/__tests__/synth.test.ts (18 tests)
✓ src/__tests__/immediate-playback.test.ts (25 tests)
Tests: 103 passed (103)
tsc --noEmit: clean (0 errors)
```

### Phase 1 Summary

All Phase 1 sub-tasks complete:

| Phase | Module | Tests | Status |
|-------|--------|-------|--------|
| 1a | Scaffolding | 2 | ✅ |
| 1b | AudioContext + Transport | 28 | ✅ |
| 1c | Voicing Model | 30 | ✅ |
| 1d | Immediate Playback | 43 | ✅ |
| **Total** | **6 source files** | **103** | **✅** |

### Next Steps

Phase 2: Scheduled Playback & Transport. Wire transport controls to actual audio scheduling (lookahead buffer, beat→time conversion, chord change events during real playback).

---

## Entry 7 — Phase 2: Scheduled Playback & Transport (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented the full scheduled playback engine: beat→time conversion, lookahead-based scheduler, chord change event firing, and wired transport controls (play/stop/pause/cancel) to the scheduler. 40 new tests, 143 total passing. Phase 2 complete.

### Architecture

Phase 2 adds one new module (`scheduler.ts`) and upgrades the existing `audio-context.ts` transport to drive it:

```
ChordEvent[] (with startBeat, durationBeats, Shape)
    ↓
createScheduler(opts)
    ↓  (pre-computes wall-clock times from beats + BPM)
SchedulerState { chords: ScheduledChord[], timerHandle, ... }
    ↓
startScheduler(state)
    ↓  (setInterval @ 25ms, lookahead window 100ms)
tick() → scheduleChordVoices() → createVoice() (from synth.ts)
       → fire onChordChange() callbacks
       → auto-stop when progression ends
```

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| Lookahead pattern (25ms/100ms) | Industry-standard Web Audio scheduling pattern. Timer fires every 25ms, looks 100ms ahead, schedules voices at precise `AudioContext.currentTime` offsets. Prevents gaps without CPU-spinning. |
| Pre-computed wall-clock times | On `createScheduler()`, each chord's `startTime`/`endTime` is computed once via `beatsToSeconds()`. Avoids per-tick floating-point accumulation drift. |
| Beat offset for resume | `pauseScheduler()` returns the current beat position. On resume, `createScheduler()` shifts the playback origin backward so remaining chords land at the correct future times. |
| Voicing built into scheduler | `scheduleChordVoices()` calls `voiceLead()`/`voiceInRegister()` directly. No separate module needed — keeps the scheduler self-contained. Voice-leading state (`prevVoicing`) threads through sequential chord scheduling. |
| Separate master gain per scheduler | Each `createScheduler()` creates its own master gain → destination. Stop/cancel disconnects it cleanly. |

### Files Created

| File | Purpose | Tests |
|------|---------|-------|
| `src/scheduler.ts` | `beatsToSeconds`, `secondsToBeats`, `createScheduler`, `startScheduler`, `stopScheduler`, `pauseScheduler`, `getCurrentBeat`, constants | — |
| `src/__tests__/scheduler.test.ts` | 40 tests across 9 describe blocks | 40 |

### Files Modified

| File | Changes |
|------|---------|
| `src/audio-context.ts` | `play()` now creates + starts scheduler, `stop()`/`pause()`/`cancelSchedule()` delegate to scheduler control. Added `pausedBeatOffset` and `prevVoicing` for resume continuity. |
| `src/__tests__/audio-context.test.ts` | Updated `stubShape` from empty object to proper `{ covered_pcs: new Set([0, 4, 7]) }` — now that `play()` actually triggers the scheduler (which reads `covered_pcs`), the stub must be realistic. |
| `src/index.ts` | Added scheduler exports (8 functions/constants + 3 types). |

### Implementation Details

**scheduler.ts:**
- `beatsToSeconds(beats, bpm)`: `(beats / bpm) * 60` — pure function
- `secondsToBeats(seconds, bpm)`: `(seconds / 60) * bpm` — inverse
- `createScheduler(opts)`: pre-computes `ScheduledChord[]` with `startTime`/`endTime` wall-clock values. Origin = `ctx.currentTime - beatsToSeconds(beatOffset, bpm)`.
- `startScheduler(state)`: immediate tick + `setInterval(tick, 25ms)`
- `tick(state)`: (1) schedule voices in lookahead window, (2) fire chord change events, (3) auto-stop at end
- `scheduleChordVoices(state, idx)`: extracts pcs → voices with voice-leading → `createVoice()` at `slot.startTime` → `voice.release(slot.endTime)` → gain normalization
- `stopScheduler(state)`: hard-stop all voices, clear interval, disconnect master gain
- `pauseScheduler(state)`: release (not hard-stop) voices for smooth tails, return current beat
- `getCurrentBeat(state)`: live beat position from elapsed time

**audio-context.ts changes:**
- `play()`: creates `SchedulerState` with current events, BPM, beat offset, voicing; starts scheduler
- `stop()`: resets beat offset to 0, calls `cleanupScheduler()` (which calls `stopScheduler`)
- `pause()`: calls `pauseScheduler()`, saves returned beat offset + voicing for resume
- `cancelSchedule()`: calls `cleanupScheduler()`, clears event array
- New `emitChordChange()`: delegates chord change events from scheduler to transport's `onChordChange` subscribers

### Test Results

```
✓ src/__tests__/smoke.test.ts (2 tests)
✓ src/__tests__/audio-context.test.ts (28 tests)
✓ src/__tests__/voicing.test.ts (30 tests)
✓ src/__tests__/synth.test.ts (18 tests)
✓ src/__tests__/immediate-playback.test.ts (25 tests)
✓ src/__tests__/scheduler.test.ts (40 tests)
Tests: 143 passed (143)
tsc --noEmit: clean (0 errors)
```

### Test Coverage Breakdown (scheduler.test.ts)

| Describe Block | Tests | Covers |
|---------------|-------|--------|
| beatsToSeconds | 6 | Tempo scaling, fractional beats, high tempos, zero |
| secondsToBeats | 3 | Inverse conversion, round-trip consistency |
| createScheduler | 5 | Wall-clock computation, master gain, beat offset, tempo comparison |
| startScheduler | 7 | Lookahead window, chord change firing, sequential scheduling, voice-leading |
| stopScheduler | 3 | Timer clearing, voice cleanup, tick prevention |
| pauseScheduler | 3 | Beat position return, timer clearing, voicing preservation |
| getCurrentBeat | 2 | Origin position, time advancement |
| transport integration | 7 | End-to-end: play, stop, pause/resume, cancel, chord changes, tempo |
| scheduler constants | 3 | Positive values, lookahead > interval gap-free constraint |

### Phase 2 Summary

| Sub-phase | Scope | Tests | Status |
|-----------|-------|-------|--------|
| 2a | Transport wiring | 28 (existing) | ✅ |
| 2b | Scheduler engine | 40 (new) | ✅ |
| 2c | Voicing integration | included in 2b | ✅ |
| **Total** | **1 new + 2 modified source files** | **40 new (143 total)** | **✅** |

### Next Steps

Phase 3: Cross-Module Integration. Validate AudioTransport contract with Rendering/UI, wire `onChordChange` → `PathHandle.setActiveChord()`, end-to-end playback testing.

---

## Entry 8 — Phase 3: Cross-Module Integration (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented Phase 3: cross-module type compatibility tests, `shapesToChordEvents()` conversion utility, and end-to-end integration smoke tests. 15 new tests, 158 total passing.

### Contract Validation Results

All cross-module contracts validated:
- `AudioTransport` 14-method interface: ✅ all match RU expectations
- `Shape.covered_pcs` (HC) → `playShape()` (AE): ✅ Set flows through correctly
- `getTrianglePcs()` (HC) → `playPitchClasses()` (AE): ✅ `number[]` compatible with `readonly number[]`
- `getEdgeUnionPcs()` (HC) → `playPitchClasses()` (AE): ✅ null guard + 4-pc array
- `ChordEvent.shape` reference preserved through scheduler → `onChordChange` events: ✅

### Files Created

| File | Purpose | Tests |
|------|---------|-------|
| `src/conversion.ts` | `shapesToChordEvents(shapes, beatsPerChord?)` — Shape[] → ChordEvent[] | — |
| `src/__tests__/cross-module.test.ts` | Phase 3a: type compatibility (7 tests) | 7 |
| `src/__tests__/conversion.test.ts` | Phase 3b: conversion utility (5 tests) | 5 |
| `src/__tests__/integration-e2e.test.ts` | Phase 3c: end-to-end smoke tests (3 tests) | 3 |

### Files Modified

| File | Changes |
|------|---------|
| `src/index.ts` | Added `shapesToChordEvents` export |

### Decision Made

AE-D9 (Closed): Interactive playback wires to `playPitchClasses(state, pcs)` — tap plays exactly the pitch classes from hit-test (3 for triangle, 4 for edge union). `playShape()` reserved for progression playback where full Shapes exist.

### Test Results

```
✓ src/__tests__/smoke.test.ts (2 tests)
✓ src/__tests__/audio-context.test.ts (28 tests)
✓ src/__tests__/voicing.test.ts (30 tests)
✓ src/__tests__/synth.test.ts (18 tests)
✓ src/__tests__/immediate-playback.test.ts (25 tests)
✓ src/__tests__/scheduler.test.ts (40 tests)
✓ src/__tests__/cross-module.test.ts (7 tests)
✓ src/__tests__/conversion.test.ts (5 tests)
✓ src/__tests__/integration-e2e.test.ts (3 tests)
Tests: 158 passed (158)
tsc --noEmit: clean (0 errors)
```

### Phase 3 Summary

| Sub-phase | Scope | Tests | Status |
|-----------|-------|-------|--------|
| 3a | Cross-module type compatibility | 7 new | ✅ |
| 3b | shapesToChordEvents() utility | 5 new | ✅ |
| 3c | End-to-end integration smoke | 3 new | ✅ |
| **Total** | **1 new + 1 modified source files** | **15 new (158 total)** | **✅** |

### Next Steps

Phase 4: Review & Polish. Code review, latency profiling, ARCH/SPEC doc updates.
