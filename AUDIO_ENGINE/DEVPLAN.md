# DEVPLAN — Audio Engine

Module: Audio Engine
Version: 0.1
Date: 2026-02-14
Architecture reference: ARCH_AUDIO_ENGINE.md (Draft 0.4)

---

## Cold Start Summary

**What this is:**
Web Audio API–based synthesis and playback subsystem for the Tonnetz Interactive Harmonic Explorer. Responsible for converting Harmony Core `Shape` objects into audible output via voicing, voice-leading, and scheduled playback. Exposes the `AudioTransport` interface consumed by Rendering/UI for playback animation synchronization.

**Key constraints:**
- Web Audio API only — no external audio libraries
- Synthesis model: detuned dual-oscillator pad with low-pass filter (AE-D2)
- Must call `initAudio()` after a user gesture (browser autoplay policy)
- MIDI-range internal representation for note events (AE-D1)
- Voice-leading Level 1: greedy minimal-motion mapping (AE-D3)
- `AudioContext.currentTime` is the single shared transport timebase for both audio scheduling and Rendering/UI animation
- Audio Engine owns the `AudioContext` instance; Rendering/UI queries via `AudioTransport`
- Two playback modes: immediate (interaction-triggered) and scheduled (progression playback) (AE-D7)
- Playback behavior tied to UI state transitions (AE-D6)
- Hybrid event + polling synchronization model (AE-D8)

**Gotchas:**
- **Plain git repo** — commit with `git add -A && git commit`, not `sl` or `jf`
- `AudioContext` may be in `"suspended"` state until first user gesture — `initAudio()` must call `ctx.resume()`
- Web Audio scheduling must happen ahead of time (~100ms lookahead) to avoid glitches
- `AudioContext.currentTime` is read-only and monotonically increasing — cannot be reset or rewound
- Stopping scheduled nodes requires tracking active `AudioBufferSourceNode` / `OscillatorNode` references
- Gain ramps (for attack/release) must use `linearRampToValueAtTime` or `exponentialRampToValueAtTime` — not direct `.value` assignment during playback

---

## Current Status

**Phase:** Phase 5 — Review & Polish ✅
**Focus:** Audio Engine complete. Integration module next.
**Blocked/Broken:** None
**Test count:** 157 AE + 344 RU = 501 total

---

## Phase 0: Pre-Implementation Discussion

**Objective:** Resolve open decisions, finalize phase breakdown, confirm API contract alignment with Rendering/UI.

### Open Items

- [x] AE-D2: Choose default synthesis model → **Closed** (detuned dual-oscillator pad + LP filter)
- [x] AE-D4: Confirm drag-trigger debounce timing → **Closed** (unnecessary — retrigger-on-triangle-change already handles this)
- [x] Confirm Harmony Core dependency setup → `"harmony-core": "file:../HARMONY_CORE"`
- [x] Confirm test framework → Vitest 3.x (consistent with HC and RU)

---

## Phase 1: Audio Initialization & Immediate Playback

**Objective:** Initialize Web Audio, implement voicing model, play Shapes immediately on interaction.

### 1a: Project Scaffolding ✅

Scaffolding, HC dependency, Vitest. 2 tests. See DEVLOG Entry 3.

### 1b: AudioContext Initialization ✅

`initAudio()` → `AudioTransport`, full transport state machine, Web Audio mocking via DI (AE-DEV-D1). 28 tests. See DEVLOG Entry 4.

### 1c: Voicing Model ✅

`nearestMidiNote`, `voiceInRegister`, `voiceLead` — greedy minimal-motion voice-leading (AE-D3). 30 tests. See DEVLOG Entry 5.

### 1d: Immediate Playback ✅

`synth.ts` (per-voice AE-D2 signal chain) + `immediate-playback.ts` (`createImmediatePlayback`, `playShape`, `playPitchClasses`, `stopAll`). 43 tests. See DEVLOG Entry 6.

---

## Phase 2: Scheduled Playback & Transport

**Objective:** Implement progression scheduling, transport controls, and event subscriptions.

### 2a: Transport State Machine ✅

Transport state management implemented in `src/audio-context.ts` (Phase 1b), now wired to the scheduler engine.

