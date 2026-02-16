/**
 * Integration Module — Tonnetz Application Orchestrator.
 *
 * Public API surface. The integration module's primary entry point is
 * `main.ts` (loaded via `index.html`). This barrel re-exports utilities
 * and types that may be useful for testing or future embedding.
 */

// Grid-to-beat bridging (Phase 2a)
export { gridToBeatsPerChord, collapseRepeatedChords } from "./grid-to-beats.js";
export type { CollapsedChord } from "./grid-to-beats.js";

// Progression pipeline (Phase 2b/2c + Phase 0b input cleaning)
export {
  parseProgressionInput,
  loadProgressionPipeline,
  cleanChordSymbol,
} from "./progression-pipeline.js";
export type {
  PipelineSuccess,
  PipelineError,
  PipelineResult,
  PipelineArgs,
  CleanResult,
} from "./progression-pipeline.js";

// Interaction wiring (Phase 3)
export {
  createAppAudioState,
  ensureAudio,
  createInteractionWiring,
} from "./interaction-wiring.js";
export type {
  AppAudioState,
  InteractionWiringOptions,
} from "./interaction-wiring.js";

// Transport wiring (Phase 4)
export {
  wireTransportToPath,
  wireTransportToUIState,
  wireTransportToControlPanel,
  wireAllTransportSubscriptions,
  createControlPanelCallbacks,
} from "./transport-wiring.js";
export type { ControlPanelWiringOptions } from "./transport-wiring.js";

// Persistence wiring (Phase 5)
export {
  initPersistence,
  checkUrlHash,
  saveCurrentProgression,
  loadSavedProgression,
  listSavedProgressions,
  deleteSavedProgression,
  generateShareUrl,
  updateSettings,
  DEFAULT_SETTINGS,
  DEFAULT_GRID,
} from "./persistence-wiring.js";
export type {
  AppPersistenceState,
  UrlHashResult,
  UrlHashEmpty,
  UrlHashCheck,
  SaveProgressionArgs,
} from "./persistence-wiring.js";

// Keyboard shortcuts (Phase 7c)
export { createKeyboardShortcuts } from "./keyboard-shortcuts.js";
export type { KeyboardShortcutOptions } from "./keyboard-shortcuts.js";

// Debug logger (Phase 7c)
export { log } from "./logger.js";

// Application assembly (Phase 6) — destroyApp from main.ts
// Note: destroyApp is exported from main.ts directly (side-effecting entry point).
// It is not re-exported here to avoid triggering app initialization on import.
