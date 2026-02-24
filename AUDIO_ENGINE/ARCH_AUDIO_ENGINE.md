# ARCH_AUDIO_ENGINE.md

Version: Draft 0.6
Date: 2026-02-22

---

## 1. Purpose and Scope

Audio Engine converts harmonic objects into audible output, performs voicing and voice-leading, and schedules playback for real-time interaction and progression playback.

---

## 2. Core Decisions

AE-D1 MIDI internal representation — Closed
AE-D2 Default synthesis model — Closed
AE-D3 Voice-leading sophistication (Level 1) — Closed
AE-D4 Drag-trigger debounce — Closed
AE-D5 Default chord-blending sound profile — Closed
AE-D9 Interactive playback wiring (triangle → playPitchClasses, not playShape) — Closed
AE-D10 Scheduler auto-stop must notify transport — Closed
AE-D11 Preserve currentChordIndex across pause/resume — Closed
AE-D12 Reset voice-leading state on stop — Closed
AE-D13 Staccato/Legato playback mode (POL-D19) — Closed
AE-D14 Hard-stop at chord boundary + 10ms fade-out (POL Phase 3a) — Closed
AE-D15 VoiceHandle.cancelRelease() for voice carry-forward (POL Phase 3b/3c) — Closed
AE-D16 Fixed per-voice gain 0.24 (no dynamic normalization) — Closed
AE-D19 Root-in-bass voicing rule (progression playback only) — **Open**

---

## 2b. Synthesis Model (AE-D2)

Detuned dual-oscillator pad with low-pass filter. Per-voice signal chain:

```
OscillatorNode (triangle, +2 cents)  ──┐
                                       ├──► GainNode (mix) ──► BiquadFilterNode (LP) ──► GainNode (ADSR) ──► master GainNode
OscillatorNode (sine, −2 cents)     ──┘
```

### Default Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Oscillator 1 type | `"triangle"` | Warm odd-harmonic content |
| Oscillator 2 type | `"sine"` | Adds fundamental body |
| Detune | ±2–4 cents | Chorusing; exact value tuned during implementation |
| Mix ratio | 0.5 / 0.5 | Equal blend; adjustable |
| LP filter cutoff | 1500 Hz | Softens upper harmonics (revised from 2000, POL Phase 3a) |
| LP filter Q | ~1.0 | Gentle rolloff, no resonant peak |
| Attack | 120 ms | Softer fade-in; chord transitions less percussive (revised from 50ms, POL Phase 3a) |
| Decay | ~200 ms | Settles to sustain level |
| Sustain | ~0.7 | Sustained pad level |
| Release | ~500 ms | Musical release tail |
| Per-voice mixGain | 0.24 | Fixed gain per voice (AE-D16) |

### Gain Normalization (AE-D16)

Per-voice `mixGain` is fixed at 0.24. With a maximum of 4 simultaneous voices, the sum is `4 × 0.24 = 0.96`, always under 1.0. Master gain stays at 1.0 permanently.

The previous dynamic normalization (`1/√n`) caused transient clipping because the master gain was set *after* voice creation — voices briefly attacked into an un-normalized gain of 1.0. Fixed per-voice gain eliminates this race.

### VoiceHandle Extensions (AE-D15)

`VoiceHandle` exposes `release(when?)` and `stop()` as before, plus:

- **`cancelRelease()`** — resets the `released` flag, clears the pending cleanup timer (`releaseCleanupId`), cancels the envelope ramp, and restores the sustain level (`peakGain × sustainLevel`). This enables voice carry-forward for sustained repeated chords (Phase 3b) and per-voice continuation in Legato mode (Phase 3c).
- **`release()`** no longer calls `osc.stop()` — oscillators stay alive; cleanup is deferred via `setTimeout → handle.stop()`. This allows `cancelRelease()` to reclaim a voice mid-release.
- **`stop()`** uses a 10ms envelope fade-out (`linearRampToValueAtTime(0, t + 0.01)`) before stopping oscillators, preventing DC clicks from instant disconnects (AE-D14).