**Tests:** (validated in audio-context.test.ts, 28 tests)
- [x] State transitions: stopped → playing → paused → playing → stopped
- [x] `scheduleProgression()` stores events
- [x] `play()` no-op without scheduled progression
- [x] `cancelSchedule()` clears progression and stops
- [x] `setTempo()` updates tempo value
- [x] `onStateChange()` fires on transitions
- [x] Unsubscribe function works

### 2b: Scheduled Playback Engine ✅

`src/scheduler.ts` — Lookahead-based scheduler with beat→time conversion.

**Architecture:**
- `beatsToSeconds(beats, bpm)` / `secondsToBeats(seconds, bpm)` — pure conversion
- `createScheduler(opts)` — builds `SchedulerState` with pre-computed wall-clock times for each chord
- `startScheduler(state)` — begins `setInterval` lookahead loop (25ms interval, 100ms lookahead)
- `stopScheduler(state)` — hard-stops all voices, clears timer
- `pauseScheduler(state)` — releases voices smoothly, returns current beat position for resume
- `getCurrentBeat(state)` — live beat position query

**Files created:**
- `src/scheduler.ts` — 8 exports + 3 type exports
- `src/__tests__/scheduler.test.ts` — 40 tests across 9 describe blocks

**Tests:** 40 new (143 total)
- [x] Beat→time conversion (6 tests: tempo scaling, fractional, round-trip)
- [x] Seconds→beats conversion (3 tests)
- [x] Chord wall-clock time computation from beats and tempo
- [x] Beat offset for pause/resume
- [x] Different tempos produce different timing
- [x] `onChordChange()` fires at chord transitions
- [x] Each chord change fires only once
- [x] Stop mid-progression cancels remaining events
- [x] Pause preserves position
- [x] `setTempo()` affects scheduling timing

### 2c: Integration with Voicing ✅

Voicing integration built directly into `scheduler.ts`'s `scheduleChordVoices()`. Each `ChordEvent.shape` is voiced via `voiceLead()` / `voiceInRegister()` and played via `createVoice()`.

**Tests:** (validated in scheduler.test.ts)
- [x] Scheduled shapes are voiced correctly
- [x] Voice-leading applies across sequential chords
- [x] Transport end-to-end integration (7 tests: play, stop, pause/resume, cancel, chord changes, tempo)

---

## Phase 3: Cross-Module Integration

**Objective:** Validate AudioTransport contract, test cross-module type compatibility, implement `Shape[] → ChordEvent[]` conversion utility.

### Contract Validation Summary (Discuss — 2026-02-15)

**AudioTransport interface:** ✅ All 14 methods match RU expectations. Event payloads (`ChordChangeEvent`, `PlaybackStateChange`) structurally correct.

**Immediate playback type flow:** ✅ Compatible.
- HC `getTrianglePcs()` → `number[]` (sorted tuple) → RU spreads to `number[]` → AE `playPitchClasses(state, pcs: readonly number[])` ✅
- HC `getEdgeUnionPcs()` → `number[] | null` → RU passes to callback → AE `playPitchClasses` ✅
- HC `Shape.covered_pcs` (`Set<number>`) → AE `playShape(state, shape)` spreads to array ✅

**Progression flow — one gap identified:**
- HC `mapProgressionToShapes()` → `Shape[]` but AE `scheduleProgression()` expects `ChordEvent[]` with `startBeat`, `durationBeats`, `shape`
- Need: utility to convert `Shape[] → ChordEvent[]` (assign beat positions/durations)
- Owner: integration module (trivial mapping — e.g., 1 beat per chord, sequential)

**Design decision needed:**

```
AE-D9: Interactive playback wiring — triangle vs Shape
Date: 2026-02-15
Status: Closed
Priority: Normal
Decision:
Wire InteractionCallbacks.onTriangleSelect → playPitchClasses(state, pcs).
Wire InteractionCallbacks.onEdgeSelect → playPitchClasses(state, pcs).
Do NOT decompose to full Shape for interactive playback — tap plays exactly the
pitch classes the hit-test returns (3 for triangle, 4 for edge union).
playShape() is reserved for progression playback where full Shapes (with extensions)
are available from mapProgressionToShapes().
Rationale:
Simplest wiring. Triangle tap = triad (3 pcs). Edge tap = union (4 pcs). No extra
HC decomposition call on the interactive hot path. Extensions are only musically
relevant for pre-parsed progressions, not ad-hoc triangle taps.
```

### 3a: AudioTransport Contract Tests ✅ → scope reduced

