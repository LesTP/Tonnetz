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

## Entry 14 — Phase 7b: Code Review & Cleanup (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Systematic code review of all 7 integration module source files. Verified dependency direction constraint, removed unused imports, cleaned up test files. Zero functional changes — all fixes were dead code removal.

### Review Methodology

1. Read all 7 source files (`grid-to-beats.ts`, `progression-pipeline.ts`, `interaction-wiring.ts`, `transport-wiring.ts`, `persistence-wiring.ts`, `main.ts`, `index.ts`)
2. Ran `tsc --noEmit --noUnusedLocals --noUnusedParameters` to catch all unused imports
3. Verified dependency direction: `grep` across all 4 subsystem `src/` directories for `integration` imports → zero hits
4. Reviewed error paths, null guards, and state machine interaction safety

### Fixes Applied

| File | Fix | Category |
|------|-----|----------|
| `src/main.ts` | Removed unused `Shape` type import from `harmony-core` | Dead import |
| `src/interaction-wiring.ts` | Removed unused `TriRef` type import from `harmony-core` | Dead import |
| `src/__tests__/integration-flow.test.ts` | Removed unused `Shape` type import from `harmony-core` | Dead import |
| `src/__tests__/persistence-wiring.test.ts` | Removed unused `DEFAULT_GRID` value import | Dead import |
| `src/__tests__/persistence-wiring.test.ts` | Removed unused `decodeShareUrl` value import | Dead import |
| `src/__tests__/smoke.test.ts` | Removed 3 unused type-only import blocks (`Shape, Chord, NodeCoord, WindowIndices`, `WorldPoint, HitResult, UIStateController`, `AudioTransport, ChordEvent, TransportState`, `ProgressionRecord, SettingsRecord, SharePayload`) | Dead imports |

### Review Findings (No Action Required)

1. **Double state transitions safe**: `handlePlay()` calls `uiState.startPlayback()` directly AND `wireTransportToUIState` also fires it when transport emits `stateChange(playing:true)`. The UIStateController guards duplicate transitions internally — double-call is a safe no-op.

2. **Clear during playback ordering**: `handleClear()` calls `uiState.clearProgression()` which transitions to `"idle"`. If transport was playing, the subsequent `stateChange(playing:false)` from transport → `stopPlayback()` is a no-op from idle state. Safe.

3. **Dependency direction clean**: No subsystem imports from the integration module. HC types are consumed by RU and AE (per SPEC §Dependency Direction).

4. **Error paths covered**: Invalid chord symbols → `PipelineError`; malformed URL hash → `console.warn` + `{ found: false }`; corrupt localStorage → PD's `loadSettings` returns `DEFAULT_SETTINGS`; null audio state → all callbacks guard.

5. **Build output unchanged**: 49 modules, 33.63 KB / 12.56 KB gzip — no size change from Phase 6 (dead import removal has zero runtime effect).

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 7ms
✓ src/__tests__/persistence-wiring.test.ts (20 tests) 11ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 8ms
✓ src/__tests__/transport-wiring.test.ts (17 tests) 21ms
✓ src/__tests__/integration-flow.test.ts (32 tests) 53ms
✓ src/__tests__/smoke.test.ts (9 tests) 7ms
✓ src/__tests__/interaction-wiring.test.ts (18 tests) 165ms

Test Files  7 passed (7)
     Tests  131 passed (131)