### Node Budget

5 Web Audio nodes per voice × 4 voices = 20 nodes for a seventh chord. Well within browser limits.

---

## 3. Voicing Model

Converts a pitch-class set (from `Shape.covered_pcs`) into concrete MIDI note numbers, applying voice-leading when a previous voicing is available.

### Exported Functions

| Function | Purpose |
|----------|---------|
| `nearestMidiNote(target, pc)` | Core primitive: MIDI note with pitch class `pc` closest to `target` |
| `voiceInRegister(pcs, register?)` | Initial placement (no previous voicing) |
| `voiceLead(prevVoicing, newPcs, register?)` | Greedy minimal-motion voice-leading (AE-D3) |

### `nearestMidiNote(target, pc)`

Given a MIDI note `target` and a pitch class `pc` (0–11), returns the MIDI note with that pitch class closest to `target`.

```
diff = ((pc - target % 12) % 12 + 12) % 12
candidateUp   = target + diff
candidateDown = target + diff - 12
result = closer of the two (tritone ties prefer upward)
clamped to [0, 127]
```

### `voiceInRegister(pcs, register?)`

Initial placement when no previous voicing exists. Maps each pitch class to `nearestMidiNote(register, pc)`. Default register: 60 (middle C). Produces compact voicings clustered around the register.

### `voiceLead(prevVoicing, newPcs, register?)`

Greedy minimal-motion algorithm (AE-D3):

1. For every `(prevNote, newPc)` combination, compute `nearestMidiNote(prevNote, newPc)` and the absolute distance
2. Pick the pair with minimum distance, assign it, remove both from their pools
3. Repeat until one pool is exhausted
4. If new pitch classes remain (e.g., triad → 7th chord): place near centroid of previous voicing via `nearestMidiNote(centroid, pc)`
5. If previous notes remain (e.g., 7th chord → triad): excess ignored
6. Empty `prevVoicing`: falls back to `voiceInRegister`

Output order: `result[i]` always corresponds to `newPcs[i]` — preserves caller's pitch-class ordering.

### Musical Properties

| Progression | Total Motion | Behavior |
|-------------|-------------|----------|
| C → F major | 3 semitones | Smooth |
| C → Am (relative minor) | 2 semitones | Common tones preserved |
| C → E major (chromatic mediant) | 2 semitones | Efficient |
| ii–V–I (Dm7 → G7 → Cmaj7) | ≤12 per step | Smooth |
| C → Db (chromatic) | ≤2 per voice | Semitone motion |

### AE-D19: Root-in-bass voicing rule (Open)

**Status:** Open | **Priority:** Nice-to-have | **Date:** 2026-02-24

For progression playback (Shape-based), ensure the chord root is always the lowest sounding note. Interactive playback (triangle/edge taps via `playPitchClasses`) is excluded — root position is not enforced for exploratory interaction.

**Implementation:**

| Step | Location | Change |
|------|----------|--------|
| 1 | `voicing.ts` | New `ensureRootInBass(voicing, rootPc)` — find root voice, transpose down octave if not lowest |
| 2 | `immediate-playback.ts` | `playShape()` calls `ensureRootInBass()` after voicing |
| 3 | `scheduler.ts` | `scheduleChordVoices()` calls `ensureRootInBass()` after voicing |

**Scope:**
- ✓ Scheduled progression playback (Shape objects have `root_pc`)
- ✓ Interactive `playShape()` calls
- ✗ `playPitchClasses()` — no root indicator in current API

**Trade-offs:**
- Pro: Traditional root-position voicings, clearer harmonic foundation
- Con: Increased voice motion — root must jump to bass on every chord
- Con: May conflict with smooth voice-leading (AE-D3) when root moves by large interval

**Revisit if:** Users request root-position for interactive taps, or voice-leading sounds choppy with forced root motion.

---

## 4. Playback Modes

**AE-D6: Playback behavior tied to UI state transitions**
Status: Closed

Audio playback responds to UI states:

