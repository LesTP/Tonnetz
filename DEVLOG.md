# DEVLOG — Integration Module (Orchestrator)

Module: Integration Module
Started: 2026-02-15

---

## Entry 1 — Phase 0: Architecture Planning & DEVPLAN (Complete)

**Date:** 2026-02-15
**Mode:** Discuss

### Summary

Created integration module documentation (DEVPLAN.md, DEVLOG.md) per project governance. Reviewed all four subsystem architecture documents, SPEC.md, UX_SPEC.md, and GOVERNANCE.md. Produced a comprehensive DEVPLAN with cold start summary, subsystem readiness table, architecture overview, 7-phase breakdown, test specifications per phase, and 4 design decisions.

### Context

Integration module is the final module to begin development. All four subsystems are complete:

| Subsystem | Tests | Status |
|-----------|-------|--------|
| Harmony Core | 158 | ✅ Complete |
| Rendering/UI | 344 | ✅ Complete |
| Audio Engine | 172 | ✅ Complete |
| Persistence/Data | 105 | ✅ Complete |
| **Total** | **779** | |

Audio Engine just completed bug fix session (AE-D10, AE-D11, AE-D12) addressing scheduler auto-stop notification, pause/resume chord index preservation, and voice-leading state reset. These fixes are committed and tested.

### Architecture Findings

Key cross-module contracts identified during planning:

1. **Grid-to-beat bridging** — PD stores grid notation (`"1/4"`, `"1/8"`), AE schedules in beats. Integration must convert and collapse repeated chords for correct duration encoding. Documented as INT-D4.

2. **Lazy audio initialization** — Browser autoplay policy requires `initAudio()` to be deferred to first user gesture. Integration manages this via `ensureAudio()` pattern. Documented as INT-D3.

3. **UI state gating** — Interactive playback (`playPitchClasses`) must be suppressed during scheduled playback (`Playback Running` state). Integration checks UIState before dispatching to AE (UX-D6).

4. **Startup sequence** — 7-step ordered initialization: settings → rendering → audio (deferred) → apply settings → URL check → wire callbacks → ready. Documented in DEVPLAN Phase 6.

5. **Progression pipeline** — PD record → HC parse → shapes → chord events. A linear pipeline with error handling for invalid chord symbols.

### Decisions Made

| Decision | Title | Status |
|----------|-------|--------|
| INT-D1 | Bundler choice | Closed (Vite) |
| INT-D2 | Module location — root folder | Closed |
| INT-D3 | Lazy audio initialization strategy | Closed |
| INT-D4 | Grid-to-beat repeated chord collapsing | Closed |

### Artifacts Created

- `DEVPLAN.md` — 404 lines, 7 phases, 4 decisions, full test specifications
- `DEVLOG.md` — this file

### Next Steps

- Begin Phase 1a: project scaffolding (`package.json`, `tsconfig.json`, Vitest setup)
- Establish all four subsystem `file:../` dependency links

---

## Entry 2 — INT-D1 Closed: Vite confirmed as bundler (Complete)

**Date:** 2026-02-15
**Mode:** Discuss

### Summary

Closed INT-D1 — confirmed Vite as the bundler for the integration module. Updated the DEVPLAN decision entry from Open → Closed with full rationale, trade-offs, and revisit conditions.

### Rationale

Vite was the strongest candidate from the start. Evaluated against esbuild (faster raw builds but requires manual HTML/asset handling) and Rollup (more configuration overhead; Vite uses it internally). Vite provides:

- **Zero-config TypeScript** — no extra loader plugins needed
- **ESM-native dev server with HMR** — fast iteration during development
- **Asset hashing** — cache-friendly static deployment aligned with ARCH_DEPLOYMENT_HOSTING §3
- **Standard SPA tooling** — well-documented, large ecosystem, minimal maintenance burden

Trade-off accepted: slightly slower builds than raw esbuild, but irrelevant at this project's scale.

### Next Steps

- Begin Phase 1a: project scaffolding
- Set up `package.json` with `file:../` links to all four subsystems
- Configure `vite.config.ts` for single-page app with TypeScript

---

## Entry 3 — DEVPLAN v0.2: Review & Revision (Complete)

**Date:** 2026-02-15
**Mode:** Discuss (Review)

### Summary

