# DEVPLAN — Persistence/Data

Module: Persistence/Data
Version: 0.1
Date: 2026-02-15
Architecture reference: ARCH_PERSISTENCE_DATA.md (Draft 0.2)

---

## Cold Start Summary

**What this is:**
Client-side persistence subsystem for the Tonnetz Interactive Harmonic Explorer. Responsible for saving/loading chord progressions to browser storage, URL-based sharing (encode/decode progressions as URL fragments), and user settings persistence. Pure storage logic — no harmonic computation, no audio, no rendering.

**Key constraints:**
- localStorage backend for MVP (PD-D1 tentative; IndexedDB deferred)
- Grid-based progression encoding: duration is implicit via repeated chord tokens (PD-D2)
- URL sharing via JSON → base64url in hash fragment (`/#p=...`)
- Schema version field in all stored records for forward migration (PD-D4)
- Chord symbols stored verbatim — PD does NOT parse or validate chord grammar (HC responsibility)
- Grid-to-beat conversion is NOT a PD responsibility (integration module bridges PD grid → AE beats)
- Settings round-trip: `loadSettings()` / `saveSettings(partial)` for user preferences (tempo, view state)

**Gotchas:**
- **Plain git repo** — commit with `git add -A && git commit`, not `sl` or `jf`
- `localStorage` has a ~5MB limit per origin — sufficient for MVP but not for large corpus features
- `localStorage.getItem()` returns `null` (not `undefined`) for missing keys — guard accordingly
- `JSON.parse()` throws on invalid input — all reads must be wrapped in try/catch
- `btoa()`/`atob()` are not URL-safe — must use base64url encoding (replace `+/=` with `-_`)
- URL fragments have practical length limits (~2000 chars) — long progressions may need compression (deferred, PD-D3)
- `window.localStorage` may throw in private browsing or when storage is full — must handle gracefully

---

## Current Status

**Phase:** 1c — Storage abstraction (complete)
**Focus:** Phase 1 complete; types, storage backend, barrel exports all tested
**Blocked/Broken:** Nothing

---

## Overview

Implement the client-side persistence subsystem as defined in ARCH_PERSISTENCE_DATA.md.
All work is UI-agnostic, audio-agnostic, and harmony-agnostic.
Output: a self-contained module with a public API consumable by the integration module.

---

## Phase 1: Foundation — Types, Storage Abstraction, Schema

**Objective:** Establish core types, storage abstraction layer, and schema versioning.

### Phase 1a: Project scaffolding

Set up package.json, TypeScript config, Vitest, barrel export, smoke test.

**Scope:**
- `package.json` with module name `persistence-data`, Vitest, TypeScript
- `tsconfig.json` matching project conventions (ES2022, bundler resolution, strict)
- `vitest.config.ts`
- `src/index.ts` — barrel export (initially empty)
- `src/__tests__/smoke.test.ts` — Vitest runs

**Tests:**
- [ ] Vitest runs and passes
- [ ] TypeScript compiles with no errors

### Phase 1b: Core types

Define the data model types for progressions, settings, and storage records.

**Scope:**
- `src/types.ts`:
  - `ProgressionRecord` — the stored progression object (id, title, schema_version, tempo_bpm, grid, chords, notes, created_at, updated_at)
  - `SettingsRecord` — user preferences (tempo_bpm, view state fields)
  - `SharePayload` — URL-serializable subset (schema_version, grid, tempo_bpm, chords)
  - `SchemaVersion` — current version constant
  - `GridValue` — string literal union for supported grid values (`"1/4"`, `"1/8"`, `"1/3"`, `"1/6"`)

**Tests:**
- [ ] Types compile correctly (type-level tests via assignment)
- [ ] `CURRENT_SCHEMA_VERSION` is 1
- [ ] `ProgressionRecord` has all required fields
- [ ] UUID generation produces valid format

### Phase 1c: Storage abstraction

Abstract localStorage behind a thin interface for testability.

**Scope:**
- `src/storage.ts`:
  - `StorageBackend` interface: `getItem(key)`, `setItem(key, value)`, `removeItem(key)`, `keys()`
  - `createLocalStorageBackend()` → `StorageBackend` (wraps `window.localStorage`)
  - `createMemoryStorageBackend()` → `StorageBackend` (in-memory Map, for tests and fallback)
- All storage errors caught and re-thrown as typed errors