| UI State           | Audio behavior           |
| ------------------ | ------------------------ |
| Idle Exploration   | no scheduled playback    |
| Chord Selected     | immediate chord playback |
| Progression Loaded | ready state              |
| Playback Running   | scheduled playback       |

Note: Audio Engine is stateless with respect to UI state. It does not query or depend on the UI state controller. The integration module (see SPEC.md §Integration Module) checks UI state before invoking Audio Engine APIs — e.g., suppressing `playShape()` calls during Playback Running state (UX-D6).

---

## 5. Immediate vs Scheduled Playback

**AE-D7: Playback mode definitions**
Status: Closed

Audio Engine must support two modes:

Immediate mode:

* triggered by interaction events
* plays immediately without scheduling

Scheduled mode:

* triggered by progression playback
* events scheduled via shared transport timebase
* synchronized with renderer animation

**Shared Transport Timebase:**
The shared transport timebase is `AudioContext.currentTime` — the Web Audio API's monotonically increasing high-resolution clock. All scheduled playback events (Audio Engine) and synchronized animation frames (Rendering/UI) reference this single clock. The Audio Engine owns the `AudioContext` instance; Rendering/UI queries it for animation synchronization.

Mode switching must be deterministic.

### 5b. Scheduler Architecture

The scheduler implements the industry-standard Web Audio lookahead pattern for gap-free scheduled playback.

#### Data Flow

```
ChordEvent[] (startBeat, durationBeats, Shape)
    ↓
createScheduler(opts)       — pre-computes wall-clock times from beats + BPM
    ↓
SchedulerState { chords: ScheduledChord[], timerHandle, ... }
    ↓
startScheduler(state)       — setInterval @ 25ms, lookahead window 100ms
    ↓
tick()  → scheduleChordVoices()  → createVoice() (from synth.ts)
        → fire onChordChange() callbacks
        → auto-stop when progression ends
```

#### Lookahead Pattern

| Constant | Value | Purpose |
|----------|-------|---------|
| `SCHEDULER_INTERVAL` | 25 ms | Timer fires every 25ms |
| `SCHEDULER_LOOKAHEAD` | 100 ms | Looks 100ms ahead of current time |

Constraint: `LOOKAHEAD > INTERVAL` ensures gap-free coverage — each tick's lookahead window overlaps the next tick's start.

#### Pre-Computed Wall-Clock Times

On `createScheduler()`, each chord's beat-relative timing is converted to absolute wall-clock times once:

```
origin = AudioContext.currentTime - beatsToSeconds(beatOffset, bpm)
slot.startTime = origin + beatsToSeconds(chord.startBeat, bpm)
slot.endTime   = origin + beatsToSeconds(chord.startBeat + chord.durationBeats, bpm)
```

Pre-computation avoids per-tick floating-point accumulation drift.

#### Beat↔Time Conversion

```
beatsToSeconds(beats, bpm)  = (beats / bpm) × 60
secondsToBeats(seconds, bpm) = (seconds / 60) × bpm
```

#### Pause/Resume via Beat Offset

`pauseScheduler()` captures the current beat position. On resume, `createScheduler()` receives this beat offset and shifts the playback origin backward so remaining chords land at the correct future wall-clock times. Previous voicing state is also preserved for voice-leading continuity across pause/resume.

#### Per-Chord Scheduling

`scheduleChordVoices()` for each chord in the lookahead window:
1. **Hard-stop previous voices** (AE-D14): if `idx > 0`, call `voice.stop()` on all previous chord's voices before creating new ones. Prevents release-tail overlap that causes clipping.
2. Extract pitch classes from `chord.shape.covered_pcs`
3. **Chord boundary decision tree** (AE-D13, AE-D15):
   - If `samePitchClasses(prevPcs, currentPcs)` → **carry all voices forward** (both modes): `cancelRelease()` on each voice, reschedule `release()` at new end time, early return. No new voices created.
   - Else if `padMode` (Legato) → **per-voice diff**: common MIDI notes get `cancelRelease()` + re-release; departing notes get `release()` with 500ms tail; arriving notes get fresh `createVoice()`.
   - Else (Staccato) → hard-stop all + fresh attack (step 1 already ran).