Comprehensive review of DEVPLAN v0.1 against source-of-truth documents (SPEC.md, UX_SPEC.md, GOVERNANCE.md, and all subsystem source code). Identified 8 issues — 1 critical API mismatch, 3 logic/consistency issues, 4 gaps. Rewrote DEVPLAN as v0.2 with all fixes incorporated and 4 new open decisions added.

### Issues Found and Fixed

#### Critical: `shapesToChordEvents()` API mismatch (INT-D5)
AE's `shapesToChordEvents()` takes a single scalar `beatsPerChord` and assigns uniform duration to all shapes. After collapsing repeated chords via INT-D4, we need variable per-chord durations. DEVPLAN v0.1 implicitly assumed `shapesToChordEvents()` could handle this — it cannot. v0.2 specifies manual `ChordEvent[]` construction in the progression pipeline.

#### Logic: `onPointerDown` immediate audio missing (INT-D6 context, UX-D4)
UX-D4 requires "chord sounds on pointer-down." DEVPLAN v0.1 wired `onTriangleSelect`/`onEdgeSelect` (post-classification) to audio, not `onPointerDown`. This introduces perceptible latency — sound waits for tap/drag classification instead of starting immediately. v0.2 adds `onPointerDown` → hit-test → `playPitchClasses()` as the primary audio trigger, with post-classification callbacks handling visual selection only.

#### Logic: Interactive playback in `progression-loaded` state (INT-D6)
SPEC §UI State Enforcement says "Progression Loaded: interactive playback permitted." But `UIStateController.selectChord()` silently rejects from `progression-loaded` (source: `ui-state.ts` lines 131–134). This creates an audio/visual mismatch if integration only gates on `playback-running`. v0.2 adds INT-D6 as an open decision with three options.

#### Gap: Missing `StorageBackend` creation
`PD.loadSettings(backend)` and all PD functions require a `StorageBackend` instance. DEVPLAN v0.1 never specified where it's created. v0.2 adds `PD.createLocalStorageBackend()` as step 1 of the startup sequence in Phase 6a.

#### Gap: Missing progression text input parsing
ControlPanel `onLoadProgression` receives raw text. DEVPLAN v0.1 didn't specify how text → `string[]` parsing happens. v0.2 adds `parseProgressionInput()` in Phase 2b with delimiter choice as open decision INT-D7.

#### Gap: Missing tempo UI element (INT-D8)
SPEC wiring table lists "ControlPanel tempo input → setTempo(bpm)" but ControlPanel source has no tempo input. v0.2 documents this gap and adds INT-D8 with three options.

#### Gap: Missing `destroyApp()` cleanup
No teardown story in v0.1. v0.2 adds `destroyApp()` to Phase 6b that collects all handles and calls `.destroy()` on each.

#### Documentation: Pause button clarification
`AudioTransport.pause()` exists but no UI element wires to it. v0.2 explicitly notes Pause as unused in MVP (consistent with UX spec) in Phase 4b.

### Decisions Added

| Decision | Title | Status | Priority |
|----------|-------|--------|----------|
| INT-D5 | Variable-duration ChordEvent construction | Open | Important |
| INT-D6 | Interactive playback in progression-loaded state | Open | Important |
| INT-D7 | Progression text input delimiter | Open | Normal |
| INT-D8 | Tempo control UI element | Open | Normal |

### Artifacts Modified

- `DEVPLAN.md` — rewritten as v0.2 (all 7 phases updated, 8 decisions total)
- `DEVLOG.md` — this entry

### Next Steps

- Resolve open decisions INT-D5, INT-D6, INT-D7, INT-D8
- Begin Phase 1a: project scaffolding

---

## Entry 4 — Decision Closure: INT-D5, INT-D6, INT-D7 (Complete)

**Date:** 2026-02-15
**Mode:** Discuss

### Summary

Closed three of four open decisions from DEVPLAN v0.2 review. INT-D8 (tempo control UI) remains open — deferred to UI testing phase per user direction.

### Decisions Closed

**INT-D5: Variable-duration ChordEvent construction → Option A (manual build)**
Build `ChordEvent[]` manually in `progression-pipeline.ts` by accumulating `startBeat` from per-chord durations. Does not use `AE.shapesToChordEvents()` (it only accepts uniform scalar `beatsPerChord`). AE's API stays unchanged — no cross-module modification. Cost: ~5 lines of straightforward accumulation.