**Tests:**
- [ ] Memory backend: set/get round-trip
- [ ] Memory backend: getItem returns null for missing key
- [ ] Memory backend: removeItem deletes key
- [ ] Memory backend: keys() lists all keys
- [ ] Memory backend: overwrite existing key
- [ ] localStorage backend: wraps localStorage methods (mock-based)
- [ ] Storage errors wrapped with context

### Phase 1 completion tests:
- [ ] All types compile with `tsc --noEmit`
- [ ] Storage abstraction fully tested with memory backend
- [ ] Barrel exports types and storage factory

---

## Phase 2: Progression CRUD

**Objective:** Save, load, list, and delete progressions using the storage backend.

### Phase 2a: `saveProgression` / `loadProgression`

**Scope:**
- `src/progressions.ts`:
  - `saveProgression(backend, prog)` — serialize and store; generate id + timestamps if missing
  - `loadProgression(backend, id)` — retrieve and parse; return null if not found
- Key format: `tonnetz:prog:<id>`
- JSON serialization with schema_version

**Tests:**
- [ ] Save then load returns identical record
- [ ] Load non-existent id returns null
- [ ] Save generates UUID if id is missing
- [ ] Save sets created_at on new records
- [ ] Save updates updated_at on existing records
- [ ] Corrupted JSON returns null (not throw)
- [ ] schema_version is included in stored JSON

### Phase 2b: `listProgressions` / `deleteProgression`

**Scope:**
- `listProgressions(backend)` — enumerate all stored progressions (sorted by updated_at desc)
- `deleteProgression(backend, id)` — remove by id; no-op if not found

**Tests:**
- [ ] List empty storage → empty array
- [ ] List after saves returns all records sorted by updated_at desc
- [ ] Delete removes the record
- [ ] Delete non-existent id is a no-op (no throw)
- [ ] List after delete omits deleted record

### Phase 2 completion tests:
- [ ] Full CRUD round-trip: save → list → load → update → list → delete → list
- [ ] All operations work with memory backend
- [ ] Corrupted records are skipped in list (not crash)

---

## Phase 3: URL Sharing

**Objective:** Encode progressions as URL-safe fragments and decode them back.

### Phase 3a: `encodeShareUrl` / `decodeShareUrl`

**Scope:**
- `src/sharing.ts`:
  - `encodeShareUrl(record)` → string (hash fragment content, without `#p=` prefix)
  - `decodeShareUrl(payload)` → `SharePayload | null`
- Encoding: `SharePayload` → JSON string → base64url
- Base64url: standard base64 with `+` → `-`, `/` → `_`, padding stripped
- Decoding: reverse process; return null on any parse failure

**Tests:**
- [ ] Encode then decode round-trips correctly
- [ ] Encoded string is URL-safe (no `+`, `/`, `=`)
- [ ] Decode invalid base64 returns null (not throw)
- [ ] Decode valid base64 but invalid JSON returns null
- [ ] Decode valid JSON but missing required fields returns null
- [ ] schema_version is preserved through round-trip
- [ ] Empty chords array round-trips
- [ ] Long progression (50+ chords) round-trips

### Phase 3 completion tests:
- [ ] Round-trip all supported grid values
- [ ] Payload size for typical progression (8 chords) is under 200 chars
- [ ] Deterministic: same input → identical output

---

## Phase 4: Settings

**Objective:** Persist and retrieve user preferences.

### Phase 4a: `loadSettings` / `saveSettings`

**Scope:**
- `src/settings.ts`:
  - `loadSettings(backend)` → `SettingsRecord` (returns defaults if nothing stored)
  - `saveSettings(backend, partial)` — merge partial update into existing settings
- Key: `tonnetz:settings`
- Default settings: `{ tempo_bpm: 120 }` (extensible)

**Tests:**
- [ ] loadSettings on empty storage returns defaults
- [ ] saveSettings then loadSettings round-trips
- [ ] saveSettings with partial update merges (does not overwrite unrelated fields)
- [ ] Corrupted settings JSON returns defaults (not throw)
- [ ] Multiple partial saves accumulate correctly

### Phase 4 completion tests:
- [ ] Settings survive across save/load cycles
- [ ] Defaults are well-defined and documented

---

## Phase 5: Schema Migration

**Objective:** Forward-migrate stored records when schema version changes.

### Phase 5a: Migration framework

