/**
 * Persistence/Data — Schema migration.
 *
 * Best-effort forward migration of stored progression records (PD-D4).
 * When the schema version of a stored record is older than CURRENT_SCHEMA_VERSION,
 * migration functions are applied sequentially: v1→v2, v2→v3, etc.
 *
 * Records with schema_version > CURRENT_SCHEMA_VERSION cannot be downgraded
 * and return null.
 */

import { type ProgressionRecord, CURRENT_SCHEMA_VERSION } from "./types.js";

// ---------------------------------------------------------------------------
// Migration function type
// ---------------------------------------------------------------------------

/**
 * A migration function transforms a raw record from version N to version N+1.
 * Receives and returns a plain object (not necessarily a valid ProgressionRecord
 * until the final migration step).
 */
export type MigrationFn = (
  raw: Record<string, unknown>,
) => Record<string, unknown>;

// ---------------------------------------------------------------------------
// Migration registry
// ---------------------------------------------------------------------------

/**
 * Registry of migration functions keyed by source version.
 * Entry at key N migrates from version N → N+1.
 *
 * Currently empty — CURRENT_SCHEMA_VERSION is 1, so no migrations exist yet.
 * When a v2 schema is introduced, add: `MIGRATIONS.set(1, migrateV1toV2)`.
 */
const MIGRATIONS: Map<number, MigrationFn> = new Map();

// ---------------------------------------------------------------------------
// migrateProgression
// ---------------------------------------------------------------------------

/**
 * Migrate a raw parsed record to the current schema version.
 *
 * - If `schema_version` is missing, treated as v1.
 * - If `schema_version` equals `CURRENT_SCHEMA_VERSION`, returned as-is.
 * - If `schema_version` < `CURRENT_SCHEMA_VERSION`, migrations applied sequentially.
 * - If `schema_version` > `CURRENT_SCHEMA_VERSION`, returns `null` (cannot downgrade).
 *
 * @param raw - The parsed JSON object from storage.
 * @returns The migrated `ProgressionRecord`, or `null` if migration is not possible.
 */
export function migrateProgression(
  raw: Record<string, unknown>,
): ProgressionRecord | null {
  let version =
    typeof raw.schema_version === "number" ? raw.schema_version : 1;
  let current: Record<string, unknown> = { ...raw, schema_version: version };

  if (version > CURRENT_SCHEMA_VERSION) return null;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrateFn = MIGRATIONS.get(version);
    if (!migrateFn) return null;

    current = migrateFn(current);
    version++;
    current.schema_version = version;
  }

  return current as unknown as ProgressionRecord;
}

// ---------------------------------------------------------------------------
// Test utilities (exported for testing migration chain logic)
// ---------------------------------------------------------------------------

/**
 * Register a migration function for testing.
 * Production code should not call this — migrations are registered statically above.
 */
export function _registerMigration(
  fromVersion: number,
  fn: MigrationFn,
): void {
  MIGRATIONS.set(fromVersion, fn);
}

/** Remove a registered migration. For test cleanup. */
export function _unregisterMigration(fromVersion: number): void {
  MIGRATIONS.delete(fromVersion);
}