**INT-D6: Interactive playback in progression-loaded state → Option A (suppress)**
Suppress both audio and visual selection when UIState is `"progression-loaded"`. `UIStateController.selectChord()` already silently rejects from this state — suppressing audio aligns integration gating with the state machine's behavior. User clears progression to return to interactive exploration. Acceptable restriction for MVP; revisit if user testing finds it frustrating.

**INT-D7: Progression text input delimiter → Option C (both pipe and whitespace)**
`parseProgressionInput()` splits on regex `/[|\s]+/`, trims tokens, rejects empties. Handles `"Dm7 | G7 | Cmaj7"` and `"Dm7 G7 Cmaj7"` identically. Slash chords (`C/E`, future) are safe since `/` is not in the delimiter set.

### Decision Deferred

**INT-D8: Tempo control UI element → deferred to UI testing**
User will resolve positioning/approach when running the built app. Not blocking implementation — tempo is set from PD data (stored records, URL payloads) and defaults to 120 BPM.

### Current Decision Summary

| Decision | Title | Status |
|----------|-------|--------|
| INT-D1 | Bundler choice | Closed (Vite) |
| INT-D2 | Module location — root folder | Closed |
| INT-D3 | Lazy audio initialization strategy | Closed |
| INT-D4 | Grid-to-beat repeated chord collapsing | Closed |
| INT-D5 | Variable-duration ChordEvent construction | Closed (manual build) |
| INT-D6 | Interactive playback in progression-loaded | Closed (suppress) |
| INT-D7 | Progression text input delimiter | Closed (pipe + whitespace) |
| INT-D8 | Tempo control UI element | **Open** (deferred to UI testing) |

### Next Steps

- Begin Phase 1a: project scaffolding
- Set up `package.json` with `file:../` links to all four subsystems

---

## Entry 5 — Phase 1a: Project Scaffolding (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Created the integration module (INTEGRATION directory) with project scaffolding and smoke tests verifying all four subsystem imports resolve correctly. TypeScript compiles cleanly, Vitest runs 9/9 tests passing.

### Implementation Note: Module Location

DEVPLAN INT-D2 says "integration module lives in project root." In practice, placing it in `INTEGRATION/` subdirectory alongside the other subsystem directories (HARMONY_CORE, RENDERING_UI, AUDIO_ENGINE, PERSISTENCE_DATA) is more consistent with the existing project layout. The subsystems use `tsconfig paths` and `vitest alias` for cross-module resolution (not npm `file:` dependencies). The integration module follows this exact pattern. INT-D2's intent — that the integration module is the top-level app entry point — is preserved; the `INTEGRATION/` directory is where `vite.config.ts`, `index.html`, and the build output will live.

### Files Created

| File | Purpose |
|------|---------|
| `INTEGRATION/package.json` | `tonnetz-app`, devDeps: typescript, vitest, happy-dom |
| `INTEGRATION/tsconfig.json` | ES2022, bundler resolution, paths to all 4 subsystems |
| `INTEGRATION/vitest.config.ts` | Resolve aliases for all 4 subsystems, happy-dom environment |
| `INTEGRATION/src/index.ts` | Empty barrel (populated in later phases) |
| `INTEGRATION/src/__tests__/smoke.test.ts` | 9 tests: import verification + basic function calls |

### Dependency Resolution Pattern

Followed the existing subsystem convention:
- **TypeScript:** `tsconfig.json` `paths` entries map bare module names to source `index.ts` files
- **Vitest:** `resolve.alias` entries mirror the same mappings for runtime test execution
- **No npm `file:` links** — subsystems don't use them; pure path alias resolution

### Test Results

```
✓ src/__tests__/smoke.test.ts (9 tests) 6ms

Test Files  1 passed (1)
     Tests  9 passed (9)
  Duration  1.39s
```

Tests verify:
- HC: `parseChordSymbol("Cmaj7")` returns root_pc 0
- RU: `latticeToWorld(0,0)` returns WorldPoint with x,y
- AE: `midiToFreq(69)` ≈ 440 Hz
- PD: `encodeShareUrl` / `decodeShareUrl` round-trip, constants exported

### Next Steps

- Phase 1b: Vite build configuration (vite.config.ts, index.html, npm run build/dev)

---