4. Apply voice-leading (`voiceLead` or `voiceInRegister` for first chord)
5. Create voices via `createVoice()` at `slot.startTime`
6. Schedule release at `slot.endTime`

Voice-leading state (`prevVoicing`) threads through sequential chord scheduling.

`SchedulerState.padMode` is set at creation via `CreateSchedulerOptions.padMode` and reflects the transport's `getPadMode()` value at the time `play()` is called.

#### Exported Functions

| Function | Purpose |
|----------|---------|
| `beatsToSeconds(beats, bpm)` | Pure conversion |
| `secondsToBeats(seconds, bpm)` | Inverse conversion |
| `createScheduler(opts)` | Build SchedulerState with pre-computed times |
| `startScheduler(state)` | Begin lookahead loop |
| `stopScheduler(state)` | Hard-stop all voices, clear timer |
| `pauseScheduler(state)` | Release voices smoothly, return current beat |
| `getCurrentBeat(state)` | Live beat position from elapsed time |

---

## 6. Public API (Module Interface)

### 6.1 AudioTransport Interface

The `AudioTransport` interface is the primary cross-module contract between Audio Engine and Rendering/UI. Rendering/UI depends on this interface for playback animation synchronization.

```ts
/**
 * Transport state for progression playback.
 */
interface TransportState {
  /** True if scheduled playback is active */
  readonly playing: boolean;
  /** Current tempo in beats per minute */
  readonly tempo: number;
  /** Index of the currently active chord (0-based), or -1 if not playing */
  readonly currentChordIndex: number;
  /** Total number of chords in the scheduled progression */
  readonly totalChords: number;
}

/**
 * Scheduled chord event for progression playback.
 */
interface ChordEvent {
  /** Shape to play (from Harmony Core) */
  readonly shape: Shape;
  /** Start time in beats (relative to playback start) */
  readonly startBeat: number;
  /** Duration in beats */
  readonly durationBeats: number;
}

/**
 * Playback state change event payload.
 */
interface PlaybackStateChange {
  readonly playing: boolean;
  readonly timestamp: number;  // AudioContext.currentTime at state change
}

/**
 * Chord change event payload (fired when active chord changes during playback).
 */
interface ChordChangeEvent {
  readonly chordIndex: number;
  readonly shape: Shape;
  readonly timestamp: number;
}

/**
 * AudioTransport — shared transport timebase for synchronized playback.
 *
 * Audio Engine owns the AudioContext instance. Rendering/UI queries the
 * transport for animation synchronization.
 */
interface AudioTransport {
  // === Time Queries ===

  /**
   * Returns the current AudioContext time in seconds.
   * Monotonically increasing high-resolution clock.
   */
  getTime(): number;

  /**
   * Returns the AudioContext instance (for advanced use cases).
   * Rendering/UI should prefer getTime() for synchronization.
   */
  getContext(): AudioContext;

  // === State Queries ===

  /**
   * Returns the current transport state snapshot.
   */
  getState(): TransportState;

  /**
   * Returns true if scheduled playback is active.
   * Shorthand for getState().playing.
   */
  isPlaying(): boolean;

  /**
   * Returns the current tempo in BPM.
   */
  getTempo(): number;

  /**
   * Returns the index of the currently playing chord (0-based),
   * or -1 if no progression is playing.
   */
  getCurrentChordIndex(): number;

  /**
   * Returns the current playback mode.
   * "piano" = Staccato (hard-stop at boundary), "pad" = Legato (per-voice continuation).
   */
  getPadMode(): boolean;

  // === Playback Control ===

  /**
   * Sets the tempo for scheduled playback.
   * @param bpm - Beats per minute (e.g., 120)
   */
  setTempo(bpm: number): void;

  /**
   * Sets the playback mode.
   * @param enabled - true for Legato (pad), false for Staccato (piano)
   * Takes effect on next play() — does not affect in-progress scheduled playback.
   * For immediate playback, the change is applied immediately via ImmediatePlaybackState.padMode.
   */
  setPadMode(enabled: boolean): void;

  /**
   * Sets the synthesis preset for scheduled playback.
   * Takes effect on next play() — does not affect in-progress scheduled playback.
   * @param preset - SynthPreset from presets.ts
   */
  setPreset(preset: SynthPreset): void;

  /**
   * Returns the current synthesis preset.
   */
  getPreset(): SynthPreset;

  /**
   * Schedules a progression for playback.
   * Does not start playback — call play() after scheduling.
   * @param events - Array of ChordEvent objects
   */
  scheduleProgression(events: readonly ChordEvent[]): void;

  /**
   * Starts scheduled playback from the beginning.
   * No-op if no progression is scheduled.
   */
  play(): void;

  /**
   * Stops playback and resets to the beginning.
   */
  stop(): void;

  /**
   * Pauses playback at the current position.
   * Call play() to resume.
   */
  pause(): void;

  /**
   * Cancels the scheduled progression and stops playback.
   */
  cancelSchedule(): void;

  // === Event Subscriptions ===

  /**
   * Subscribes to playback state changes (play/stop/pause).
   * @returns Unsubscribe function
   */
  onStateChange(callback: (event: PlaybackStateChange) => void): () => void;

  /**
   * Subscribes to chord change events during playback.
   * Fired when the active chord index changes.
   * @returns Unsubscribe function
   */
  onChordChange(callback: (event: ChordChangeEvent) => void): () => void;
}
```

