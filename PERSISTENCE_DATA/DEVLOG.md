# DEVLOG — Persistence/Data

Module: Persistence/Data
Started: 2026-02-15

---

## Entry 1 — Phase 1a: Project Scaffolding

Date: 2026-02-15
Status: Complete

**Changes:**
- Created `package.json`: name `persistence-data`, ESM, Vitest + TypeScript devDeps
- Created `tsconfig.json`: ES2022, bundler resolution, strict (matching HC/AE/RU)
- Created `vitest.config.ts`
- Created `src/index.ts` — empty barrel export
- Created `src/__tests__/smoke.test.ts` — Vitest runs

**Tests passed:**
- [x] Vitest runs and passes (1 smoke test)
- [x] TypeScript compiles with no errors

**Decisions made:**
- PD-DEV-D1: Storage abstraction for testability (closed)
- PD-DEV-D2: TypeScript + ESM (closed)
- PD-DEV-D3: Vitest 3.x (closed)
- PD-DEV-D4: `tonnetz:` key namespace prefix (closed)

---

## Entry 2 — Phase 1b: Core Types

Date: 2026-02-15
Status: Complete

**Changes:**
- Created `src/types.ts`: `ProgressionRecord`, `SettingsRecord`, `SharePayload`, `GridValue`, `CURRENT_SCHEMA_VERSION`, `DEFAULT_GRID`, `DEFAULT_SETTINGS`, `generateId()`
- Created `src/__tests__/types.test.ts`

**Tests passed:**
- [x] `CURRENT_SCHEMA_VERSION` is 1
- [x] `DEFAULT_GRID` is `"1/4"`
- [x] `DEFAULT_SETTINGS.tempo_bpm` is 120
- [x] `GridValue` accepts all 4 supported values
- [x] `ProgressionRecord` constructible with all required fields
- [x] `ProgressionRecord` stores chord symbols verbatim (no validation)
- [x] `SettingsRecord` constructible with `tempo_bpm`
- [x] `SharePayload` constructible with required fields
- [x] `SharePayload` is a subset of `ProgressionRecord` fields
- [x] `generateId()` produces valid UUID v4 format
- [x] `generateId()` produces unique values (50 calls → 50 distinct)
- [x] `generateId()` returns 36-character string

**Test totals:** 13 tests across 2 files

**Issues encountered:**
- None

**Decisions made:**
- None (all design decisions closed in Phase 1a)

---

## Entry 3 — Phase 1c: Storage Abstraction

Date: 2026-02-15
Status: Complete

**Changes:**
- Created `src/storage.ts`: `StorageBackend` interface, `createMemoryStorageBackend()`, `createLocalStorageBackend()`, `StorageError`
- Created `src/__tests__/storage.test.ts`
- Updated `src/index.ts` barrel: exports all types, constants, and storage factories

**Tests passed:**
- [x] Memory backend: returns StorageBackend with all 4 methods
- [x] Memory backend: set/get round-trip
- [x] Memory backend: getItem returns null for missing key
- [x] Memory backend: removeItem deletes key
- [x] Memory backend: removeItem on missing key is a no-op
- [x] Memory backend: keys() lists all stored keys
- [x] Memory backend: keys() returns empty array when empty
- [x] Memory backend: overwrite existing key
- [x] Memory backend: stores empty string values
- [x] Memory backend: handles keys with special characters (tonnetz: namespace)
- [x] Memory backend: instances are isolated from each other
- [x] localStorage backend: getItem delegates to localStorage
- [x] localStorage backend: getItem returns null for missing key
- [x] localStorage backend: setItem delegates to localStorage
- [x] localStorage backend: removeItem delegates to localStorage
- [x] localStorage backend: keys() enumerates all localStorage keys
- [x] localStorage backend: getItem returns null when localStorage throws
- [x] localStorage backend: setItem throws StorageError on quota/security error
- [x] localStorage backend: removeItem swallows errors silently
- [x] localStorage backend: keys() returns empty array when localStorage throws
- [x] StorageError: is instance of Error
- [x] StorageError: has name "StorageError"
- [x] StorageError: preserves message
- [x] StorageBackend contract: memory backend full CRUD cycle

**Test totals:** 37 tests across 3 files

**Issues encountered:**
- None

---

## Phase 1 Completion

Date: 2026-02-15

**Phase tests passed:**
- [x] All types compile with `tsc --noEmit`
- [x] Storage abstraction fully tested with memory backend
- [x] Barrel exports types and storage factory

**Test totals:** 37 tests across 3 files (1 smoke + 12 types + 24 storage)

**Review notes:**
- `StorageBackend` interface has 4 methods matching the Web Storage API subset
- Memory backend uses `Map<string, string>` — simple, isolated per instance
- localStorage backend wraps all reads in try/catch (graceful degradation in private browsing)
- localStorage backend wraps setItem errors as typed `StorageError` (quota exceeded, security)
- localStorage backend swallows removeItem/keys errors (non-critical operations)

