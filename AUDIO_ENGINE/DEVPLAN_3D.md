# DEVPLAN — Phase 3d: Synthesis Preset Exploration

Module: Audio Engine (cross-cutting with Integration)
Parent: MVP_POLISH/DEVPLAN.md §Phase 3d
DEVLOG: AUDIO_ENGINE/DEVLOG_3D.md
References: AUDIO_ENGINE/SOUND_SCULPTING.md, AUDIO_ENGINE/SOUND_SCULPTING_1.md
Date: 2026-02-25

---

## Cold Start Summary

**What this is:** Preset-toggle system for synthesis presets. Phase complete — 4 presets ship.

**Key constraints (still in effect if revisited):**
- No changes to `VoiceHandle` interface — release/cancelRelease/stop unchanged
- Node budget: ≤8 per voice × 4 voices + ≤8 global
- Per-voice gain ≤0.24 (AE-D16)
- Presets are static objects — no runtime user-adjustable knobs

**Gotchas (still in effect if revisited):**
- `createVoice()` is called from `immediate-playback.ts` (2×) and `scheduler.ts` (2×) — all 4 call sites must pass the preset
- `PeriodicWave` must be created from an `AudioContext` — build once at init, not per voice
- Global delay feedback loop requires `delayTime` ≥ one render quantum (~2.9ms)
- Scheduler's `scheduleChordVoices()` creates voices at future `slot.startTime` — filter bloom and LFO must work with scheduled `when` parameter
- The `stop()` fade-out (50ms) and `release()` cleanup must disconnect LFO nodes too

---

## Current Status

**Phase:** Complete (closed).
**Outcome:** 4 presets ship. Breathing Pad + Glass Harmonica removed, Classic renamed to Soft Pad. Dropdown UI retained.
**Revisitable:** Yes — parameter tuning or preset additions may happen during normal use.

---

## SynthPreset Type Reference

Retained as quick reference for future preset work. Canonical definition in `AUDIO_ENGINE/src/presets.ts`.

```ts
interface SynthPreset {
  readonly name: string;
  readonly label: string;
  readonly osc1Type: OscillatorType | "periodic";
  readonly osc2Type: OscillatorType | "periodic" | "sub";
  readonly osc1Gain: number;
  readonly osc2Gain: number;
  readonly detuneCents: number;
  readonly periodicWavePartials?: readonly number[];
  readonly filterCutoff: number;
  readonly filterQ: number;
  readonly filterBloom?: { start, peak, settle, timeConstant };
  readonly attackTime: number;
  readonly decayTime: number;
  readonly sustainLevel: number;
  readonly releaseTime: number;
  readonly lfo?: { rate, depth, target: "filter" | "pitch" };
  readonly delay?: { time1, feedback1, damping1, ..., wet, dry };
  readonly outputGain?: number;
}
```

---

## Completed Steps (see DEVLOG_3D for detail)

| Step | Summary | DEVLOG_3D |
|------|---------|-----------|
| 1 | Preset infrastructure + 6 presets + effects chain + limiter + integration wiring | Entries 1–6 |
| 2 | A/B listening: all 6 evaluated, 2 removed (Breathing Pad, Glass), 1 renamed (Classic→Soft Pad) | Entry 7 |
| 3 | Lock & clean: 4 presets final, tests updated, dropdown retained | Entry 8 |
