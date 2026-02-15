/**
 * Persistence wiring for the integration module.
 *
 * Phase 5a: Storage initialization, startup settings, URL hash detection.
 * Phase 5b: Save/Load/Share actions for progressions and settings.
 *
 * Bridges Persistence/Data APIs to the application lifecycle:
 * - Creates StorageBackend at startup
 * - Loads and applies saved settings (tempo)
 * - Detects and decodes shared progression URLs on startup
 * - Provides save/load/share action functions for UI callbacks
 *
 * See DEVPLAN §Phase 5.
 */

import type {
  StorageBackend,
  SettingsRecord,
  ProgressionRecord,
  SharePayload,
  GridValue,
} from "persistence-data";
import {
  createLocalStorageBackend,
  loadSettings,
  saveSettings,
  saveProgression,
  loadProgression,
  listProgressions,
  deleteProgression,
  encodeShareUrl,
  decodeShareUrl,
  DEFAULT_SETTINGS,
  DEFAULT_GRID,
} from "persistence-data";

// ── Phase 5a: Storage Initialization ────────────────────────────────

/** Application-level persistence state. */
export interface AppPersistenceState {
  readonly backend: StorageBackend;
  settings: SettingsRecord;
}

/**
 * Initialize persistence: create StorageBackend and load settings.
 *
 * Called once at startup (SPEC §Startup Sequence step 1–2).
 */
export function initPersistence(): AppPersistenceState {
  const backend = createLocalStorageBackend();
  const settings = loadSettings(backend);
  return { backend, settings };
}

// ── Phase 5a: URL Hash Detection ────────────────────────────────────

/** Result of checking the URL hash for a shared progression. */
export interface UrlHashResult {
  readonly found: true;
  readonly payload: SharePayload;
}

export interface UrlHashEmpty {
  readonly found: false;
}

export type UrlHashCheck = UrlHashResult | UrlHashEmpty;

/**
 * Check `location.hash` for a shared progression payload.
 *
 * Expects format `#p=<encoded>` where `<encoded>` is the output of
 * `encodeShareUrl()`. Returns the decoded `SharePayload` if valid,
 * or `{ found: false }` if no hash, wrong prefix, or decode failure.
 *
 * Logs a warning on decode failure (malformed URL) but does not throw.
 *
 * @param hash — `location.hash` string (including leading `#`)
 */
export function checkUrlHash(hash: string): UrlHashCheck {
  if (!hash || !hash.startsWith("#p=")) {
    return { found: false };
  }

  const encoded = hash.slice(3); // strip "#p="
  if (!encoded) {
    return { found: false };
  }

  const payload = decodeShareUrl(encoded);
  if (!payload) {
    console.warn("[Tonnetz] Invalid shared progression URL, ignoring:", hash);
    return { found: false };
  }

  return { found: true, payload };
}

// ── Phase 5b: Save/Load/Share Actions ───────────────────────────────

/** Options for saving the current progression. */
export interface SaveProgressionArgs {
  readonly title: string;
  readonly chords: readonly string[];
  readonly tempo_bpm: number;
  readonly grid: GridValue;
}

/**
 * Save the current progression to local storage.
 *
 * @returns The saved `ProgressionRecord` (includes generated ID and timestamps).
 */
export function saveCurrentProgression(
  state: AppPersistenceState,
  args: SaveProgressionArgs,
): ProgressionRecord {
  return saveProgression(state.backend, {
    title: args.title,
    chords: args.chords,
    tempo_bpm: args.tempo_bpm,
    grid: args.grid,
    notes: "",
  });
}

/**
 * Load a progression by ID from local storage.
 *
 * @returns The progression record, or `null` if not found.
 */
export function loadSavedProgression(
  state: AppPersistenceState,
  id: string,
): ProgressionRecord | null {
  return loadProgression(state.backend, id);
}

/**
 * List all saved progressions, sorted by most recent first.
 */
export function listSavedProgressions(
  state: AppPersistenceState,
): ProgressionRecord[] {
  return listProgressions(state.backend);
}

/**
 * Delete a saved progression by ID.
 */
export function deleteSavedProgression(
  state: AppPersistenceState,
  id: string,
): void {
  deleteProgression(state.backend, id);
}

/**
 * Generate a shareable URL fragment for the current progression.
 *
 * Returns the full hash string (e.g., `"#p=Dm7-G7-Cmaj7&t=120&g=4&v=1"`)
 * ready to be assigned to `location.hash` or appended to a base URL.
 */
export function generateShareUrl(args: {
  chords: readonly string[];
  tempo_bpm: number;
  grid: GridValue;
}): string {
  const encoded = encodeShareUrl({
    chords: args.chords,
    tempo_bpm: args.tempo_bpm,
    grid: args.grid,
  });
  return `#p=${encoded}`;
}

/**
 * Persist a settings change (e.g., tempo update).
 *
 * Merges the partial update with existing settings and saves.
 * Updates the in-memory settings reference on the state object.
 *
 * @returns The merged settings record after save.
 */
export function updateSettings(
  state: AppPersistenceState,
  partial: Partial<SettingsRecord>,
): SettingsRecord {
  const merged = saveSettings(state.backend, partial);
  state.settings = merged;
  return merged;
}

// Re-export constants consumed by orchestrator
export { DEFAULT_SETTINGS, DEFAULT_GRID };