## Entry 6 — Phase 1b: Build Configuration (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Added Vite build configuration to the integration module. Dev server starts, production build produces `dist/index.html` + hashed JS bundle (44 modules, 239ms). A minimal `src/main.ts` entry point imports from all four subsystems and renders a boot status page.

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `vite.config.ts` | Created | Vite config with subsystem resolve aliases matching vitest.config.ts |
| `index.html` | Created | HTML shell: `<div id="app">`, `<script type="module" src="/src/main.ts">`, full-viewport CSS reset |
| `src/main.ts` | Created | Minimal entry point: imports from HC/RU/AE/PD, renders subsystem status to #app |
| `package.json` | Modified | Added `vite ^6.0.0` devDep, added `dev`/`build`/`preview` scripts |

### Build Output

```
vite v6.4.1 building for production...
✓ 44 modules transformed.
dist/index.html                0.54 kB │ gzip: 0.36 kB
dist/assets/index-BqCoB62m.js  2.30 kB │ gzip: 1.38 kB
✓ built in 239ms
```

Built `index.html` references hashed asset path: `/assets/index-BqCoB62m.js`.

### Verification

- `npm run build` → ✅ `dist/` with index.html + hashed .js
- `npx vitest run` → ✅ 9/9 tests still passing (Phase 1a smoke tests unaffected)
- `npx tsc --noEmit` → ✅ clean

### Design Notes

- `vite.config.ts` and `vitest.config.ts` are separate files with duplicated aliases. This matches the subsystem pattern (e.g., RU has both). Vitest uses its own config file; Vite uses its own. No inheritance needed since both are small.
- `src/main.ts` is a Phase 1b stub. It will be replaced by the full startup sequence in Phase 6a.
- `index.html` uses `overflow: hidden` on body to prevent scrollbars when the SVG canvas fills the viewport.

### Next Steps

- Phase 2a: Grid-to-beat conversion (`grid-to-beats.ts`)
- Phase 2b: Progression text parsing (`progression-pipeline.ts`)

---

## Entry 7 — Phase 2a: Grid-to-Beat Conversion (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented grid-to-beat conversion and consecutive chord collapsing in `INTEGRATION/src/grid-to-beats.ts`. These two functions bridge PD's grid-based duration model to AE's beat-based scheduling (INT-D4).

### Files Created

| File | Purpose |
|------|---------|
| `src/grid-to-beats.ts` | `gridToBeatsPerChord()` + `collapseRepeatedChords()` |
| `src/__tests__/grid-to-beats.test.ts` | 12 tests covering all grid values, collapsing, and edge cases |

### Implementation Details

- `gridToBeatsPerChord()` uses a static `Map<GridValue, number>` — 4-beat bar assumption: `"1/4"` → 1, `"1/8"` → 0.5, `"1/3"` → 4/3, `"1/6"` → 2/3. Throws on unknown values.
- `collapseRepeatedChords()` walks the array once, grouping consecutive identical symbols with count. Returns `CollapsedChord[]` with `{ symbol, count }`.
- Both functions are pure and stateless — no subsystem dependencies other than the `GridValue` type from PD.

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests)
```

### Note

This entry was logged retroactively — code was implemented in a prior session but not logged per GOVERNANCE §Step Execution.

### Next Steps

- Phase 2b: Progression text parsing (`progression-pipeline.ts`)
- Phase 2c: Progression load pipeline

---

## Entry 8 — Phase 2b/2c: Progression Pipeline (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented the progression pipeline in `INTEGRATION/src/progression-pipeline.ts` with two functions:
- `parseProgressionInput()` (Phase 2b) — split raw text into chord symbol tokens
- `loadProgressionPipeline()` (Phase 2c) — full pipeline: chord strings → `Shape[]` + `ChordEvent[]`

All 44 integration tests pass (9 smoke + 12 grid-to-beats + 23 progression-pipeline). TypeScript compiles cleanly.

### Files Created

| File | Purpose |
|------|---------|
| `src/progression-pipeline.ts` | `parseProgressionInput()` + `loadProgressionPipeline()` + result types |
| `src/__tests__/progression-pipeline.test.ts` | 23 tests: 11 for text parsing, 12 for full pipeline |

### Implementation Details

**`parseProgressionInput(text)`** (Phase 2b):
- Splits on regex `/[|\s]+/` (pipe or whitespace, per INT-D7 Closed)
- Trims tokens, rejects empties
- Returns `string[]`

**`loadProgressionPipeline(args)`** (Phase 2c):
- Takes `{ chords, grid, focus, indices }` — raw chord strings + PD grid value + HC placement parameters
- Step 1: `collapseRepeatedChords(chords)` → `CollapsedChord[]`
- Step 2: `parseChordSymbol()` each collapsed symbol; collects all failures before returning error
- Step 3: `mapProgressionToShapes(parsedChords, focus, indices)` → `Shape[]`
- Step 4: Build `ChordEvent[]` manually — accumulates `startBeat` from `count × gridToBeatsPerChord(grid)` per chord (INT-D5: does not use `shapesToChordEvents()`)
- Returns discriminated union: `PipelineSuccess { ok:true, shapes, events, collapsed }` or `PipelineError { ok:false, error, failedSymbols }`

**Key design choices:**
- Shape object identity preserved: `events[i].shape === shapes[i]` (tested explicitly)
- Error result reports **all** failed symbols, not just the first — enables better error messages
- Empty input returns empty success (not an error)
- Collapsed array exposed in success result — useful for UI display of chord durations

### Decisions Applied

| Decision | How Applied |
|----------|-------------|
| INT-D4 | `collapseRepeatedChords()` merges consecutive identical symbols before parsing |
| INT-D5 | Manual `ChordEvent[]` construction with per-chord durations; `shapesToChordEvents()` not used |
| INT-D7 | Split on `/[|\s]+/` — pipe and whitespace both accepted |

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 4ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 15ms
✓ src/__tests__/smoke.test.ts (9 tests) 6ms

Test Files  3 passed (3)
     Tests  44 passed (44)
```

