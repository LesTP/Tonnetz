/**
 * Persistence/Data — client-side persistence module.
 * Public API surface per ARCH_PERSISTENCE_DATA.md Section 7.
 */

// Types
export type {
  GridValue,
  ProgressionRecord,
  SettingsRecord,
  SharePayload,
} from "./types.js";

// Constants
export {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_GRID,
  DEFAULT_SETTINGS,
  generateId,
} from "./types.js";

// Storage
export type { StorageBackend } from "./storage.js";
export {
  createMemoryStorageBackend,
  createLocalStorageBackend,
  StorageError,
} from "./storage.js";

// Progressions
export {
  saveProgression,
  loadProgression,
  listProgressions,
  deleteProgression,
} from "./progressions.js";

// Sharing
export { encodeShareUrl, decodeShareUrl } from "./sharing.js";

// Migration
export { migrateProgression } from "./migration.js";
export type { MigrationFn } from "./migration.js";

// Settings
export { loadSettings, saveSettings } from "./settings.js";