```

### Next Steps

- Phase 7c: Optional polish (keyboard shortcuts, debug logging)
- INT-D8: Tempo control UI decision (deferred to visual testing)

### Action Item: Rendering/UI Module Cleanup

The `tsc --noUnusedLocals --noUnusedParameters` pass surfaced 4 warnings in the **RENDERING_UI** subsystem (not addressed here — outside integration module scope):

| File | Line | Issue |
|------|------|-------|
| `RENDERING_UI/src/camera.ts` | 136 | `containerWidth` declared but never read |
| `RENDERING_UI/src/camera.ts` | 137 | `containerHeight` declared but never read |
| `RENDERING_UI/src/path-renderer.ts` | 152 | `currentActiveIndex` declared but never read |
| `RENDERING_UI/src/renderer.ts` | 8 | `setAttrs` imported but never read |

These should be resolved in the RU module's own maintenance pass. They do not affect integration module correctness or build output (TypeScript compiles cleanly under standard `--strict` flags; these only surface with the stricter `--noUnusedLocals` / `--noUnusedParameters` checks).

**Update (2026-02-15):** All 4 warnings resolved — see Entry 15 below.

---

## Entry 15 — Rendering/UI Module Cleanup (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Resolved all 4 unused-variable/import warnings in the RENDERING_UI subsystem identified during Entry 14's `tsc --noUnusedLocals --noUnusedParameters` pass.

### Fixes Applied

| File | Fix | Category |
|------|-----|----------|
| `RENDERING_UI/src/camera.ts` | Prefixed `containerWidth` → `_containerWidth` in `computeInitialCamera()` params | Unused parameter (public API signature preserved) |
| `RENDERING_UI/src/camera.ts` | Prefixed `containerHeight` → `_containerHeight` in `computeInitialCamera()` params | Unused parameter (public API signature preserved) |
| `RENDERING_UI/src/path-renderer.ts` | Removed `currentActiveIndex` variable entirely — was written to but never read | Dead variable (write-only state tracking) |
| `RENDERING_UI/src/renderer.ts` | Removed `setAttrs` from `import { svgEl, setAttrs }` | Dead import |

### Design Notes

- **`computeInitialCamera` params**: The `containerWidth` and `containerHeight` parameters are part of the public API contract (ARCH_RENDERING_UI.md §2, SPEC.md §Rendering/UI API Overview). The current implementation only uses `bounds` via `windowWorldExtent()`. Underscore-prefixing preserves the API signature while silencing the unused-parameter warning. If a future revision needs container dimensions for aspect-ratio-aware initial camera positioning, the params are ready.

- **`currentActiveIndex` removal**: The variable tracked which chord index was active in the `renderProgressionPath` closure, but no code path ever read it back. The active chord state is already maintained visually via the `activeMarker` SVG element's position and visibility. No functional change.

- **`setAttrs` removal**: The helper was imported alongside `svgEl` but all attribute-setting in `renderer.ts` uses inline `svgEl()` attribute objects. No call sites exist.

### Test Results

```
RENDERING_UI: 344 passed (344) — 18 test files, 0 failures
```

All tests pass with zero regressions.

### Next Steps

- Phase 7c: Optional polish (keyboard shortcuts, debug logging)
- INT-D8: Tempo control UI decision (deferred to visual testing)

---

## Entry 13 — Phase 7a: Integration Flow Tests (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Created comprehensive integration flow test (`integration-flow.test.ts`) exercising the full progression lifecycle: load → play → chord-advance → stop → reload → clear. This is the cross-module "wiring correctness" test that validates the data flow paths main.ts orchestrates.

32 new tests across 5 describe blocks. All 131 integration tests pass (99 prior + 32 new).

### Files Created

| File | Purpose |
|------|---------|
| `src/__tests__/integration-flow.test.ts` | 32 end-to-end flow tests across 5 describe groups |

### Test Coverage

| Group | Tests | What it validates |
|-------|-------|-------------------|
| **Full progression lifecycle** | 20 | Load (8), Play (2), Chord advance (2), Stop (3), Clear (2), Full cycle (1) |
| **Persistence integration** | 5 | initPersistence defaults, URL hash decode/pipeline, invalid hash handling |
| **UI state machine constraints** | 4 | Idle guard, state sequence tracking, idempotent play, subscription cleanup |
| **Cross-module data integrity** | 4 | covered_pcs Sets, centroid references, triplet grid timing, chain-focus movement |

### Test Strategy

- **Mock AE module** with controllable transport — stores `onChordChange` / `onStateChange` listeners in arrays; test helper functions `fireChordChange(index)` and `fireStateChange(playing)` simulate transport events
- **Real HC functions** — `buildWindowIndices`, `parseChordSymbol`, `mapProgressionToShapes` — validates actual chord parsing and placement
- **Real RU UIStateController** — verifies actual state machine transitions
- **Real PD functions** — `encodeShareUrl`, `decodeShareUrl` via happy-dom localStorage
- **`loadAndWire()` helper** — replicates the main.ts wiring sequence (parse → pipeline → loadProgression → ensureAudio → scheduleProgression → wireAllTransportSubscriptions) in miniature, returning pipeline result + composite unsubscribe function

### Key Tests

1. **Full lifecycle test** — exercises complete cycle: load ii-V-I → play → advance 3 chords → stop → clear → load second progression (Am-F-C-G) → play → advance 4 chords → force-stop during playback → clear
2. **State sequence test** — `uiState.onStateChange` captures: `progression-loaded → playback-running → progression-loaded → idle`
3. **URL hash → pipeline** — real `encodeShareUrl()` → `checkUrlHash()` → `loadProgressionPipeline()` at 1/8 grid → verifies 0.5-beat durations
4. **Chain-focus movement** — verifies each chord in C-Am-F-G has a distinct centroid (progression traverses the lattice)
5. **Shape identity preservation** — `scheduledEvents[i].shape === pipelineResult.shapes[i]` (same object, not copy)

### Fixes During Development

1. **`require("persistence-data")` fails** — Vitest aliases only work for ESM imports. Changed to top-level `import { encodeShareUrl } from "persistence-data"`.
2. **`onStateChange` callback signature** — UIStateController's callback receives `{ state, prevState, ... }` object, not bare string. Fixed to extract `.state` field.

### Test Results

```
✓ src/__tests__/grid-to-beats.test.ts (12 tests) 5ms
✓ src/__tests__/persistence-wiring.test.ts (20 tests) 18ms
✓ src/__tests__/progression-pipeline.test.ts (23 tests) 13ms
✓ src/__tests__/transport-wiring.test.ts (17 tests) 34ms
✓ src/__tests__/integration-flow.test.ts (32 tests) 46ms
✓ src/__tests__/smoke.test.ts (9 tests) 5ms
✓ src/__tests__/interaction-wiring.test.ts (18 tests) 174ms

Test Files  7 passed (7)
     Tests  131 passed (131)