### Next Steps

- Phase 3a: Lazy audio initialization (`interaction-wiring.ts`)
- Phase 3b: `onPointerDown` immediate audio (UX-D4)
- Phase 3c: Interaction post-classification wiring

---

## Entry 9 — Phase 3: Interaction Wiring (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented the interaction wiring module in `INTEGRATION/src/interaction-wiring.ts` covering all three sub-phases:
- Phase 3a: Lazy audio initialization (`createAppAudioState`, `ensureAudio`)
- Phase 3b: `onPointerDown` → hit-test → immediate audio (UX-D4)
- Phase 3c: Post-classification callbacks (select, drag-scrub, pointer-up) with UI state gating

All 62 integration tests pass (9 smoke + 12 grid-to-beats + 23 progression-pipeline + 18 interaction-wiring). TypeScript compiles cleanly.

### Files Created

| File | Purpose |
|------|---------|
| `src/interaction-wiring.ts` | `createAppAudioState()`, `ensureAudio()`, `createInteractionWiring()` |
| `src/__tests__/interaction-wiring.test.ts` | 18 tests: 5 for lazy init, 5 for onPointerDown, 8 for post-classification |

### Implementation Details

**Phase 3a — Lazy Audio Init (INT-D3):**
- `AppAudioState` is a mutable holder with `transport: AudioTransport | null` and `immediatePlayback: ImmediatePlaybackState | null`
- `ensureAudio()` calls `initAudio()` → `createImmediatePlayback()` on first invocation; caches both
- Concurrent calls deduped via shared `initPromise` — prevents double-init during rapid taps

**Phase 3b — onPointerDown Immediate Audio (UX-D4):**
- On `onPointerDown(world)`:
  1. Check UIState — suppress if `"playback-running"` or `"progression-loaded"` (UX-D6 + INT-D6)
  2. Hit-test at `world` coordinates
  3. `HitTriangle` → `getTrianglePcs(triRef)` → `playPitchClasses(state, pcs)`
  4. `HitEdge` → `getEdgeUnionPcs(edgeId, indices)` → null guard → `playPitchClasses(state, pcs)`
  5. `HitNone` → no audio
- `ensureAudio()` called fire-and-forget (async but non-blocking) — first tap has one-time ~5-20ms delay

**Phase 3c — Post-Classification:**
- `onTriangleSelect` / `onEdgeSelect`: UI state gating only — audio already playing from onPointerDown. Shape construction for `selectChord()` deferred to orchestrator (main.ts)
- `onDragScrub`: retriggers `playPitchClasses()` on each triangle change (UX-D3: sequential triads)
- `onPointerUp`: always calls `stopAll()` — safe even during playback-running (audio stop is harmless)

**State Gating Summary:**
| UI State | Audio | Visual Selection |
|----------|-------|-----------------|
| `idle` | ✅ | ✅ |
| `chord-selected` | ✅ | ✅ |
| `progression-loaded` | ❌ (INT-D6) | ❌ |
| `playback-running` | ❌ (UX-D6) | ❌ |

