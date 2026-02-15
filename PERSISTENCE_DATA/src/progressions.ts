/**
 * Persistence/Data — Progression CRUD.
 *
 * Save, load, list, and delete chord progressions using a StorageBackend.
 * Key format: `tonnetz:prog:<uuid>`
 *
 * Chord symbols are stored verbatim — no parsing or validation.
 * Schema version is included in every stored record.
 */

import type { StorageBackend } from "./storage.js";
import {
  type ProgressionRecord,
  CURRENT_SCHEMA_VERSION,
  generateId,
} from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Key prefix for progression records in storage. */
const PROG_KEY_PREFIX = "tonnetz:prog:";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the storage key for a progression id. */
function progKey(id: string): string {
  return `${PROG_KEY_PREFIX}${id}`;
}

/** Get an ISO timestamp string for the current moment. */
function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// saveProgression
// ---------------------------------------------------------------------------

/**
 * Serialize and store a progression record.
 *
 * - Generates `id` if not provided (empty string or missing).
 * - Sets `created_at` on new records (when id was generated).
 * - Always updates `updated_at`.
 * - Stamps `schema_version` to `CURRENT_SCHEMA_VERSION`.
 *
 * @returns The saved record (with generated id/timestamps filled in).
 */
export function saveProgression(
  backend: StorageBackend,
  prog: Partial<ProgressionRecord> &
    Pick<ProgressionRecord, "title" | "tempo_bpm" | "grid" | "chords">,
): ProgressionRecord {
  const isNew = !prog.id;
  const id = prog.id || generateId();
  const timestamp = now();

  const record: ProgressionRecord = {
    id,
    schema_version: CURRENT_SCHEMA_VERSION,
    title: prog.title,
    tempo_bpm: prog.tempo_bpm,
    grid: prog.grid,
    chords: [...prog.chords],
    notes: prog.notes ?? "",
    created_at: isNew ? timestamp : (prog.created_at ?? timestamp),
    updated_at: timestamp,
  };

  backend.setItem(progKey(id), JSON.stringify(record));
  return record;
}

// ---------------------------------------------------------------------------
// loadProgression
// ---------------------------------------------------------------------------

/**
 * Retrieve and deserialize a progression by id.
 *
 * @returns The parsed `ProgressionRecord`, or `null` if not found or corrupted.
 */
export function loadProgression(
  backend: StorageBackend,
  id: string,
): ProgressionRecord | null {
  const raw = backend.getItem(progKey(id));
  if (raw === null) return null;

  try {
    return JSON.parse(raw) as ProgressionRecord;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// listProgressions
// ---------------------------------------------------------------------------

/**
 * Enumerate all stored progressions, sorted by `updated_at` descending
 * (most recently updated first).
 *
 * Corrupted records are silently skipped — they do not cause the list to fail.
 */
export function listProgressions(
  backend: StorageBackend,
): ProgressionRecord[] {
  const results: ProgressionRecord[] = [];

  for (const key of backend.keys()) {
    if (!key.startsWith(PROG_KEY_PREFIX)) continue;

    const raw = backend.getItem(key);
    if (raw === null) continue;

    try {
      results.push(JSON.parse(raw) as ProgressionRecord);
    } catch {
      // Corrupted record — skip silently
    }
  }

  results.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return results;
}

// ---------------------------------------------------------------------------
// deleteProgression
// ---------------------------------------------------------------------------

/**
 * Remove a progression by id. No-op if the id does not exist.
 */
export function deleteProgression(
  backend: StorageBackend,
  id: string,
): void {
  backend.removeItem(progKey(id));
}