### 6.2 Immediate Playback API

Immediate (non-scheduled) chord playback triggered by user interaction. Uses a stateful pattern: `createImmediatePlayback()` returns an `ImmediatePlaybackState` that manages the master gain node, active voice tracking, previous voicing for voice-leading continuity, and playback mode (`padMode`). All playback functions require this state as their first argument.

`ImmediatePlaybackState.padMode` is mutable — the integration module flips it directly when the sidebar toggle changes. In Legato mode, `playPitchClasses()` performs the same voice-diff as the scheduler: common tones sustain, departing tones release with a 500ms tail, arriving tones get fresh attacks. Identical consecutive pitch-class sets (e.g., repeated clicks on the same triangle) carry all voices forward via `cancelRelease()`.

```ts
/**
 * Immediate playback options.
 */
interface PlayOptions {
  /** Target register in MIDI note number (default: 60 = middle C) */
  readonly register?: number;
  /** Velocity 0–127 (default: 100) */
  readonly velocity?: number;
  /** Duration in seconds (default: sustained until stopAll) */
  readonly duration?: number;
}

/**
 * Opaque state object for immediate playback.
 * Manages master gain, active voices, and previous voicing for voice-leading.
 * Created once per session via createImmediatePlayback().
 */
interface ImmediatePlaybackState {
  /** Mutable playback mode — flipped by sidebar toggle */
  padMode: boolean;
  /* ...remaining fields opaque */
}

/**
 * Initialize the audio system. Must be called after user gesture
 * (browser autoplay policy).
 */
function initAudio(options?: InitAudioOptions): Promise<AudioTransport>;

/**
 * Create immediate playback state. Call once after initAudio().
 * Connects a master gain node to the AudioContext destination.
 * @param transport - AudioTransport returned by initAudio()
 */
function createImmediatePlayback(transport: AudioTransport): ImmediatePlaybackState;

/**
 * Play a Shape immediately (interactive mode).
 * Releases previous voices, applies voice-leading from prior voicing,
 * and normalizes gain by 1/sqrt(voiceCount).
 * @param state - ImmediatePlaybackState from createImmediatePlayback()
 * @param shape - Shape from Harmony Core (extracts shape.covered_pcs)
 * @param options - Playback options
 */
function playShape(state: ImmediatePlaybackState, shape: Shape, options?: PlayOptions): void;

/**
 * Play a pitch-class set immediately (interactive mode).
 * Same voice-leading and gain normalization as playShape.
 * @param state - ImmediatePlaybackState from createImmediatePlayback()
 * @param pcs - Array of pitch classes (0–11)
 * @param options - Playback options
 */
function playPitchClasses(state: ImmediatePlaybackState, pcs: readonly number[], options?: PlayOptions): void;

/**
 * Stop all currently sounding notes (immediate mode).
 * Hard-stops all voices, clears voicing state, resets master gain.
 * @param state - ImmediatePlaybackState from createImmediatePlayback()
 */
function stopAll(state: ImmediatePlaybackState): void;
```