### Testing Strategy

- Uses real HC functions (`buildWindowIndices`, `getTrianglePcs`, `getEdgeUnionPcs`) and real RU `UIStateController` and `hitTest`
- Mocks entire AE module via `vi.mock("audio-engine")` — AudioContext not available in happy-dom
- Mock provides `__mockTransport` and `__mockImmediatePlayback` for assertion access
- Async tests use `vi.waitFor()` for fire-and-forget promise resolution

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 4ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 8ms
✓ src/__tests__/smoke.test.ts (9 tests) 7ms
✓ src/__tests__/interaction-wiring.test.ts (18 tests) 163ms

Test Files  4 passed (4)
     Tests  62 passed (62)
```

### Next Steps

- Phase 4a: Transport → rendering wiring (`transport-wiring.ts`)
- Phase 4b: ControlPanel → transport wiring

---

## Entry 10 — Phase 4: Transport Wiring (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented the transport wiring module in `INTEGRATION/src/transport-wiring.ts` covering both sub-phases:
- Phase 4a: AudioTransport → rendering (path highlight, UI state, control panel state)
- Phase 4b: ControlPanel → AudioTransport (play, stop, clear, load delegation)

All 79 integration tests pass (9 smoke + 12 grid-to-beats + 23 progression-pipeline + 18 interaction-wiring + 17 transport-wiring). TypeScript compiles cleanly.

### Files Created

| File | Purpose |
|------|---------|
| `src/transport-wiring.ts` | `wireTransportToPath()`, `wireTransportToUIState()`, `wireTransportToControlPanel()`, `wireAllTransportSubscriptions()`, `createControlPanelCallbacks()` |
| `src/__tests__/transport-wiring.test.ts` | 17 tests: 9 for transport→rendering, 8 for panel→transport |

### Implementation Details

**Phase 4a — Transport → Rendering:**
- `wireTransportToPath(transport, pathHandle)`: `onChordChange` → `setActiveChord(index)` — keeps path highlight synced with playing chord
- `wireTransportToUIState(transport, uiState)`: `onStateChange(playing:true)` → `startPlayback()`, `(playing:false)` → `stopPlayback()` — handles both user-initiated stop and natural completion (AE-D10)
- `wireTransportToControlPanel(transport, controlPanel)`: `onStateChange` → `setPlaybackRunning(playing)` — keeps button disabled states correct
- `wireAllTransportSubscriptions()`: convenience composite that returns single unsubscribe function for all three subscriptions

**Phase 4b — ControlPanel → Transport:**
- `createControlPanelCallbacks(options)`: returns `{ onPlay, onStop, onClear, onLoadProgression }` callback object for ControlPanel
  - `onPlay` → `transport.play()` + proactive `uiState.startPlayback()` for immediate UI
  - `onStop` → `transport.stop()` + `uiState.stopPlayback()` + `pathHandle.setActiveChord(-1)` to reset highlight
  - `onClear` → `transport.cancelSchedule()` + `uiState.clearProgression()` + `pathHandle.clear()` + panel state reset
  - `onLoadProgression` → delegates to orchestrator callback
- All pathHandle-using callbacks guard against null (progression may not be loaded)

### Testing Strategy

- Mock AudioTransport with capturable event listener arrays — can fire events programmatically
- Mock PathHandle and ControlPanel with vi.fn() stubs
- Uses real RU `createUIStateController()` for state transition verification
- Tests verify both event propagation and cleanup (unsubscribe removes listeners)

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 3ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 15ms
✓ src/__tests__/transport-wiring.test.ts (17 tests) 14ms
✓ src/__tests__/smoke.test.ts (9 tests) 4ms
✓ src/__tests__/interaction-wiring.test.ts (18 tests) 169ms

Test Files  5 passed (5)
     Tests  79 passed (79)
```

### Next Steps

- Phase 5a: Storage initialization + startup settings (`persistence-wiring.ts`)
- Phase 5b: Save/Load/Share actions

---

## Entry 11 — Phase 5: Persistence Wiring (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented the persistence wiring module in `INTEGRATION/src/persistence-wiring.ts` covering both sub-phases:
- Phase 5a: Storage initialization, settings loading, URL hash detection
- Phase 5b: Save/load/share/delete progression actions, settings update

