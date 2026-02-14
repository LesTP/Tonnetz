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
AE-D4 Drag-trigger debounce — Tentative
AE-D5 Default chord-blending sound profile — Closed

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

Input:

* pitch-class set from Shape

Process:

1. choose octave placements around target register
2. apply greedy minimal-motion mapping
3. output MIDI note list

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

Functions for immediate (non-scheduled) chord playback triggered by user interaction.

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
 * Initialize the audio system. Must be called after user gesture
 * (browser autoplay policy).
 */
function initAudio(): Promise<AudioTransport>;

/**
 * Play a Shape immediately (interactive mode).
 * @param shape - Shape from Harmony Core
 * @param options - Playback options
 */
function playShape(shape: Shape, options?: PlayOptions): void;

/**
 * Play a pitch-class set immediately (interactive mode).
 * @param pcs - Array of pitch classes (0–11)
 * @param options - Playback options
 */
function playPitchClasses(pcs: readonly number[], options?: PlayOptions): void;

/**
 * Stop all currently sounding notes (immediate mode).
 */
function stopAll(): void;
```

### 6.3 Cross-Module Usage Pattern

**Rendering/UI consumes AudioTransport for playback animation:**

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