Original plan: test all 14 interface methods. These are already covered by `audio-context.test.ts` (28 tests). Phase 3a adds only the **cross-module type compatibility** tests that can't be tested within a single module.

**Tests:**
- [ ] HC `Shape.covered_pcs` passes through `playShape()` correctly (type + value)
- [ ] HC `getTrianglePcs()` output is accepted by `playPitchClasses()` (type compatibility)
- [ ] HC `getEdgeUnionPcs()` output is accepted by `playPitchClasses()` (null guard + value)
- [ ] `ChordEvent` with HC `Shape` schedules and plays correctly
- [ ] `onChordChange` event contains correct `shape` reference from original `ChordEvent`
- [ ] Multiple `onChordChange` subscribers receive events independently

### 3b: Shape[] → ChordEvent[] Conversion

**Utility function** (in Audio Engine, since `ChordEvent` is an AE type):

```ts
function shapesToChordEvents(
  shapes: readonly Shape[],
  beatsPerChord?: number,  // default: 1
): ChordEvent[]
```

Sequential mapping: `startBeat = index * beatsPerChord`, `durationBeats = beatsPerChord`.

**Tests:**
- [ ] Empty array → empty array
- [ ] Single shape → one ChordEvent at beat 0
- [ ] Multiple shapes → sequential beats
- [ ] Custom beatsPerChord respected
- [ ] Shape reference preserved (same object)

### 3c: Integration Smoke Test

End-to-end test using all three modules together:

**Tests:**
- [ ] Parse progression string (HC) → map to shapes (HC) → convert to events (AE) → schedule (AE) → chord change events fire with correct shapes
- [ ] Interactive flow: `getTrianglePcs()` (HC) → `playPitchClasses()` (AE) → voices created
- [ ] Edge union flow: `getEdgeUnionPcs()` (HC) → `playPitchClasses()` (AE) → 4 voices created

---

## Phase 4: RU Integration Tests (AudioTransport Contract) ✅

**Objective:** Validate RU components correctly consume/produce data compatible with the AudioTransport contract, simulating the integration module wiring pattern.

### Setup

- Added `audio-engine` as a devDependency in `RENDERING_UI/package.json` (test-only — no production coupling)
- RU imports AE types (`AudioTransport`, `TransportState`, event payloads, `ChordEvent`) for type-safe mock

### 4a: AudioTransport Mock + Conformance Tests ✅

Created `createMockTransport()` — full 14-method mock with test helpers (`fireStateChange`, `fireChordChange`).

**Tests:**
- [x] Mock satisfies all 14 AudioTransport interface methods
- [x] `getState()` returns valid `TransportState` shape
- [x] `onStateChange` / `onChordChange` return unsubscribe functions

### 4b: InteractionCallbacks → AE Type Compatibility ✅

**Tests:**
- [x] `onTriangleSelect` pcs array (3 pitch classes) valid for `playPitchClasses`
- [x] `onEdgeSelect` pcs array (4 pitch classes) valid for 7th chord playback
- [x] `onDragScrub` pcs array compatible with `playPitchClasses`
- [x] `onPointerUp` fires with no args — compatible with `stopAll(state)`

### 4c: ControlPanel → Transport Wiring ✅

**Tests:**
- [x] Play button click → `transport.play()` called
- [x] Stop button click → `transport.stop()` called
- [x] Play button disabled during playback prevents double-play

### 4d: Transport Events → UIStateController ✅

**Tests:**
- [x] `transport playing:true` → `uiState.startPlayback()`
- [x] `transport playing:false` → `uiState.stopPlayback()`
- [x] Transport events ignored when UI not in compatible state

### 4e: onChordChange → UI Sync ✅

**Tests:**
- [x] Chord change events deliver valid index + shape
- [x] Chord change index matches transport state query
- [x] Unsubscribe stops chord change delivery

### 4f: Full Round-Trip Integration ✅

**Tests:**
- [x] HC parse → shapes → `shapesToChordEvents` → `scheduleProgression` → play → chordChange → UI update → stop
- [x] Interaction tap → pcs compatible with AE immediate playback (triangle 3 pcs, edge 4 pcs, pointerUp)
- [x] Progression preserved through play/stop cycle via transport

**Files:**
- `RENDERING_UI/src/__tests__/audio-transport-integration.test.ts` — 20 tests across 6 describe blocks
- `RENDERING_UI/package.json` — added `audio-engine` devDependency