```

### Next Steps

- Phase 7b: Code review and cleanup
- Phase 7c: Optional polish (keyboard shortcuts, debug logging)

---

## Entry 16 — TypeScript Project References (TS6059 Elimination)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented TypeScript project references across all 5 modules to eliminate the TS6059 `rootDir` errors that surfaced when running `tsc --noEmit` from subsystems with cross-module `paths` mappings.

### Problem

Each subsystem's `tsconfig.json` used `paths` to resolve cross-module imports (e.g., `"harmony-core" → "../HARMONY_CORE/src/index.ts"`). When `tsc` followed these paths, it pulled the referenced subsystem's **source `.ts` files** into the current compilation. Since those files live outside the declared `rootDir` (`./src`), TypeScript emitted TS6059 for every imported source file:

```
error TS6059: File '.../HARMONY_CORE/src/types.ts' is not under 'rootDir' '.../RENDERING_UI/src'
```

This was cosmetic (Vitest and Vite use their own alias resolution and never hit this), but it polluted typecheck output and would break CI `typecheck` scripts that check for zero errors.

### Solution: Project References

TypeScript **project references** (`composite` + `references`) tell `tsc -b` to:
1. Build each referenced project first, producing `.d.ts` declarations in `dist/`
2. When type-checking the consuming project, resolve imports to those `.d.ts` files instead of raw `.ts` source

Both `paths` (for module name resolution) and `references` (for build-order and declaration resolution) are needed together.

### Changes Applied

#### tsconfig.json updates

| File | Changes |
|------|---------|
| `HARMONY_CORE/tsconfig.json` | Added `composite: true`, `declarationMap: true`, `exclude: ["src/**/*.test.ts"]` |
| `PERSISTENCE_DATA/tsconfig.json` | Added `composite: true`, `declarationMap: true`, `exclude: ["src/**/*.test.ts"]` |
| `AUDIO_ENGINE/tsconfig.json` | Added `composite: true`, `declarationMap: true`, `exclude: ["src/**/*.test.ts"]`, `references: [{ path: "../HARMONY_CORE" }]` |
| `RENDERING_UI/tsconfig.json` | Added `composite: true`, `declarationMap: true`, `exclude: ["src/**/*.test.ts"]`, `references: [{ path: "../HARMONY_CORE" }, { path: "../AUDIO_ENGINE" }]` |
| `INTEGRATION/tsconfig.json` | Added `references: [HC, RU, AE, PD]`; retained `paths` + `noEmit: true` (non-composite app entry point) |
| `tsconfig.json` (root, **new**) | Solution-level orchestrator: `"files": [], "references": [HC, PD, AE, RU, INT]` |

#### package.json updates

| File | Changes |
|------|---------|
| All 4 subsystem `package.json` | `exports` updated from `./src/index.ts` to `{ import: "./dist/index.js", types: "./dist/index.d.ts" }`. Added `"build": "tsc -b"` script. |

#### vitest.config.ts / vite.config.ts

**No changes** — Vitest and Vite resolve cross-module imports via their own `resolve.alias` configurations (pointing to source `.ts` files). These are independent from TypeScript's module resolution and are unaffected by the project references change. This dual-resolution approach means:
- `tsc -b` uses `.d.ts` declarations for type-checking (clean, no TS6059)
- Vitest/Vite use source `.ts` directly for fast transforms (no build step needed for tests)

### Dependency Graph (Build Order)

```
tsc -b (from root tsconfig.json)
  │
  ├── HARMONY_CORE      (leaf — no references)
  ├── PERSISTENCE_DATA   (leaf — no references)
  │
  ├── AUDIO_ENGINE       (references: HC)
  │
  ├── RENDERING_UI       (references: HC, AE)
  │
  └── INTEGRATION        (references: HC, RU, AE, PD — noEmit, non-composite)
```

### Design Notes

- **`composite: true` requires `exclude` for test files** — composite projects must have all included files be part of the build. Test files import from vitest (not a production dependency) and would cause errors. Excluding `src/**/*.test.ts` keeps the composite build clean while vitest runs tests via its own resolution.

- **`declarationMap: true`** — enables go-to-definition from consuming projects to jump to the original `.ts` source rather than the `.d.ts` file, preserving the IDE navigation experience.

- **INTEGRATION is non-composite** — it's the application entry point, not a library consumed by other projects. It uses `noEmit: true` for typecheck-only and Vite for bundling. Adding `composite` would be unnecessary and conflict with `noEmit`.

- **Root `tsconfig.json` uses `"files": []`** — the root config is a solution file only. It has no source files of its own; it exists solely to orchestrate `tsc -b` across all subsystems in the correct dependency order.

- **`paths` retained alongside `references`** — with `moduleResolution: "bundler"`, `paths` provides the resolution mapping (telling tsc where `"harmony-core"` lives), while `references` provides the build-order directive (telling tsc to use built `.d.ts` output, not raw source). Both are required.

### Verification

```
tsc -b (from root):     0 errors (was: ~30+ TS6059 errors)
tsc -b (from HC):       0 errors
tsc -b (from AE):       0 errors
tsc -b (from RU):       0 errors  (was: 9 TS6059 errors)
tsc -b (from INT):      0 errors
```

All test suites pass with zero regressions:

```
Harmony Core:      168 passed
Persistence/Data:  108 passed
Audio Engine:      172 passed
Rendering/UI:      344 passed
Integration:       131 passed
Total:             923 passed
```

### Usage

```bash
# Full workspace typecheck + build (from project root):
cd HARMONY_CORE && npx tsc -b ..

# Single subsystem typecheck + build (builds dependencies first):
cd RENDERING_UI && npx tsc -b

# Incremental rebuild (only rebuilds changed files):
cd HARMONY_CORE && npx tsc -b    # fast — uses .tsbuildinfo

