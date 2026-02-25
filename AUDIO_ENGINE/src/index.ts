/**
 * Audio Engine — Tonnetz synthesis and playback module.
 * Public API surface per ARCH_AUDIO_ENGINE.md Section 6.
 */

// HC types consumed by Audio Engine public API
export type { Shape, Chord } from "harmony-core";

// Audio Engine types (ARCH §6)
export type {
  TransportState,
  ChordEvent,
  PlaybackStateChange,
  ChordChangeEvent,
  AudioTransport,
  PlayOptions,
  InitAudioOptions,
  PlaybackMode,
} from "./types.js";

// AudioContext initialization
export { initAudio, initAudioSync } from "./audio-context.js";

// Voicing model (ARCH §3)
export { nearestMidiNote, voiceInRegister, voiceLead } from "./voicing.js";

// Synthesis (AE-D2)
export { createVoice, midiToFreq, SYNTH_DEFAULTS } from "./synth.js";
export type { VoiceHandle } from "./synth.js";

// Immediate playback (ARCH §6.2)
export {
  createImmediatePlayback,
  playPitchClasses,
  playShape,
  stopAll,
  setPreset,
} from "./immediate-playback.js";
export type {
  ImmediatePlaybackState,
  CreateImmediatePlaybackOptions,
} from "./immediate-playback.js";

// Synthesis presets (Phase 3d)
export type {
  SynthPreset,
  PresetOscType,
  FilterBloom,
  LfoConfig,
  DelayConfig,
} from "./presets.js";
export {
  PRESET_SOFT_PAD,
  PRESET_CLASSIC,
  PRESET_WARM_PAD,
  PRESET_CATHEDRAL,
  PRESET_ELECTRIC_ORGAN,
  ALL_PRESETS,
  DEFAULT_PRESET,
  getPresetByName,
  getPeriodicWave,
  usesPeriodicWave,
  hasDelay,
  hasLfo,
  hasFilterBloom,
  validateGainStaging,
  CATHEDRAL_PARTIALS,
  ELECTRIC_ORGAN_PARTIALS,
} from "./presets.js";

// Effects chain (Phase 3d)
export type { EffectsChain } from "./effects.js";
export { createEffectsChain } from "./effects.js";

// Scheduled playback utilities (ARCH §5b)
export {
  beatsToSeconds,
  secondsToBeats,
  SCHEDULE_AHEAD_TIME,
  SCHEDULER_INTERVAL_MS,
} from "./scheduler.js";

// Scheduler internals — exported for integration tests and advanced use.
// Not part of the ARCH §6 public contract; integration module should use
// AudioTransport.play()/stop()/pause() instead of driving the scheduler directly.
export {
  createScheduler,
  startScheduler,
  stopScheduler,
  pauseScheduler,
  getCurrentBeat,
} from "./scheduler.js";
export type {
  ScheduledChord,
  SchedulerState,
  CreateSchedulerOptions,
} from "./scheduler.js";

// Shape[] → ChordEvent[] conversion (Phase 3)
export { shapesToChordEvents } from "./conversion.js";