All 99 integration tests pass (9 smoke + 12 grid-to-beats + 23 progression-pipeline + 18 interaction-wiring + 17 transport-wiring + 20 persistence-wiring). TypeScript compiles cleanly.

### Files Created

| File | Purpose |
|------|---------|
| `src/persistence-wiring.ts` | `initPersistence()`, `checkUrlHash()`, `saveCurrentProgression()`, `loadSavedProgression()`, `listSavedProgressions()`, `deleteSavedProgression()`, `generateShareUrl()`, `updateSettings()` |
| `src/__tests__/persistence-wiring.test.ts` | 20 tests: 7 for init + URL hash, 13 for CRUD + share + settings |

### Implementation Details

**Phase 5a — Storage Init + URL Hash:**
- `initPersistence()`: creates `StorageBackend` via `PD.createLocalStorageBackend()`, loads settings; returns `AppPersistenceState` holder
- `checkUrlHash(hash)`: parses `#p=<encoded>` → discriminated union `{ found: true, payload }` or `{ found: false }` — graceful decode error handling with `console.warn`

**Phase 5b — Actions:**
- `saveCurrentProgression(state, args)`: wraps `PD.saveProgression()` — passes title, chords, tempo, grid, empty notes; returns generated record with ID + timestamps
- `loadSavedProgression(state, id)`: wraps `PD.loadProgression()` → null if not found
- `listSavedProgressions(state)`: wraps `PD.listProgressions()` → sorted most-recent-first
- `deleteSavedProgression(state, id)`: wraps `PD.deleteProgression()` — no-op for missing
- `generateShareUrl(args)`: wraps `PD.encodeShareUrl()` → prepends `#p=` prefix
- `updateSettings(state, partial)`: wraps `PD.saveSettings()`, updates in-memory state reference

**Design choices:**
- Functions are thin wrappers — keep PD dependency localized so orchestrator (main.ts) never imports PD directly
- `AppPersistenceState` holds both backend and cached settings — avoids re-reading localStorage
- `checkUrlHash()` is pure (no side effects except console.warn) — testable without location mock
- Re-exports `DEFAULT_SETTINGS` and `DEFAULT_GRID` for orchestrator convenience

### Testing Strategy

- Uses real PD functions with happy-dom's `localStorage` — no mocking needed
- `localStorage.clear()` in `beforeEach` for test isolation
- Tests verify full round-trips: save → load, save → list, save → delete → load(null)
- URL hash tests use `encodeShareUrl()` to produce realistic encoded strings
- Settings persistence test verifies cross-initialization round-trip

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 6ms
✓ src/__tests__/persistence-wiring.test.ts (20 tests) 12ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 14ms
✓ src/__tests__/transport-wiring.test.ts (17 tests) 18ms
✓ src/__tests__/smoke.test.ts (9 tests) 4ms
✓ src/__tests__/interaction-wiring.test.ts (18 tests) 179ms

Test Files  6 passed (6)
     Tests  99 passed (99)
```

### Next Steps

- Phase 6a: Startup sequence (`main.ts`)
- Phase 6b: `destroyApp()` teardown

---

## Entry 12 — Phase 6: Application Assembly (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented the full application startup sequence in `INTEGRATION/src/main.ts` (Phase 6a) and `destroyApp()` teardown (Phase 6b). Updated the barrel export in `src/index.ts` to re-export all integration utilities and types from Phases 2–5.

All 99 integration tests pass. TypeScript compiles cleanly (`tsc --noEmit` — 0 errors). Vite production build succeeds (49 modules, 33.63 KB bundle / 12.56 KB gzip).

### Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/main.ts` | Replaced (was Phase 1b stub) | Full 14-step startup sequence + `destroyApp()` teardown |
| `src/index.ts` | Replaced (was empty barrel) | Re-exports all integration utilities from Phases 2–5 |

### Implementation Details

**Phase 6a — Startup Sequence (14 steps, per SPEC §Startup Sequence):**