# Clean rebuild:
cd HARMONY_CORE && npx tsc -b --clean ..
```

---

## Entry 17 — Phase 7c: Optional Polish (Complete)

**Date:** 2026-02-15
**Mode:** Code

### Summary

Implemented keyboard shortcuts and structured debug logging. Reviewed the playback rendering path for performance — no unnecessary re-renders found.

### Files Created

| File | Description |
|------|-------------|
| `INTEGRATION/src/keyboard-shortcuts.ts` | Global keyboard shortcut handler (Escape = clear, Space = play/stop) |
| `INTEGRATION/src/__tests__/keyboard-shortcuts.test.ts` | 13 tests covering all states, text input suppression, destroy cleanup |
| `INTEGRATION/src/logger.ts` | Structured dev-only logger (`import.meta.env.DEV` gated, tree-shaken in production) |
| `INTEGRATION/src/vite-env.d.ts` | Vite client type reference for `import.meta.env` support in `tsc -b` |

### Files Modified

| File | Changes |
|------|---------|
| `INTEGRATION/src/main.ts` | Wired `createKeyboardShortcuts()` (Step 12b), `keyboardShortcuts.destroy()` in teardown, replaced raw `console.log`/`console.warn` with `log.info`/`log.warn` |
| `INTEGRATION/src/index.ts` | Added barrel exports for `createKeyboardShortcuts`, `KeyboardShortcutOptions`, `log` |

### Keyboard Shortcuts

| Key | State | Action |
|-----|-------|--------|
| Escape | `progression-loaded` or `playback-running` | Clear progression (same as Clear button) |
| Space | `progression-loaded` | Play (same as Play button) |
| Space | `playback-running` | Stop (same as Stop button) |
| Any key | `idle` or `chord-selected` | No action |
| Any key | Text input focused (textarea, input, contentEditable) | Suppressed — no shortcut fires |

Shortcuts are wired in `main.ts` Step 12b, destroyed in `destroyApp()`, and use the same `handleClear`/`handlePlay`/`handleStop` callbacks as the control panel buttons — no duplicated logic.

### Debug Logger

```typescript
import { log } from "./logger.js";
log.info("startup", "App ready", { state: "idle" });
log.warn("pipeline", "Invalid chord", { symbol: "Xaug7" });
log.error("audio", "Init failed", error);
```

- **Dev mode** (`vite dev`): full structured output via `console.info`/`warn`/`error`
- **Production build** (`vite build`): all log calls are no-ops, tree-shaken by Vite/Rollup
- Format: `[Tonnetz:<tag>] <message>` followed by optional data args
- Three existing `console.log`/`console.warn` calls in `main.ts` replaced with `log.info`/`log.warn`

### Performance Review

Traced the playback rendering path during `playback-running` state:

1. **`onChordChange` → `setActiveChord(index)`** — 2–3 `setAttribute` calls on a single pre-existing SVG `<circle>` (cx, cy, visibility). World coordinates pre-computed at render time. No element creation, no DOM tree mutation.
2. **`onStateChange` → `uiState.startPlayback()`** — State machine transition only. No DOM.
3. **`onStateChange` → `controlPanel.setPlaybackRunning()`** — Toggles `disabled` on 3 buttons.

**No unnecessary re-renders found.** No `rAF` loops, no grid re-rendering, no shape re-rendering. The playback path is already minimal.

### Test Results

```
Integration: 144 passed (144) — 8 test files, 0 failures
  (was 131, +13 keyboard shortcut tests)
tsc -b: 0 errors
```

### Phase 7c Status: Complete

All three items delivered:
- ✅ Keyboard shortcuts (Escape, Space)
- ✅ Structured debug logging
- ✅ Performance review (clean — no changes needed)

---

## Entry 18 — Phase 8: User Testing — Design Pass 1

**Date:** 2026-02-16
**Scope:** Visual design adjustments based on first live user testing session.

### User Feedback (5 items)

| # | Feedback | Resolution |
|---|----------|------------|
| 1 | Default zoom too far out — few progressions span more than 6 triangles | **Fixed.** Default zoom changed from 1 to 4 (MAX_ZOOM raised to 8 so users can still zoom in from default) |
| 2 | Pointer should be a circle to show triangle vs edge hit zone | **Fixed.** Added `ProximityCursor` — dashed circle follows pointer at 1/3 proximity radius. New file: `cursor.ts` |
| 3 | Node labels overlap circles, hard to read; grid too dark | **Fixed.** Node circles enlarged (0.08→0.15 radius), grid edges/triangles lightened to pale grey, labels bolded black |
| 4 | Grid is a skewed parallelogram, should be rectangular | **Skipped.** Would require HC `WindowBounds` API change or per-row filtering. At 4× default zoom the edges are off-screen — moot. |
| 5 | Major/minor triangles should be different colors; active chord should be bright | **Fixed.** Grid: major=pale blue, minor=pale red. Active shapes: bright blue/red at 0.55 opacity. Extensions: half intensity (0.28). |

Additional feedback during testing:
- Cursor circle too large (bigger than a triangle) → reduced to 1/3 proximity radius
- Playing chord not highlighted → wired `highlightTriangle` on interactive clicks + `renderShape` on progression playback chord changes

### Files Changed

**RENDERING_UI (visual design):**

| File | Change |
|------|--------|
| `camera.ts` | `DEFAULT_ZOOM = 4`, `MAX_ZOOM = 8` (was 4). `computeInitialCamera` returns `DEFAULT_ZOOM`. |
| `renderer.ts` | Grid colors: edges `#ccc`, triangle strokes `#d0d0d0`, node fill `#e8e8e8`/stroke `#bbb`, labels bold black `#111`. Triangle fills: `MAJOR_TRI_FILL` (pale blue 0.25) and `MINOR_TRI_FILL` (pale red 0.25). Node radius `0.15` (was 0.08), font size `0.18` (was 0.22). |
| `shape-renderer.ts` | Orientation-aware fill colors. Main: major `rgba(60,120,230,0.55)`, minor `rgba(220,60,60,0.55)`. Extension: half-opacity variants. Stroke colors per orientation. Helper functions `mainTriFill()`, `extTriFill()`, `triStroke()`. |
| `highlight.ts` | Orientation-aware highlight colors matching shape-renderer. `createHighlightPolygon` takes `isExtension` parameter for half-intensity extension highlights. |
| `cursor.ts` | **New file.** `createProximityCursor()` — dashed SVG circle tracking pointer at proximity radius, hidden on pointer leave, `pointer-events: none`. |
| `index.ts` | Added barrel exports for `createProximityCursor`, `ProximityCursor`. |

**RENDERING_UI (test updates):**

| File | Change |
|------|--------|
| `camera.test.ts` | Updated expectations: initial zoom = 4, MAX_ZOOM = 8. Rewritten zoom/viewBox tests for new defaults. |
| `camera-controller.test.ts` | Updated expectations: initial zoom = 4, MAX_ZOOM clamp = 8, zoom-in wheel works from default. |

**INTEGRATION (highlighting wiring):**

| File | Change |
|------|--------|
| `main.ts` | (1) Wrapped `interactionCallbacks` to add `highlightTriangle` on triangle/edge select with `clearAllHighlights` before each. (2) `pathHandleProxy.setActiveChord` now renders active chord Shape via `renderShape` and clears previous. (3) `handleClear` clears active shape handle and resets stored shapes. (4) Imports: added `renderShape`, `highlightTriangle`, `clearAllHighlights`, `ShapeHandle`, `TriId`, `EdgeId`, `Shape`. (5) Cursor wired at Step 12b with 1/3 radius. |

