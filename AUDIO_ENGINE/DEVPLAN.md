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

**Phase:** 1d — Immediate Playback ✅
**Focus:** Phase 2 (Scheduled Playback & Transport) next
**Blocked/Broken:** None
**Test count:** 103 passing (5 test files, 6 source files)

---

## Phase 0: Pre-Implementation Discussion

**Objective:** Resolve open decisions, finalize phase breakdown, confirm API contract alignment with Rendering/UI.

### Open Items

- [x] AE-D2: Choose default synthesis model → **Closed** (detuned dual-oscillator pad + LP filter)
- [ ] AE-D4: Confirm drag-trigger debounce timing (tentative — resolve during Phase 1d testing)
- [x] Confirm Harmony Core dependency setup → `"harmony-core": "file:../HARMONY_CORE"`
- [x] Confirm test framework → Vitest 3.x (consistent with HC and RU)

---

## Phase 1: Audio Initialization & Immediate Playback

**Objective:** Initialize Web Audio, implement voicing model, play Shapes immediately on interaction.

### 1a: Project Scaffolding ✅

`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`. HC as local path dependency.

**Files created:**
- `package.json` — `type: "module"`, HC via `file:../HARMONY_CORE`, Vitest 3.x, TypeScript 5.x
- `tsconfig.json` — ES2022 target, bundler resolution, strict mode (identical to RU/HC)
- `vitest.config.ts` — `src/**/*.test.ts` glob
- `src/index.ts` — barrel stub re-exporting HC `Shape` and `Chord` types
- `src/__tests__/smoke.test.ts` — 2 smoke tests

**Tests:** 2 passing
- [x] Smoke test: module imports resolve
- [x] Smoke test: TypeScript compiles (`tsc --noEmit` clean)

### 1b: AudioContext Initialization ✅

`src/audio-context.ts` — `initAudio(options?)` → `AudioTransport`.

**Mocking strategy (AE-DEV-D1):** Dependency injection via `InitAudioOptions.AudioContextClass`. Tests inject `MockAudioContext`; production uses `globalThis.AudioContext`. Lightweight manual mock in `src/__tests__/web-audio-mock.ts` — no npm dependencies, full control over Web Audio surface. Mock covers `currentTime`, `state`, `resume()`, `createGain()`, `createOscillator()`, `createBiquadFilter()` — extended as needed in later phases.

**Files created:**
- `src/types.ts` — All ARCH §6 interfaces: `TransportState`, `ChordEvent`, `PlaybackStateChange`, `ChordChangeEvent`, `AudioTransport`, `PlayOptions`, `InitAudioOptions`
- `src/audio-context.ts` — `initAudio()` factory: creates AudioContext, resumes if suspended, returns AudioTransport with full interface
- `src/__tests__/web-audio-mock.ts` — `MockAudioContext`, `MockSuspendedAudioContext`, mock audio nodes
- `src/__tests__/audio-context.test.ts` — 28 tests

**Implementation notes:**
- Time/state queries delegate directly to AudioContext
- Transport control methods (play/stop/pause/schedule) implemented with state machine logic and event emission
- Event subscriptions use `Set<callback>` with unsubscribe-via-delete pattern
- `setTempo()` rejects zero/negative values
- `play()` no-op without scheduled events or if already playing
- `stop()` / `pause()` no-op if not playing
- `cancelSchedule()` only emits state change if was playing

**Tests:** 28 passing
- [x] `initAudio()` returns AudioTransport (all 14 methods present)
- [x] `getTime()` returns a number ≥ 0
- [x] `getTime()` reflects AudioContext.currentTime
- [x] `getContext()` returns AudioContext instance
- [x] `isPlaying()` returns false initially
- [x] `getTempo()` returns default 120 BPM
- [x] `getTempo()` returns custom initial tempo
- [x] `getCurrentChordIndex()` returns -1 initially
- [x] Resumes suspended AudioContext
- [x] Does not call resume on already running context
- [x] `getState()` returns correct initial snapshot
- [x] `getState()` reflects totalChords after scheduleProgression
- [x] `setTempo()` updates tempo
- [x] `setTempo()` ignores zero/negative
- [x] `play()` no-op without progression
- [x] `play()` starts with progression
- [x] `play()` no-op if already playing
- [x] `stop()` resets to beginning
- [x] `stop()` no-op if not playing
- [x] `pause()` preserves chord index
- [x] `cancelSchedule()` clears and stops
- [x] `cancelSchedule()` silent if not playing
- [x] `onStateChange` fires on play
- [x] `onStateChange` fires on stop
- [x] Unsubscribe removes listener
- [x] Multiple subscribers all receive events
- [x] `onChordChange` returns unsubscribe
- [x] State change timestamp reflects AudioContext.currentTime

### 1c: Voicing Model ✅

`src/voicing.ts` — Convert pitch-class sets to MIDI note arrays.

**Exported functions:**
- `nearestMidiNote(target, pc)` — MIDI note with given pc closest to target; tritone ties prefer upward; clamped [0, 127]
- `voiceInRegister(pcs, register?)` — place pcs around target register (default: 60); no voice-leading
- `voiceLead(prevVoicing, newPcs, register?)` — greedy minimal-motion voice-leading (AE-D3)