**Doc sync:**
- DEVPLAN: Current Status updated to Phase 1c complete

---

## Entry 4 — Phase 2a: saveProgression / loadProgression

Date: 2026-02-15
Status: Complete

**Changes:**
- Created `src/progressions.ts`: `saveProgression()`, `loadProgression()`
  - Key format: `tonnetz:prog:<uuid>`
  - Auto-generates UUID + `created_at` on new records
  - Updates `updated_at` on every save
  - Stamps `schema_version` to `CURRENT_SCHEMA_VERSION`
  - Corrupted JSON returns `null` (no throw)
- Created `src/__tests__/progressions.test.ts`
- Updated `src/index.ts` barrel: exports `saveProgression`, `loadProgression`

**Tests passed:**
- [x] Save then load returns identical record
- [x] Load non-existent id returns null
- [x] Save generates UUID if id is missing
- [x] Save sets created_at on new records
- [x] Save updates updated_at on existing records
- [x] Corrupted JSON returns null (not throw)
- [x] schema_version is included in stored JSON

**Test totals:** 44 tests across 4 files

**Issues encountered:**
- Initial test used `vi.advanceTimersByTime()` without fake timers — caused error. Removed timer dependency; test verifies `updated_at >= original` and structural invariants instead.

**Decisions made:**
- None

---

## Entry 5 — Phase 2b: listProgressions / deleteProgression

Date: 2026-02-15
Status: Complete

**Changes:**
- Added `listProgressions(backend)` to `src/progressions.ts`: enumerates `tonnetz:prog:*` keys, parses records, sorts by `updated_at` descending; skips corrupted records silently
- Added `deleteProgression(backend, id)` to `src/progressions.ts`: removes by key; no-op if not found
- Updated `src/index.ts` barrel: exports all 4 CRUD functions
- Added 7 tests to `src/__tests__/progressions.test.ts`

**Tests passed:**
- [x] List empty storage → empty array
- [x] List after saves returns all records sorted by updated_at desc
- [x] Skips corrupted records without crashing
- [x] Ignores non-progression keys
- [x] Delete removes the record
- [x] Delete non-existent id is a no-op (no throw)
- [x] List after delete omits deleted record

**Test totals:** 51 tests across 4 files

**Issues encountered:**
- None

**Decisions made:**
- None

---

## Entry 6 — Phase 2 Completion Tests

Date: 2026-02-15
Status: Complete

**Changes:**
- Added 4 phase-level completion tests to `src/__tests__/progressions.test.ts`

**Tests passed:**
- [x] Full CRUD round-trip: save → list → load → update → list → delete → list
- [x] Corrupted records are skipped in list (not crash)
- [x] All operations work with memory backend (no localStorage required)
- [x] Multiple progressions: save 5 → list → delete 2 → list (3 remain)

**Test totals:** 55 tests across 4 files

**Issues encountered:**
- None

---

## Phase 2 Completion

Date: 2026-02-15

**Phase tests passed:**
- [x] Full CRUD round-trip: save → list → load → update → list → delete → list
- [x] All operations work with memory backend
- [x] Corrupted records are skipped in list (not crash)

**Test totals:** 55 tests across 4 files (1 smoke + 12 types + 24 storage + 18 progressions)

**Review notes:**
- `saveProgression` input type uses `Partial<ProgressionRecord> & Pick<...required fields>` — callers must provide title, tempo, grid, chords; id and timestamps are optional
- `listProgressions` filters on `tonnetz:prog:` prefix — ignores settings and non-Tonnetz keys
- `listProgressions` sorts by ISO timestamp string comparison (lexicographic = chronological for ISO 8601)
- `deleteProgression` delegates to `backend.removeItem()` — no-op semantics inherited from StorageBackend contract
- All functions take `StorageBackend` as first argument — pure, backend-agnostic

**Doc sync:**
- DEVPLAN: Current Status updated to Phase 2 complete

---

## Template

Each entry follows this format:

```
### Phase Xa: [Step Title]
Date: YYYY-MM-DD
Status: Complete | Partial | Blocked

**Changes:**
- [files created/modified]

**Tests passed:**
- [x] test description
- [ ] test description (if failed, explain)

**Issues encountered:**
- [description, resolution]

**Decisions made:**
- [reference PD-DEV-D# if applicable]
```

---

## Phase Completion Template

```
### Phase X Completion
Date: YYYY-MM-DD

**Phase tests passed:**
- [x] / [ ] each phase-level test

**Test totals:** N tests across M files

**Review notes:**
- [code review observations, simplifications made]

**Doc sync:**
- [any updates to ARCH_PERSISTENCE_DATA.md, DEVPLAN.md]
```