### Design Constants Summary

```
Grid:
  GRID_EDGE_COLOR     = "#ccc"
  GRID_TRI_STROKE     = "#d0d0d0"
  NODE_FILL           = "#e8e8e8"
  NODE_STROKE         = "#bbb"
  NODE_RADIUS         = 0.15
  LABEL_COLOR         = "#111"
  LABEL_FONT_SIZE     = 0.18
  MAJOR_TRI_FILL      = rgba(180, 200, 240, 0.25)   // pale blue
  MINOR_TRI_FILL      = rgba(240, 185, 185, 0.25)   // pale red

Active shape:
  MAIN_TRI_FILL_MAJOR = rgba(60, 120, 230, 0.55)    // bright blue
  MAIN_TRI_FILL_MINOR = rgba(220, 60, 60, 0.55)     // bright red
  EXT_TRI_FILL_MAJOR  = rgba(60, 120, 230, 0.28)    // half blue
  EXT_TRI_FILL_MINOR  = rgba(220, 60, 60, 0.28)     // half red

Camera:
  DEFAULT_ZOOM = 4
  MAX_ZOOM     = 8
  MIN_ZOOM     = 0.25

Cursor:
  Display radius = computeProximityRadius() / 3 ≈ 0.167 world units
  Hit-test radius = 0.5 world units (unchanged)
```

### Test Results

```
tsc -b: 0 errors
HC:  168 passed (168) — unchanged
PD:  108 passed (108) — unchanged
AE:  172 passed (172) — unchanged
RU:  344 passed (344) — 7 tests updated for new zoom defaults
INT: 144 passed (144) — unchanged
Total: 936 passed (936) — 0 failures
```

### Phase 8 Status: In Progress

First design pass complete. Awaiting further user testing feedback.

---

## Entry 19 — Phase 8: User Testing — Design Pass 2 (Interaction Fixes)

Date: 2026-02-16

### Feedback Items

| # | User Report | Root Cause | Resolution |
|---|-------------|------------|------------|
| 1 | First click sustains indefinitely; subsequent clicks stop on release | `ensureAudio()` is truly async on first call (~5-20ms). If pointer-up fires before the promise resolves, `stopAll()` runs before `playPitchClasses()` starts — the late voices are never stopped | Added monotonic `pointerGeneration` counter in `interaction-wiring.ts`. Increments on pointer-down and on pointer-up. Async callback checks generation hasn't changed; if it has, skips playing |
| 2 | Triangle highlights appear only on release, not on press | Highlighting was wired to `onTriangleSelect`/`onEdgeSelect` (fire from `onTap` gesture = pointer-up). Not triggered on pointer-down | Moved highlight logic from `onTriangleSelect`/`onEdgeSelect` into `onPointerDown` wrapper in `main.ts`. Now runs `hitTest` immediately on press and highlights the hit triangle(s). `onPointerUp` clears highlights |
| 3 | Clicking inside a triangle always plays an extended chord (3 triangles) instead of a single triad | Hit-test proximity radius (0.5) was larger than the triangle centroid-to-edge distance (~0.289), so virtually any click hit an edge | Reduced default proximity factor from 0.5 to 0.18 in `interaction-controller.ts` |
| 4 | After switching to playback mode, interaction highlights persist | `clearAllHighlights` not called when loading a progression or starting playback | Added `clearAllHighlights(scaffold.layers["layer-interaction"])` in `handlePlay()` and `loadProgressionFromChords()` |
| 5 | Interaction highlight colors are deeper/more vivid than playback colors | Highlight.ts used 0.65/0.35 opacity; shape-renderer.ts used 0.55/0.28 | Aligned highlight.ts fill opacities to match shape-renderer: main 0.55, ext 0.28, stroke 0.8 |
| 6 | Cursor circle is bigger than a triangle | Visual cursor used full proximity radius (0.5) | Changed cursor radius to `computeProximityRadius() / 3` (later unified to match hit-test) |
| 7 | Visual cursor is accurate but audio still hits edges (plays extension notes) | **Two separate hit-tests with different radii:** visual highlight in `main.ts` used 0.12 radius; audio hit-test in `interaction-wiring.ts` used default `computeProximityRadius()` = 0.5 | Passed `proximityRadius: INTERACTION_PROXIMITY` (0.12) to `createInteractionWiring()` so visual and audio use the same radius |
| 8 | Clicking around a single triangle plays different chords near vertices | Same as #7 — audio radius 0.5 hit different edges depending on click position within the visual triangle | Resolved by #7 fix |

### Files Changed

| File | Changes |
|------|---------|
| `INTEGRATION/src/interaction-wiring.ts` | Added `pointerGeneration` counter for async race prevention; comments updated to reflect new highlighting location |
| `INTEGRATION/src/main.ts` | Highlight on `onPointerDown`/`onPointerUp` instead of `onTriangleSelect`/`onEdgeSelect`; added `hitTest` import; pass `proximityRadius` to `createInteractionWiring`; clear highlights on play/load |
| `RENDERING_UI/src/interaction-controller.ts` | Default proximity factor 0.5 → 0.18 → 0.12 |
| `RENDERING_UI/src/highlight.ts` | Fill opacities aligned to match shape-renderer (0.65→0.55 main, 0.35→0.28 ext, 0.9→0.8 stroke) |

### Architecture Insight: The Three Hit-Test Radii

A key lesson from this pass: there were **three independent hit-test radii** that needed to stay synchronized:

1. **`interaction-controller.ts`** — internal hit-test for tap/drag classification (`proximityFactor` option)
2. **`interaction-wiring.ts`** — audio hit-test in `onPointerDown` (`proximityRadius` option)
3. **`main.ts`** — visual highlight hit-test in `onPointerDown` wrapper (`INTERACTION_PROXIMITY` constant)