**Algorithm (voiceLead):**
1. Build all (prev note, new pc) pairs with distances via `nearestMidiNote`
2. Greedy: pick minimum-distance pair, assign, remove both, repeat
3. If more new pcs than prev notes: remaining placed near centroid of prev voicing
4. If more prev notes than new pcs: excess prev notes ignored
5. Empty prevVoicing: falls back to `voiceInRegister`

**Files created:**
- `src/voicing.ts` — 3 exported functions
- `src/__tests__/voicing.test.ts` — 30 tests across 6 describe blocks

**Tests:** 30 passing
- [x] `nearestMidiNote`: identity, upward nearest, downward nearest, tritone tie, low range, MIDI clamping (0/127), negative mod
- [x] `voiceInRegister`: C major, F major, default register, register shift, empty, single pc, 7th chord, MIDI range, order preservation
- [x] `voiceLead`: C→F (motion=3), C→Am (common tones), common tones (zero motion), chromatic mediant (motion=2)
- [x] Edge cases: empty pcs, empty prev, single pc, triad→7th (4th note near centroid), 7th→triad (excess ignored), identical chords
- [x] Musical: ii–V–I smooth motion (≤12 per step), C→Db chromatic (≤2 per voice)
- [x] Register parameter as fallback for empty prevVoicing

### 1d: Immediate Playback ✅

`src/synth.ts` — Per-voice AE-D2 signal chain. `src/immediate-playback.ts` — `playShape()`, `playPitchClasses()`, `stopAll()`.

**Architecture split:**
- `synth.ts` — low-level per-voice signal chain (`createVoice`, `midiToFreq`, `VoiceHandle`, `SYNTH_DEFAULTS`)
- `immediate-playback.ts` — high-level API managing voice sets, voice-leading integration, master gain normalization

**Files created:**
- `src/synth.ts` — 4 exports: `SYNTH_DEFAULTS`, `midiToFreq`, `VoiceHandle`, `createVoice`
- `src/immediate-playback.ts` — 5 exports: `ImmediatePlaybackState`, `createImmediatePlayback`, `playPitchClasses`, `playShape`, `stopAll`
- `src/__tests__/synth.test.ts` — 18 tests
- `src/__tests__/immediate-playback.test.ts` — 25 tests

**Tests:** 43 new (103 total)
- [x] `playShape()` creates audio nodes
- [x] `playPitchClasses()` creates audio nodes
- [x] `stopAll()` silences all active notes
- [x] Duration option schedules release after specified time
- [x] Velocity option affects gain

---

## Phase 2: Scheduled Playback & Transport

**Objective:** Implement progression scheduling, transport controls, and event subscriptions.

### 2a: Transport State Machine

`src/transport.ts` — Transport state management (stopped, playing, paused).

- `scheduleProgression(events)` — store chord events
- `play()` / `stop()` / `pause()` / `cancelSchedule()`
- `setTempo(bpm)` — update tempo
- State change event emission

**Tests:**
- [ ] State transitions: stopped → playing → paused → playing → stopped
- [ ] `scheduleProgression()` stores events
- [ ] `play()` no-op without scheduled progression
- [ ] `cancelSchedule()` clears progression and stops
- [ ] `setTempo()` updates tempo value
- [ ] `onStateChange()` fires on transitions
- [ ] Unsubscribe function works

### 2b: Scheduled Playback Engine

`src/scheduler.ts` — Schedule chord events relative to transport time.

- Convert beat times to AudioContext seconds using tempo
- Schedule notes with lookahead buffer
- Fire `onChordChange` events at chord boundaries
- Handle stop/pause mid-progression

**Tests:**
- [ ] Chord events scheduled at correct times
- [ ] `onChordChange()` fires at chord transitions
- [ ] Stop mid-progression cancels remaining events
- [ ] Pause preserves position
- [ ] Tempo change recalculates schedule

### 2c: Integration with Voicing

Wire scheduled playback through voicing model — each `ChordEvent.shape` is voiced and scheduled.

**Tests:**
- [ ] Scheduled shapes are voiced correctly
- [ ] Voice-leading applies across sequential chords
- [ ] Register consistency across progression

---

## Phase 3: Cross-Module Integration

**Objective:** Validate AudioTransport contract with Rendering/UI, end-to-end playback.

### 3a: AudioTransport Contract Tests

Verify the full `AudioTransport` interface matches ARCH_AUDIO_ENGINE.md §6.

**Tests:**
- [ ] All interface methods present and callable
- [ ] Event subscriptions work end-to-end
- [ ] Multiple subscribers receive events

### 3b: Integration with Rendering/UI

Wire `AudioTransport` to Rendering/UI's `PathHandle.setActiveChord()` and control panel callbacks.

**Tests:**
- [ ] `onChordChange` → `setActiveChord()` round-trip
- [ ] Play/stop buttons → transport state changes
- [ ] Tempo control → transport tempo update

---

## Phase 4: Review & Polish

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
Status: Tentative
Priority: Normal
Decision:
Debounce immediate playback triggers during drag-scrub. Exact timing TBD.
Rationale:
Prevent audio stuttering during rapid scrub across multiple triangles.
Revisit if: interaction testing reveals acceptable latency without debounce.
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