1. **Persistence init** — `initPersistence()` → `AppPersistenceState` with backend + cached settings
2. **Layout** — `createLayoutManager({ root: #app })` → 3-zone layout (toolbar, canvas, control panel)
3. **SVG scaffold** — `createSvgScaffold(canvasContainer)` → root SVG + 5-layer `<g>` groups
4. **Resize controller** — `createResizeController(canvasContainer, scaffold, onResize)` — computes initial bounds/indices, watches for container resizes
5. **Camera controller** — `createCameraController(svg, width, height, bounds)` — sole viewBox writer
6. **Render initial grid** — `renderGrid(layer-grid, indices)`
7. **UI state controller** — `createUIStateController()` — state machine for interaction modes
8. **Audio state (deferred)** — `createAppAudioState()` — null until first user gesture (INT-D3)
9. **Control panel** — `createControlPanel()` with `onLoadProgression`, `onClear`, `onPlay`, `onStop` callbacks
10. **Toolbar** — `createToolbar()` with `onResetView → camera.reset()`
11. **Interaction wiring** — `createInteractionWiring()` → `InteractionCallbacks` for gesture → audio
12. **Interaction controller** — `createInteractionController()` — SVG event listener orchestration
13. **URL hash check** — `checkUrlHash(location.hash)` → auto-load shared progression if present
14. **Ready** — console log, UI in idle or progression-loaded state

**Key Design Patterns:**

- **PathHandle proxy** — Transport subscriptions wired once with a proxy object that always delegates to the current `PathHandle`. Avoids re-wiring on each progression load/clear cycle. The proxy's methods are `setActiveChord(i)`, `clear()`, `getChordCount()` — all delegate to `currentPathHandle` with null-guard.

- **Forward-referenced camera** — Camera controller is created after resize controller but needed in the resize callback. Solved with `let camera: CameraController | null = null` and null-guard in the callback. Camera is assigned immediately after creation.

- **Grid tracking** — `activeGrid: GridValue` tracks the current grid setting (from `DEFAULT_GRID` or URL payload). `SettingsRecord` only stores `tempo_bpm`, not grid — grid comes from `ProgressionRecord` or `SharePayload`.

- **Progression load flow** — `loadProgressionFromChords(chords)`:
  1. Calls `loadProgressionPipeline()` with current grid + origin focus + current indices
  2. Clears previous path if any
  3. Renders new path via `renderProgressionPath()`
  4. Updates UI state synchronously (immediate visual feedback)
  5. Schedules on transport asynchronously via `ensureAudio()` + `scheduleProgression()`
  6. Wires transport subscriptions on first load

- **Control panel callbacks** — Direct functions (not via `createControlPanelCallbacks`) since transport may be null at creation time. Each callback guards on `audioState.transport` existence.

**Phase 6b — `destroyApp()` Teardown:**
- Unsubscribes transport events
- Stops all audio (transport stop/cancel + immediate playback stopAll)
- Clears rendered progression path
- Destroys controllers in dependency order: interaction → camera → resize → control panel → toolbar → layout
- Clears DOM (`appEl.innerHTML = ""`)
- Not critical for MVP (single-page, never unmounts) but prevents refactor cost if embedded later

**Barrel Export (`index.ts`):**
- Re-exports all integration utilities from Phases 2–5 (functions + types)
- Does NOT re-export `destroyApp` from `main.ts` — importing the barrel should not trigger side-effecting app initialization
- Organized by phase with comments

### Resize Handling

The onResize callback from `createResizeController`:
1. Updates camera dimensions via `camera.updateDimensions(containerWidth, containerHeight, bounds)`
2. Clears the grid layer's DOM children
3. Re-renders grid with new indices via `renderGrid(gridLayer, indices)`

### Build Output

```
vite v6.4.1 building for production...
✓ 49 modules transformed.
dist/index.html                 0.54 kB │ gzip:  0.35 kB
dist/assets/index-CCdYGxxO.js  33.63 kB │ gzip: 12.56 kB
✓ built in 279ms
```

Bundle grew from 2.30 KB (Phase 1b stub) to 33.63 KB — now includes all four subsystem codepaths. Gzip: 12.56 KB — well within static deployment targets.

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 7ms
✓ src/__tests__/persistence-wiring.test.ts (20 tests) 17ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 12ms
✓ src/__tests__/transport-wiring.test.ts (17 tests) 17ms
✓ src/__tests__/smoke.test.ts (9 tests) 4ms
✓ src/__tests__/interaction-wiring.test.ts (18 tests) 174ms

Test Files  6 passed (6)
     Tests  99 passed (99)
```

### Next Steps

- Phase 7a: Integration tests (full pipeline end-to-end)
- Phase 7b: Code review and cleanup
- Phase 7c: Optional polish (keyboard shortcuts, debug logging)

---