### 6.3 Cross-Module Usage Patterns

**Immediate playback (integration module wires interaction → audio per AE-D9):**

```ts
// In integration module — wires Rendering/UI interaction to Audio Engine
const transport = await initAudio();
const playback = createImmediatePlayback(transport);

// InteractionController emits selection callbacks with pitch classes
createInteractionController({
  // ... other options ...
  callbacks: {
    onTriangleSelect: (_triId, pcs) => playPitchClasses(playback, pcs),
    onEdgeSelect: (_edgeId, _triIds, pcs) => playPitchClasses(playback, pcs),
    onPointerUp: () => stopAll(playback),
  }
});
```

**Scheduled playback animation (Rendering/UI consumes AudioTransport):**

```ts
// In Rendering/UI playback animation module
const transport = await initAudio();

// Subscribe to chord changes for highlight updates
const unsubChord = transport.onChordChange((event) => {
  highlightChordAtIndex(event.chordIndex);
});

// Subscribe to state changes for play/stop UI updates
const unsubState = transport.onStateChange((event) => {
  updatePlayButtonState(event.playing);
});

// Animation frame loop synced to transport time
function animate() {
  if (transport.isPlaying()) {
    const time = transport.getTime();
    updatePathProgress(time);
  }
  requestAnimationFrame(animate);
}
```

### 6.4 Decision: Event-Driven vs Polling

**AE-D8: Hybrid event + polling synchronization**
Status: Closed
Priority: Important

Rendering/UI uses a hybrid approach:
- **Event-driven:** `onChordChange` for discrete chord transitions (highlight updates)
- **Polling:** `getTime()` in rAF loop for continuous animation (path progress)

Rationale: Events avoid missed transitions; polling provides smooth animation. Both reference the same `AudioContext.currentTime` clock.

---

## 7. Testing Strategy

### Test Infrastructure

- **Framework:** Vitest 3.x (consistent with HC and RU)
- **Web Audio mocking:** Dependency injection via `InitAudioOptions.AudioContextClass` (AE-DEV-D1). Lightweight manual mock (`web-audio-mock.ts`) — no npm mock dependencies.
- **Environment:** Node.js (no DOM — Audio Engine has no UI layer)

### Test Coverage

| Test File | Tests | Covers |
|-----------|-------|--------|
| `smoke.test.ts` | 1 | Barrel export resolves with expected public API |
| `presets.test.ts` | 98 | Preset validation, gain staging, registry, utility functions, PeriodicWave cache |
| `effects.test.ts` | 29 | EffectsChain creation, reconfigure, damping, feedback, destroy, node budget |
| `scheduler.test.ts` | 54 | beatsToSeconds, secondsToBeats, createScheduler, startScheduler, stopScheduler, pauseScheduler, getCurrentBeat, transport integration, onComplete callback (AE-D10) |
| `audio-context.test.ts` | 39 | initAudio, transport state machine, play/stop/pause/cancel, event subscriptions, tempo, suspended context, natural completion (AE-D10), pause/resume chord index (AE-D11), voice-leading reset on stop (AE-D12) |
| `immediate-playback.test.ts` | 37 | createImmediatePlayback, playPitchClasses, playShape, stopAll, voice-count normalization, duration, velocity, preset handling |
| `voicing.test.ts` | 30 | nearestMidiNote, voiceInRegister, voiceLead, edge cases, musical progressions |
| `synth.test.ts` | 26 | midiToFreq, createVoice signal chain, velocity scaling, release/stop idempotency, cancelRelease |
| `cross-module.test.ts` | 7 | HC Shape → playShape, HC getTrianglePcs → playPitchClasses, HC getEdgeUnionPcs → playPitchClasses, ChordEvent scheduling, onChordChange subscribers |
| `conversion.test.ts` | 5 | shapesToChordEvents: empty, single, multiple, custom beatsPerChord, reference preservation |
| `integration-e2e.test.ts` | 3 | ii–V–I pipeline (HC→AE→events), triangle tap → 3 voices, edge union → 4 voices |
| **Total** | **329** | |

