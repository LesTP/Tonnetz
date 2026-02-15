# ARCH_AUDIO_ENGINE.md

Version: Draft 0.4
Date: 2026-02-13

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
| LP filter cutoff | ~2000 Hz | Softens upper harmonics |
| LP filter Q | ~1.0 | Gentle rolloff, no resonant peak |
| Attack | ~50 ms | Fast enough for interaction responsiveness |
| Decay | ~200 ms | Settles to sustain level |
| Sustain | ~0.7 | Sustained pad level |
| Release | ~500 ms | Overlapping tails for chord blending (AE-D5) |

### Voice-Count Normalization

Master gain scaled by `1 / sqrt(voiceCount)` to prevent clipping with 3–4 simultaneous notes while maintaining perceived loudness.

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
1. Extract pitch classes from `chord.shape.covered_pcs`
2. Apply voice-leading (`voiceLead` or `voiceInRegister` for first chord)
3. Create voices via `createVoice()` at `slot.startTime`
4. Schedule release at `slot.endTime`
5. Normalize master gain by `1 / √(voiceCount)`

Voice-leading state (`prevVoicing`) threads through sequential chord scheduling.

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

  // === Playback Control ===

  /**
   * Sets the tempo for scheduled playback.
   * @param bpm - Beats per minute (e.g., 120)
   */
  setTempo(bpm: number): void;

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

Immediate (non-scheduled) chord playback triggered by user interaction. Uses a stateful pattern: `createImmediatePlayback()` returns an `ImmediatePlaybackState` that manages the master gain node, active voice tracking, and previous voicing for voice-leading continuity. All playback functions require this state as their first argument.

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
interface ImmediatePlaybackState { /* opaque */ }

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

**Immediate playback (integration module wires interaction → audio):**

```ts
// In integration module — wires Rendering/UI interaction to Audio Engine
const transport = await initAudio();
const playback = createImmediatePlayback(transport);

// InteractionController emits selection callbacks
createInteractionController({
  // ... other options ...
  callbacks: {
    onTriangleSelect: (triId, shape) => playShape(playback, shape),
    onEdgeSelect: (edgeId, pcs) => playPitchClasses(playback, pcs),
    onSelectionClear: () => stopAll(playback),
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

* deterministic voicing tests
* scheduling accuracy tests
* latency tests

---

## 8. Future Extensions

* sampled instruments
* richer synthesis
* MIDI export
