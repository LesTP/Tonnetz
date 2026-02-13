# ARCH_AUDIO_ENGINE.md

Version: Draft 0.3
Date: 2026-02-12

---

## 1. Purpose and Scope

Audio Engine converts harmonic objects into audible output, performs voicing and voice-leading, and schedules playback for real-time interaction and progression playback.

---

## 2. Core Decisions

AE-D1 MIDI internal representation — Closed
AE-D2 Default synthesis model — Open
AE-D3 Voice-leading sophistication (Level 1) — Closed
AE-D4 Drag-trigger debounce — Tentative
AE-D5 Default chord-blending sound profile — Closed

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

```
initAudio()
playShape(shape, options)
playPitchClasses(pcs, options)
stopAll()
setTempo(bpm)
scheduleProgression(events)
cancelSchedule()
```

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