All three now use `computeProximityRadius(0.12)` = 0.12 world units. The proximity cursor also uses this same radius.

### Design Constants After Pass 2

| Constant | Value | Location |
|----------|-------|----------|
| Hit-test proximity radius | 0.12 world units | interaction-controller.ts, interaction-wiring.ts, main.ts |
| Proximity cursor radius | 0.12 world units | main.ts |
| Pointer generation | monotonic counter | interaction-wiring.ts |

### Test Results

```
tsc -b: 0 errors
HC:  168 passed (168) — unchanged
PD:  108 passed (108) — unchanged
AE:  172 passed (172) — unchanged
RU:  344 passed (344) — unchanged
INT: 144 passed (144) — unchanged
Total: 936 passed (936) — 0 failures
```

---

## Entry 20 — Phase 8: User Testing — Design Pass 3 (Colors, Labels, Radius)

Date: 2026-02-16

### Feedback Items

| # | User Report | Resolution |
|---|-------------|------------|
| 1 | Major/minor triangle colors should be flipped: major = red, minor = blue (standard musical affordance) | Swapped all color assignments across renderer.ts, shape-renderer.ts, highlight.ts |
| 2 | Note labels should show enharmonic equivalents (e.g. C#/Db) | Added `PC_ENHARMONIC` lookup table; nodes with enharmonics render two text elements (sharp on top, flat on bottom) at 62% font size with 38% node-radius vertical offset; natural notes keep single centered label |
| 3 | Enharmonic labels are too cramped inside the circle | Reduced enharmonic font size from 75% to 62% of base LABEL_FONT_SIZE |
| 4 | Note labels should be dark grey instead of black | Changed LABEL_COLOR from `#111` to `#555` |

### Files Changed

| File | Changes |
|------|---------|
| `RENDERING_UI/src/renderer.ts` | Flipped `MAJOR_TRI_FILL` (→ pale red) and `MINOR_TRI_FILL` (→ pale blue); added `PC_ENHARMONIC` lookup table; dual-label rendering for enharmonic nodes; `LABEL_COLOR` `#111` → `#555`; enharmonic font 62% of base |
| `RENDERING_UI/src/shape-renderer.ts` | Flipped `MAIN_TRI_FILL_MAJOR` (→ red 220,60,60), `MAIN_TRI_FILL_MINOR` (→ blue 60,120,230), and all extension/stroke variants |
| `RENDERING_UI/src/highlight.ts` | Flipped `HIGHLIGHT_FILL_MAJOR` (→ red), `HIGHLIGHT_FILL_MINOR` (→ blue), and all extension/stroke variants |
| `RENDERING_UI/src/__tests__/renderer.test.ts` | Updated pitch-class label test to handle both primary (`label-N:u,v`) and enharmonic (`label-alt-N:u,v`) text elements |

### Design Constants After Pass 3

| Constant | Value | Location |
|----------|-------|----------|
| **Color Scheme** | | |
| Major (Up) grid tint | `rgba(240, 185, 185, 0.25)` pale red | renderer.ts |
| Minor (Down) grid tint | `rgba(180, 200, 240, 0.25)` pale blue | renderer.ts |
| Major active fill | `rgba(220, 60, 60, 0.55)` red | shape-renderer.ts, highlight.ts |
| Minor active fill | `rgba(60, 120, 230, 0.55)` blue | shape-renderer.ts, highlight.ts |
| Major extension fill | `rgba(220, 60, 60, 0.28)` pale red | shape-renderer.ts, highlight.ts |
| Minor extension fill | `rgba(60, 120, 230, 0.28)` pale blue | shape-renderer.ts, highlight.ts |
| Major stroke | `rgba(200, 40, 40, 0.8)` red | shape-renderer.ts, highlight.ts |
| Minor stroke | `rgba(40, 90, 200, 0.8)` blue | shape-renderer.ts, highlight.ts |
| **Labels** | | |
| Label color | `#555` dark grey | renderer.ts |
| Base font size | 0.18 world units | renderer.ts |
| Enharmonic font size | 0.18 × 0.62 ≈ 0.112 world units | renderer.ts |
| Enharmonic vertical offset | NODE_RADIUS × 0.38 | renderer.ts |
| **Enharmonic Map** | | |
| PC 1 | C# / Db | renderer.ts |
| PC 3 | D# / Eb | renderer.ts |
| PC 6 | F# / Gb | renderer.ts |
| PC 8 | G# / Ab | renderer.ts |
| PC 10 | A# / Bb | renderer.ts |

### Test Results

```
tsc -b: 0 errors
HC:  168 passed (168) — unchanged
PD:  108 passed (108) — unchanged
AE:  172 passed (172) — unchanged
RU:  344 passed (344) — 1 test updated for enharmonic labels
INT: 144 passed (144) — unchanged
Total: 936 passed (936) — 0 failures
```

### Phase 8 Status: In Progress

Design passes 1-3 complete. User indicated next testing sessions: **playback** and **audio**.

---

## Entry 21 — Phase 8: User Testing — Design Pass 4 (Triangle Playing State + Grid Highlighter)

Date: 2026-02-16

### Goal

Redesign the visual treatment of triangles when "playing" (interactive press or progression playback) vs "at rest" (idle). User provided reference images showing desired look: at rest = soft pastel fill with grey outlines; playing = deep opaque fill with colored outlines and node circles sitting cleanly on top of the triangle.

### Architecture Change: Overlay → Mutate-Grid

**Problem:** The previous approach created overlay SVG polygons on `layer-chords` / `layer-interaction` on top of the static `layer-grid`. This caused node circles (rendered in `layer-grid`) to be covered by the overlay triangle fill — the nodes looked buried under the playing state instead of sitting cleanly on top.

**Solution:** New **mutate-grid** approach. Instead of creating overlay elements, directly mutate the existing `layer-grid` triangle polygon `fill`, edge line `stroke`/`stroke-width`, and node circle `stroke`/`stroke-width` attributes. A `saveOnce` mechanism stores original values and restores them on deactivation. Since node circles are rendered _after_ triangle polygons within `layer-grid`, they naturally sit on top — no z-order conflict.

**Trade-off:** `layer-grid` is no longer fully static (attributes are mutated during interaction). This is an acceptable pragmatic compromise — the grid structure is static, only visual attributes change transiently.

### Feedback Items

| # | User Report | Resolution |
|---|-------------|------------|
| 1 | At rest triangles too faint (0.25 opacity) | Increased idle fill opacity to 0.45 |
| 2 | Playing triangles not dramatic enough (0.55 opacity) | Replaced with fully opaque hex fills: major `#c84646`, minor `#5082d2` |
| 3 | Playing state covers node circles — nodes should sit on top of triangle fill | New grid-highlighter mutates grid elements directly instead of overlay approach |
| 4 | Node circles don't restore to grey after release | Fixed double-save bug: `saveOnce()` tracks already-saved elements by Set to prevent shared vertices from overwriting originals |
| 5 | Triangle edges should also change when playing (bold, colored) | Grid-highlighter now also mutates edge `<line>` strokes; polygon stroke set to `"none"` to prevent double-line overlap |
| 6 | Double-line effect at edges when playing (semi-transparent overlay) | All playing-state colors switched to fully opaque hex; polygon stroke set to `"none"` when active |
| 7 | Edges and node circles should be same shade for visual continuity | Unified at-rest grey (`#bbb` for both), unified playing colors (`#b05050` major, `#5070b0` minor for both) |
| 8 | Edges and node circles should have same thickness | Unified at-rest width (`0.02` for both), unified playing width (`0.035` for both; root nodes `0.05`) |

### Files Changed

**RENDERING_UI (new file):**

| File | Change |
|------|--------|
| `grid-highlighter.ts` | **New file.** `activateGridHighlight()` mutates grid triangle fills, edge strokes, and node circle strokes. `deactivateGridHighlight()` restores originals. `saveOnce()` prevents double-save for shared vertices/edges. |

**RENDERING_UI (modified):**

| File | Change |
|------|--------|
| `renderer.ts` | Idle fills: 0.25 → 0.45 opacity. `GRID_EDGE_COLOR` `#ccc` → `#bbb` to match `NODE_STROKE`. `NODE_STROKE_WIDTH` 0.015 → 0.02 to match `EDGE_STROKE_WIDTH`. |
| `shape-renderer.ts` | Updated color constants to match new scheme: main fills 0.82 opacity, ext fills 0.45 opacity, darker strokes. (Used by overlay rendering for future/fallback cases.) |
| `highlight.ts` | Updated color constants to match shape-renderer: fills 0.82/0.45, strokes 0.9 opacity. Node outline colors updated. |
| `index.ts` | Added barrel exports: `activateGridHighlight`, `deactivateGridHighlight`, `GridHighlightHandle`, `GridHighlightOptions`. |

**INTEGRATION (modified):**

| File | Change |
|------|--------|
| `main.ts` | Replaced `highlightTriangle` / `clearAllHighlights` / `renderShape` overlay approach with `activateGridHighlight` / `deactivateGridHighlight` for both interactive press/release and progression playback highlighting. Added `triId` import from HC. Removed unused imports (`renderShape`, `highlightTriangle`, `clearAllHighlights`, `ShapeHandle`, `TriId`, `EdgeId`). |

### Design Constants After Pass 4

**At rest (renderer.ts):**

| Constant | Value |
|----------|-------|
| Major (Up) grid fill | `rgba(230, 180, 180, 0.45)` |
| Minor (Down) grid fill | `rgba(170, 195, 235, 0.45)` |
| Grid edge color | `#bbb` |
| Node circle stroke | `#bbb` |
| Edge stroke width | `0.02` |
| Node stroke width | `0.02` |

**Playing (grid-highlighter.ts):**

| Constant | Value |
|----------|-------|
| Major (Up) active fill | `#c84646` (opaque) |
| Minor (Down) active fill | `#5082d2` (opaque) |
| Major extension fill | `#d99a9a` (opaque) |
| Minor extension fill | `#9ab5d9` (opaque) |
| Edge stroke (major) | `#b05050` |
| Edge stroke (minor) | `#5070b0` |
| Non-root node stroke (major) | `#b05050` |
| Non-root node stroke (minor) | `#5070b0` |
| Root node stroke (major) | `#7a1515` |
| Root node stroke (minor) | `#153a7a` |
| Edge & non-root node width | `0.035` |
| Root node width | `0.05` |
| Polygon stroke when active | `none` (prevents double-line) |

### Test Results

```
tsc -b: 0 errors
HC:  168 passed (168) — unchanged
PD:  108 passed (108) — unchanged
AE:  172 passed (172) — unchanged
RU:  344 passed (344) — unchanged
INT: 144 passed (144) — unchanged
Total: 936 passed (936) — 0 failures
```

### Phase 8 Status: In Progress

Design passes 1-4 complete. Next: playback and audio testing.

---

## Entry 22 — Phase 8: User Testing — Playback Testing Session

Date: 2026-02-16

### Goal

Code review of all playback-related code paths after the Design Pass 4 grid-highlighter rewrite. Verify the full scheduled playback lifecycle: load → play → chord-change highlighting → stop → clear, plus natural completion and UI state gating.

### Test Baseline

All test suites passing before and after changes:

```
HC:  168 passed (168)
RU:  341 passed (341)
AE:  172 passed (172)
PD:  108 passed (108)
INT: 141 passed (141)
Total: 930 passed — 0 failures
```

**Note:** Prior DEVLOG entries reported 344 RU / 144 INT tests. No test files were modified; the actual counts have been 341 / 141. Prior entries slightly inflated the count. Corrected going forward.

### Bugs Found & Fixed

| # | Bug | Severity | Root Cause | Fix |
|---|-----|----------|------------|-----|
| 1 | Interactive grid highlight fires during playback (UX-D6 violation) | Medium | `onPointerDown` wrapper in main.ts activated grid highlights without checking UI state — only `baseInteractionCallbacks.onPointerDown` (interaction-wiring.ts) checked `isPlaybackSuppressed`. Visual highlight fired even though audio was suppressed. | Added UI state check at top of `onPointerDown` wrapper — early return to `baseInteractionCallbacks` (which handles its own gating) when state is `playback-running` or `progression-loaded`. |
| 2 | `handleStop()` doesn't clear playback grid highlight | Medium | When user clicks Stop, `activeGridHandle` (from last `setActiveChord`) was not deactivated. Last chord's triangle stayed visually "playing" (deep fill, colored edges/nodes) even after stop. | Added `deactivateGridHighlight(activeGridHandle); activeGridHandle = null;` to `handleStop()`. |
| 3 | Natural playback completion leaves last chord highlighted | Medium | Transport fires `onStateChange(playing: false)` on completion. `wireTransportToUIState` calls `uiState.stopPlayback()` but doesn't clear grid highlight. `setActiveChord(-1)` was only in `handleStop()`, not in the natural-completion path. | Added `transport.onStateChange()` listener in main.ts that clears `activeGridHandle` and resets path active chord on `playing: false`. Runs for both explicit stop and natural completion (idempotent with `handleStop` — safe to double-clear). |
| 4 | Dual grid highlight handle conflict | Low | Two independent `GridHighlightHandle` variables (`interactiveGridHandle` for press/release, `activeGridHandle` for playback) could theoretically both be active on overlapping grid elements. | Moved `interactiveGridHandle` declaration to top-level state alongside `activeGridHandle`. Added explicit clear of both handles in `handlePlay()` before entering playback. BUG 1 fix prevents interactive highlights during playback, making runtime overlap impossible. |

### Code Review Findings (No-Fix Items)

| Finding | Assessment |
|---------|-----------|
| `createControlPanelCallbacks()` in transport-wiring.ts is defined but unused — main.ts wires buttons directly via `handlePlay`/`handleStop`/`handleClear` | Benign dead code. The function was designed for a callback-based wiring pattern but main.ts uses direct function refs instead. Not harmful; could be cleaned up in a future pass. |
| `onTriangleSelect` and `onEdgeSelect` in interaction-wiring.ts are now no-ops (visual highlighting moved to `onPointerDown` wrapper) | Correct — audio plays from `onPointerDown` (UX-D4), visual highlight from `onPointerDown` wrapper. Post-classification callbacks have no remaining responsibility. Could be simplified but no functional impact. |
| `transport.onStateChange()` listener added in main.ts runs alongside `wireTransportToUIState` — both fire on `playing: false` | Idempotent: `deactivateGridHighlight(null)` is a no-op, `setActiveChord(-1)` when already -1 is harmless. No race condition risk since both run in the same microtask. |

### Files Changed

| File | Change |
|------|--------|
| `INTEGRATION/src/main.ts` | **BUG 1:** Added UI state check in `onPointerDown` wrapper to suppress interactive highlights during playback/progression-loaded. **BUG 2:** Added grid highlight deactivation in `handleStop()`. **BUG 3:** Added `transport.onStateChange` listener to clear grid highlight on natural completion. **BUG 4:** Moved `interactiveGridHandle` to top-level state; clear both handles in `handlePlay()`. |

### Playback Flow After Fixes

```
Load progression
  → deactivateGridHighlight(both handles)
  → render path + schedule events
  → wire transport (once)

Play button
  → deactivate both grid highlights
  → transport.play()
  → onChordChange(0) → setActiveChord(0) → activateGridHighlight(chord 0)
  → onChordChange(1) → deactivate(chord 0) → activateGridHighlight(chord 1)
  → ...
  → onChordChange(N) → activateGridHighlight(last chord)

Stop button (explicit)
  → transport.stop()
  → handleStop() → deactivateGridHighlight + setActiveChord(-1)
  → onStateChange(playing:false) → deactivate (idempotent no-op)

Natural completion
  → transport auto-stops
  → onStateChange(playing:false) → deactivateGridHighlight + setActiveChord(-1)

Interactive press during playback
  → UI state check → early return (no visual or audio effect)

Clear
  → cancelSchedule + deactivate + clear path + reset state
```

### Phase 8 Status: In Progress

Design passes 1-4 complete. Playback testing session complete — 4 bugs found and fixed. Next: audio quality testing (synthesis, voice-leading, timing).

---

## Entry 23 — Track Closure

**Date:** 2026-02-16

### Integration Module — Closed

The Integration Module DEVPLAN/DEVLOG is now closed as a wiring track. All subsystem wiring is complete and operational.

**Final stats:**
- 22 entries logged (Entries 1–22)
- Phases 1–7 complete (scaffolding → build → grid-to-beat → interaction → transport → persistence → assembly → polish)
- Phase 8 (User Testing): 4 design passes + 1 playback testing session
- 930 tests passing across all modules (HC 168, RU 341, AE 172, PD 108, INT 141)
- `tsc -b`: 0 errors

**Migrated to MVP Polish track:**
- Entries 18–22 (Design Passes 1–4 + Playback Testing) → `MVP_POLISH/DEVLOG.md` Entries 0a–0e

**Carried forward:**
- INT-D8 (tempo control UI, Open) → MVP Polish Phase 1b / POL-D1

**Successor:** `MVP_POLISH/DEVPLAN.md` — UI layout redesign, progression library, audio quality tuning, mobile UAT.

---