### Latency Analysis (Static)

Interaction → audio onset critical path:
- `voiceLead()`: O(n²) where n ≤ 4 → ~5 μs
- `createVoice()` × 3–4 voices: ~100–200 μs (5 Web Audio nodes each)
- Master gain update: ~1 μs
- **JS overhead: ~0.2–0.5 ms**
- Platform audio output buffer: ~3–10 ms (128 samples @ 44.1 kHz)
- **Total: ~3–10 ms ≪ 50 ms target ✅**

---

## 8. Bug Fix Decisions

```
AE-D10: Scheduler auto-stop must notify transport
Date: 2026-02-15
Status: Closed
Priority: Important
Bug:
When a progression played to completion, the scheduler's tick() called
stopScheduler() internally but never notified the transport closure.
transport.isPlaying() remained true, and no onStateChange event fired.
Rendering/UI would never learn that playback ended.
Fix:
Added an onComplete callback to CreateSchedulerOptions. The scheduler calls
onComplete() after stopScheduler() when the last chord's endTime is reached.
The transport's play() provides an onComplete that sets playing=false,
resets currentChordIndex to -1, clears pausedBeatOffset, nullifies the
scheduler, and fires emitStateChange().
Files: scheduler.ts, audio-context.ts
```

```
AE-D11: Preserve currentChordIndex across pause/resume
Date: 2026-02-15
Status: Closed
Priority: Important
Bug:
play() unconditionally set currentChordIndex = 0. After pause() and resume,
getCurrentChordIndex() briefly returned 0 instead of the paused chord index,
creating a transient inconsistency until the scheduler tick fired the correct
onChordChange event. Additionally, the scheduler would re-fire onChordChange
for chords that were already played before the pause.
Fix:
(1) In play(), currentChordIndex is only reset to 0 when pausedBeatOffset === 0
(fresh start). On resume, the paused value is preserved.
(2) In createScheduler(), when beatOffset > 0, chords whose endTime is already
past are pre-marked as changeFired=true and scheduled=true so tick() won't
re-fire their events.
Files: audio-context.ts, scheduler.ts
```

```
AE-D12: Reset voice-leading state on stop
Date: 2026-02-15
Status: Closed
Priority: Minor
Bug:
stop() called cleanupScheduler() which saved prevVoicing from the scheduler,
but never cleared it. A subsequent play() would voice-lead the first chord
from the last voicing of the previous run instead of starting fresh with
voiceInRegister().
Fix:
Added prevVoicing = [] in stop() and cancelSchedule() after cleanupScheduler().
pause() intentionally preserves prevVoicing for voice-leading continuity on
resume.
Files: audio-context.ts
```

---

## 8b. Playback Mode Decisions

```
AE-D13: Staccato/Legato playback mode
Date: 2026-02-19
Status: Closed
Priority: Important
Decision:
Two playback modes toggled via sidebar: Staccato (hard-stop at chord boundary,
fresh attack) and Legato (per-voice continuation — common tones sustain,
departing tones release with 500ms tail, arriving tones fresh attack).
Both modes sustain identical consecutive chords (voice carry-forward).
Rationale:
Staccato suits rhythmic progressions; Legato suits smooth pad-style listening.
Voice carry-forward for repeated chords is desirable in both modes.
Revisit if: More than two modes are needed (e.g., a percussive stab mode).
```