**Totals:** 344 RU tests (18 files) + 158 AE tests (9 files) = 502 tests passing

---

## Phase 5: Review & Polish

**Objective:** Code review, performance profiling, documentation sync.

- [ ] Review pass (simplify, remove dead code)
- [ ] Latency profiling (interaction → audio onset target: <50ms)
- [ ] Update ARCH_AUDIO_ENGINE.md with final API signatures
- [ ] Update SPEC.md Audio Engine API overview
- [ ] Doc sync: remove redundancies, fix drift

---

## Design Decisions

```
AE-D1: MIDI internal representation
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
All internal note representation uses MIDI note numbers (0–127).
Rationale:
Industry standard, simplifies voicing math and future MIDI export.
```

```
AE-D2: Default synthesis model
Date: 2026-02-14
Status: Closed
Priority: Critical
Decision:
Detuned dual-oscillator pad with low-pass filter.
Per-voice signal chain: 2× OscillatorNode (triangle + sine, ~4 cents detune)
  → GainNode (per-oscillator mix) → BiquadFilterNode (lowpass, ~2 kHz cutoff, Q ≈ 1)
  → GainNode (ADSR envelope: A ~50 ms, D ~200 ms, S ~0.7, R ~500 ms)
  → master GainNode (velocity scaling + voice-count normalization).
Rationale:
Minimum viable synthesis that satisfies AE-D5 (soft pad, overlapping release tails).
Detuning produces natural chorusing/warmth. LP filter softens harmonics. Only 5 Web Audio
nodes per voice — negligible CPU for 3–4 note chords.
Trade-offs:
  - Single oscillator (Option A): simpler but thin/clinical, fails AE-D5 pad requirement
  - FM synthesis (Option C): richer timbres possible but harder to tune, tends percussive
  - Sample-based (Option D): best fidelity but 2–10 MB payload, loading UX, no blending tails
Revisit if: user testing reveals sound quality is a blocker despite pad profile; migrate to
Option D (samples) as Phase 2 enhancement.
```

```
AE-D3: Voice-leading sophistication (Level 1)
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Greedy minimal-motion mapping — each voice moves to the nearest available pitch.
Rationale:
Simplest algorithm that produces smooth voice-leading. Higher sophistication deferred to Phase 2 (future).
Revisit if: voice-leading produces audibly poor results in common progressions (e.g., ii–V–I).
```

```
AE-D4: Drag-trigger debounce
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision:
No explicit debounce needed. Rendering/UI's pointer sampling model (RU-D5) already
retriggers only on triangle change (UX_SPEC §6), which naturally prevents audio
stuttering during drag-scrub.
Rationale:
The interaction layer's retrigger-on-triangle-change rule acts as an implicit
debounce — playback only fires when the selected triangle actually changes, not on
every pointer move event. Explicit timing-based debounce would add unnecessary
complexity and introduce latency.
```

```
AE-D5: Default chord-blending sound profile
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision:
Soft pad-like sound with overlapping release tails for chord blending.
Rationale:
Matches target use case (harmonic exploration) — sustained, non-percussive voicing.
```

```
AE-D6: Playback behavior tied to UI state transitions
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Audio playback mode determined by UI state (Idle → no playback, Chord Selected → immediate, Progression Loaded → ready, Playback Running → scheduled).
Rationale:
Keeps audio behavior predictable and synchronized with visual state.
```

```
AE-D7: Playback mode definitions (immediate vs scheduled)
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
Two distinct modes: immediate (interaction-triggered, no scheduling) and scheduled (progression playback via transport timebase).
Rationale:
Clean separation of concerns. Mode switching must be deterministic.
```

```
AE-D8: Hybrid event + polling synchronization
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Rendering/UI uses events (onChordChange) for discrete transitions and polling (getTime in rAF) for continuous animation.
Rationale:
Events avoid missed transitions; polling provides smooth animation. Both reference AudioContext.currentTime.
```

---

## Future Enhancements

| Item | Description | Priority |
|------|-------------|----------|
| Sampled instruments | Replace oscillator synthesis with sample-based playback | Phase 2 |
| Richer synthesis | Multi-oscillator, filters, effects | Phase 2 |
| MIDI export | Export voicings as MIDI file | Phase 2 |
| Advanced voice-leading | Optimal (non-greedy) voice-leading algorithm | Phase 2 |
| Loop playback | Repeat progression with configurable loop count | Phase 2 |
