/**
 * Persistence/Data — User settings.
 *
 * Persist and retrieve user preferences (tempo, view state, etc.).
 * Settings are stored as a single JSON object under `tonnetz:settings`.
 * Partial updates are merged into the existing record.
 */

import type { StorageBackend } from "./storage.js";
import { type SettingsRecord, DEFAULT_SETTINGS } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Storage key for the settings record. */
const SETTINGS_KEY = "tonnetz:settings";

// ---------------------------------------------------------------------------
// loadSettings
// ---------------------------------------------------------------------------

/**
 * Load user settings from storage.
 *
 * Returns `DEFAULT_SETTINGS` if nothing is stored or if the stored
 * value is corrupted (unparseable JSON).
 */
export function loadSettings(backend: StorageBackend): SettingsRecord {
  const raw = backend.getItem(SETTINGS_KEY);
  if (raw === null) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(raw) as Partial<SettingsRecord>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ---------------------------------------------------------------------------
// saveSettings
// ---------------------------------------------------------------------------

/**
 * Merge a partial settings update into the existing stored settings.
 *
 * Reads current settings (or defaults), spreads the partial update on top,
 * and writes the merged result back to storage.
 *
 * @returns The merged settings record after saving.
 */
export function saveSettings(
  backend: StorageBackend,
  partial: Partial<SettingsRecord>,
): SettingsRecord {
  const current = loadSettings(backend);
  const merged: SettingsRecord = { ...current, ...partial };
  backend.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}