**Scope:**
- `src/migration.ts`:
  - `migrateProgression(raw, fromVersion)` → `ProgressionRecord` at current version
  - Registry of migration functions: `v1→v2`, `v2→v3`, etc. (currently only v1)
- Migration is best-effort (PD-D4)
- Unknown future versions: return null (cannot downgrade)

**Tests:**
- [ ] v1 record passes through unchanged
- [ ] Record with missing schema_version treated as v1
- [ ] Record with future version (999) returns null
- [ ] Migration chain applies sequentially (v1→v2→v3 when v2/v3 migrations exist)

### Phase 5 completion tests:
- [ ] All CRUD functions apply migration on load
- [ ] Migrated records are re-saved at current version

---

## Phase 6: Public API Assembly & Integration Tests

**Objective:** Wire all components into the public API surface defined in ARCH_PERSISTENCE_DATA.md Section 7. Verify the full API contract.

### Phase 6a: API surface assembly

**Scope:**
- Export all public functions from `src/index.ts`:
  - `saveProgression`, `loadProgression`, `listProgressions`, `deleteProgression`
  - `encodeShareUrl`, `decodeShareUrl`
  - `loadSettings`, `saveSettings`
  - `createLocalStorageBackend`, `createMemoryStorageBackend`
- Export all public types:
  - `ProgressionRecord`, `SettingsRecord`, `SharePayload`, `StorageBackend`, `GridValue`
- Ensure no internal helpers leak through the module boundary

**Tests:**
- [ ] All public functions exported and callable
- [ ] All public types exported
- [ ] No internal helpers accessible

### Phase 6b: End-to-end integration tests

**Tests:**
- [ ] Full lifecycle: save → list → load → encode URL → decode URL → verify data matches
- [ ] Settings: load defaults → save partial → load → verify merge
- [ ] Corrupted data handling: corrupt a storage key → operations degrade gracefully
- [ ] Multiple progressions: save 5 → list (correct order) → delete 2 → list (3 remain)
- [ ] Memory backend and localStorage backend produce identical results for same operations

### Phase 6c: Review

- [ ] Remove dead code
- [ ] Documentation pass (JSDoc on all exports)
- [ ] Verify no dependencies on HC, AE, or RU

---

## Design Decisions

```
PD-DEV-D1: Storage abstraction for testability
Date: 2026-02-15
Status: Closed
Priority: Important
Decision:
Abstract localStorage behind a StorageBackend interface. Provide memory
backend for tests and as a fallback when localStorage is unavailable.
Rationale:
Unit tests must not depend on browser localStorage. Memory backend also
serves as fallback in private browsing or storage-full scenarios.
Revisit if: IndexedDB migration makes the abstraction insufficient.
```

```
PD-DEV-D2: Language & module format
Date: 2026-02-15
Status: Closed
Priority: Critical
Decision: TypeScript, ESM, consistent with HC/AE/RU.
Rationale: Project consistency. Type safety for record shapes.
Revisit if: Platform target changes.
```

```
PD-DEV-D3: Test framework
Date: 2026-02-15
Status: Closed
Priority: Critical
Decision: Vitest 3.x (consistent with HC, AE, RU).
Rationale: Native TS, ESM-first, fast. No DOM needed (pure storage logic).
Revisit if: Build toolchain constrains choice.
```

```
PD-DEV-D4: Key namespace prefix
Date: 2026-02-15
Status: Closed
Priority: Normal
Decision: All localStorage keys prefixed with "tonnetz:" to avoid collisions.
Progression keys: "tonnetz:prog:<uuid>". Settings key: "tonnetz:settings".
Rationale: Standard namespacing practice for shared-origin storage.
Revisit if: Multiple Tonnetz instances on same origin need isolation.
```

---

## Summary

| Phase | Scope | Key API Functions |
|-------|-------|-------------------|
| 1 | Foundation — types, storage abstraction | `createLocalStorageBackend`, `createMemoryStorageBackend` |
| 2 | Progression CRUD | `saveProgression`, `loadProgression`, `listProgressions`, `deleteProgression` |
| 3 | URL sharing | `encodeShareUrl`, `decodeShareUrl` |
| 4 | Settings | `loadSettings`, `saveSettings` |
| 5 | Schema migration | `migrateProgression` |
| 6 | Public API assembly | Full API surface, integration tests, review |