```
AE-D14: Hard-stop at chord boundary with 10ms fade-out
Date: 2026-02-19
Status: Closed
Priority: Critical
Bug:
Previous voices' 500ms release tails overlapped with new voices' attack envelopes,
sum exceeded 1.0, causing audible crackling/clipping.
Fix:
Hard-stop all previous chord's voices before creating new ones (Staccato mode
default). stop() redesigned: 10ms linearRamp to zero + deferred oscillator stop,
preventing DC click from instant disconnect.
Files: synth.ts, scheduler.ts, immediate-playback.ts
```

```
AE-D15: VoiceHandle.cancelRelease() for voice carry-forward
Date: 2026-02-20
Status: Closed
Priority: Important
Decision:
Added cancelRelease() to VoiceHandle. Resets released flag, clears pending cleanup
timer, cancels envelope ramp, restores sustain level. release() no longer calls
osc.stop() — oscillators stay alive for potential reclamation.
Rationale:
Both sustained repeated chords (3b) and Legato per-voice continuation (3c) require
carrying voices across chord boundaries. cancelRelease() is the primitive that
enables this.
Revisit if: Never — foundational infrastructure for any voice-reuse pattern.
```

```
AE-D16: Fixed per-voice gain 0.24 (no dynamic normalization)
Date: 2026-02-20
Status: Closed
Priority: Critical
Bug:
Dynamic masterGain normalization (1/√n) was set after voice creation. During the
creation loop, voices attacked into un-normalized master gain (1.0), causing
transient clipping (3 voices × 0.5 × 1.0 = 1.5).
Fix:
Set mixGain.gain.value = 0.24 per voice. Max 4 voices: 4 × 0.24 = 0.96 < 1.0.
Removed all dynamic masterGain normalization. Master gain stays at 1.0.
Files: synth.ts, immediate-playback.ts, scheduler.ts
```

```
AE-D17: DynamicsCompressorNode as safety limiter
Date: 2026-02-24
Status: Closed
Priority: High
Issue:
Loop restart crackle — when a progression loops, old voices' release tails +
delay echoes overlap with new voices' attack. Sum exceeds 1.0, causing clipping.
Worst on presets with long release (Glass 1.6s, Warm/Breathing Pad 1.4s).
Decision:
Insert a DynamicsCompressorNode after effectsChain.output, before ctx.destination.
Acts as a brickwall limiter to catch transient peaks from loop transitions,
preset switching, or any other unforeseen gain spikes.
Parameters: threshold -6dB, knee 6dB, ratio 12:1, attack 3ms, release 100ms.
Node budget: +1 global node (max 37 < 40).
Rationale:
- Hard-stopping voices at loop restart would create an audible gap
- Compressor catches peaks automatically without audible artifacts
- Also provides safety net for future changes
Files: effects.ts
Revisit if: Compressor causes audible pumping/breathing on sustained chords.
```

```
AE-D18: Increase voice.stop() fade-out from 10ms to 50ms
Date: 2026-02-24
Status: Closed (already implemented)
Priority: Medium
Issue:
Staccato mode sounds too abrupt — 10ms fade-out is imperceptible as a decay,
sounds like a hard cut rather than a musical note ending.
Decision:
Increase STOP_FADE_TIME from 0.01s to 0.05s (50ms).
Note: Upon investigation, synth.ts already used fadeOut = 0.05 (50ms).
This was implemented as part of the original preset work. No change needed.
Rationale:
- 50ms is audible as a short decay (not a click)
- Still short enough to maintain rhythmic separation
- At 180 BPM: beat = 333ms, 50ms = 15% of beat (acceptable)
- At 120 BPM: beat = 500ms, 50ms = 10% of beat (comfortable)
Files: synth.ts
Revisit if: Fast-tempo progressions sound smeared.
```

---

## 8c. Future Extensions

* sampled instruments
* richer synthesis (Phase 3d: waveform, reverb, filter exploration)
* MIDI export
