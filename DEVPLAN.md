# DEVPLAN — Integration Module (Orchestrator)

Module: Integration Module
Version: 0.2
Date: 2026-02-15
Architecture reference: SPEC.md §Integration Module

---

## Cold Start Summary

**What this is:**
Top-level orchestrator for the Tonnetz Interactive Harmonic Explorer. Wires all four subsystems (Harmony Core, Rendering/UI, Audio Engine, Persistence/Data) into a functioning application. No subsystem imports from this module — it is the sole location where cross-subsystem dependencies are resolved. The output is a single `main.ts` entry point that produces the running MVP web app.

**Key constraints:**
- Imports from all four subsystems; no subsystem imports from integration module (SPEC §Dependency Direction)
- Audio initialization deferred to first user gesture (browser autoplay policy)
- Grid-to-beat conversion lives here — PD stores grid notation, AE schedules in beats (SPEC §Grid-to-Beat Bridging)
- UI state enforcement lives here — AE is stateless w.r.t. UI state (ARCH_AUDIO_ENGINE §4, UX-D6)
- Chord symbol parsing on load — PD stores verbatim strings, HC parses them (ARCH_PERSISTENCE_DATA §7)
- Browser entry point — must produce a bundled `dist/` for static deployment (ARCH_DEPLOYMENT_HOSTING §4)
- Startup sequence is ordered: settings → rendering → audio (deferred) → apply settings → URL check → wire callbacks → ready (SPEC §Startup Sequence)

**Gotchas:**
- `initAudio()` returns `Promise<AudioTransport>` — resolves to suspended context if called before user gesture — must use lazy-init pattern on first `onPointerDown`
- `onPointerDown` fires with `WorldPoint` before tap/drag classification — integration must hit-test here for immediate audio per UX-D4
- `InteractionCallbacks` fire with pitch classes, not Shapes — integration wires directly to `playPitchClasses()` (AE-D9)
- `playPitchClasses()` during `Playback Running` state must be suppressed — integration checks UIState (UX-D6)
- `UIStateController.selectChord()` silently rejects calls from both `progression-loaded` and `playback-running` — integration suppresses audio in both states to match (INT-D6 Closed: Option A)
- `getEdgeUnionPcs()` returns `null` for boundary edges — must null-guard before passing to AE
- `shape.covered_pcs` is a `Set<number>` — AE's `playShape()` handles the spread internally
- PD `grid` string (`"1/4"`) → beat value (`1`) conversion is not bidirectional — we parse once at load time
- `shapesToChordEvents()` takes a single scalar `beatsPerChord` — cannot express variable per-chord durations; integration builds `ChordEvent[]` manually after collapsing repeated chords (see INT-D5)
- ControlPanel has no tempo input element — SPEC mentions "ControlPanel tempo input → setTempo(bpm)" but RU source has no such element (see INT-D8)
- ControlPanel has no Pause button — `AudioTransport.pause()` is unused in MVP (consistent with UX spec §2 which lists Play/Stop/Loop but not Pause)
- Deployment/Hosting is documentation-only for now (ARCH_DEPLOYMENT_HOSTING); build config is set up here

---

## Current Status

**Phase:** 7c — Optional Polish (Complete)
**Focus:** All phases complete. MVP integration module done.
**Blocked/Broken:** INT-D8 (tempo control UI) deferred to UI testing phase — not blocking implementation

---

## Subsystem Readiness

All items from SPEC §Integration Readiness Checklist are verified ✅.

| Subsystem | Tests | Status | Key APIs Consumed |
|-----------|-------|--------|-------------------|
| Harmony Core | 168 | ✅ Complete | `parseChordSymbol`, `mapProgressionToShapes`, `buildWindowIndices`, `getTrianglePcs`, `getEdgeUnionPcs` |
| Rendering/UI | 344 | ✅ Complete | `createSvgScaffold`, `renderGrid`, `createCameraController`, `createInteractionController`, `renderShape`, `renderProgressionPath`, `highlightShape`, `createUIStateController`, `createControlPanel`, `createToolbar`, `createLayoutManager`, `hitTest`, `computeProximityRadius` |
| Audio Engine | 172 | ✅ Complete | `initAudio`, `createImmediatePlayback`, `playPitchClasses`, `stopAll`, `shapesToChordEvents` (uniform duration only), `AudioTransport` (14 methods) |
| Persistence/Data | 108 | ✅ Complete | `loadSettings`, `saveSettings`, `saveProgression`, `loadProgression`, `listProgressions`, `deleteProgression`, `encodeShareUrl`, `decodeShareUrl`, `createLocalStorageBackend` |

Total subsystem tests: **792**

---

## Architecture Overview

### Dependency Graph

```
                    ┌──────────────────────┐
                    │  Integration Module   │
                    │     (main.ts)         │
                    └──┬────┬────┬────┬────┘
                       │    │    │    │
            ┌──────────┘    │    │    └──────────┐
            ▼               ▼    ▼               ▼
      ┌──────────┐  ┌──────────┐ ┌──────────┐  ┌──────────┐
      │ Harmony  │  │Rendering │ │  Audio   │  │Persistence│
      │  Core    │  │   /UI    │ │  Engine  │  │  /Data    │
      └──────────┘  └────┬─────┘ └────┬─────┘  └──────────┘
                         │            │
                         └─── HC types ───┘
```

### Module Boundary

| File | Responsibility |
|------|---------------|
| `src/main.ts` | Entry point, startup sequence, orchestration, `destroyApp()` teardown |
| `src/grid-to-beats.ts` | Grid notation → beat duration conversion (SPEC §Grid-to-Beat Bridging) |
| `src/progression-pipeline.ts` | Text input parsing, PD record → HC parse → Shape[] → ChordEvent[] pipeline |
| `src/interaction-wiring.ts` | `onPointerDown` hit-test → immediate audio, InteractionCallbacks → AE playback, UI state gating, lazy audio init |
| `src/transport-wiring.ts` | AudioTransport events → RU animation/highlighting/UI state |
| `src/persistence-wiring.ts` | StorageBackend creation, ControlPanel actions → PD save/load/share, startup URL detection |
| `index.html` | HTML shell with root container element |

### Data Flow Summary

```
User gesture (pointer down)
  │
  ├─ First ever? ──→ ensureAudio() → initAudio() [lazy, async]
  │
  ├─ Playback Running? ──→ suppress (UX-D6)
  │
  ├─ onPointerDown ──→ hit-test at WorldPoint (UX-D4: immediate audio)
  │    ├─ HitTriangle → getTrianglePcs() → playPitchClasses()
  │    ├─ HitEdge → getEdgeUnionPcs() → null guard → playPitchClasses()
  │    └─ HitNone → no audio (background)
  │
  ├─ onTriangleSelect (post-classification) → UIState.selectChord() + highlight
  ├─ onEdgeSelect (post-classification) → UIState.selectChord() + highlight
  ├─ onDragScrub → playPitchClasses() on triangle change
  └─ onPointerUp → stopAll()

Progression paste/load
  │
  ControlPanel.onLoadProgression(text)
    → parseProgressionInput(text) → string[]
    → collapseRepeatedChords() → [{symbol, count}]
    → HC parseChordSymbol() each (collect errors)
    → HC mapProgressionToShapes(chords, focus, indices) → Shape[]
    → build ChordEvent[] manually (count × gridBeats durations)
    → RU renderProgressionPath(shapes)
    → AudioTransport.scheduleProgression(events)
    → UIState.loadProgression(shapes)
    → ControlPanel.setProgressionLoaded(true)

Play button → AudioTransport.play()
  → UIState.startPlayback()
  → onChordChange → PathHandle.setActiveChord(index)
  → onStateChange(playing:false) → UIState.stopPlayback()
```

---

## Phase Breakdown

### Phase 1: Project Scaffolding & Build Config

**Objective:** Buildable project with all four subsystem dependencies, TypeScript, Vitest, and bundler producing `dist/index.html` + hashed JS bundles.

#### 1a: Project scaffolding
- `package.json` — name `tonnetz-app`, deps on all four subsystems via `file:../` links
- `tsconfig.json` — ES2022, bundler resolution, strict, consistent with subsystem configs
- `vitest.config.ts`
- `src/index.ts` — barrel (initially empty)
- `src/__tests__/smoke.test.ts` — all four subsystems import successfully

**Tests (1a):**
- [ ] Vitest runs and passes
- [ ] TypeScript compiles with no errors
- [ ] Imports from all four subsystems resolve without error

#### 1b: Build configuration
- Vite setup (INT-D1 Closed)
- `index.html` — HTML shell with `<div id="app">` and `<script type="module">`
- `vite.config.ts` — single-page app, asset hashing
- `npm run build` → `dist/` with `index.html` + hashed bundles

**Tests (1b):**
- [ ] `npm run dev` starts dev server without error
- [ ] `npm run build` produces `dist/` with `index.html` and `.js` bundles
- [ ] Built HTML references hashed asset paths

---

### Phase 2: Grid-to-Beat Bridging & Progression Pipeline

**Objective:** Bridge PD's grid-based time model to AE's beat-based scheduling, implement progression text parsing, and build the full progression load pipeline.

#### 2a: Grid-to-beat conversion (`src/grid-to-beats.ts`)
- `gridToBeatsPerChord(grid: GridValue): number` — converts grid denominator to beats
  - Assumes a 4-beat bar: `beatsPerChord = 4 / denominator`
  - `"1/4"` → 1, `"1/8"` → 0.5, `"1/3"` → 4/3 ≈ 1.333, `"1/6"` → 2/3 ≈ 0.667
- `collapseRepeatedChords(chords: string[]): Array<{ symbol: string; count: number }>` — consecutive identical symbols merged with repeat count

**Tests (2a):**
- [ ] All four `GridValue` strings produce correct beat values
- [ ] `"1/3"` → 4/3 beats (triplet bar subdivision — 4-beat bar ÷ 3)
- [ ] `"1/6"` → 2/3 beats (triplet eighth — 4-beat bar ÷ 6)
- [ ] Repeated chords collapse: `["Dm7","Dm7","G7","Cmaj7","Cmaj7"]` → `[{Dm7,2},{G7,1},{Cmaj7,2}]`
- [ ] No consecutive repeats: pass-through unchanged
- [ ] Empty array → empty array

#### 2b: Progression text parsing (`src/progression-pipeline.ts`)
- `parseProgressionInput(text: string): string[]` — split raw text into chord symbol tokens
  - Delimiter: pipe `|` or whitespace (both supported); trim each; reject empty tokens (INT-D7)
  - `"Dm7 | G7 | Cmaj7"` → `["Dm7", "G7", "Cmaj7"]`
  - `"Dm7 G7 Cmaj7"` → `["Dm7", "G7", "Cmaj7"]`

**Tests (2b):**
- [ ] Pipe-delimited input → correct array
- [ ] Space-delimited input → correct array
- [ ] Mixed delimiters → correct array
- [ ] Extra whitespace and empty tokens stripped
- [ ] Empty string → empty array

#### 2c: Progression load pipeline (`src/progression-pipeline.ts`)
- `loadProgressionPipeline(args): { shapes, events } | { error, failedSymbols }`
  - Args: `{ chords: string[], grid: GridValue, focus: CentroidCoord, indices: WindowIndices }`
  - Steps:
    1. `collapseRepeatedChords(chords)` → collapsed `[{symbol, count}]`
    2. `HC.parseChordSymbol(symbol)` each → collect failures as `failedSymbols: string[]`
    3. `HC.mapProgressionToShapes(parsedChords, focus, indices)` → `Shape[]`
    4. Build `ChordEvent[]` manually — accumulate `startBeat` from each chord's `count × gridToBeatsPerChord(grid)` (INT-D5: does **not** use `AE.shapesToChordEvents()` because it only supports uniform duration)
  - Returns `{ error: string; failedSymbols: string[] }` if any symbol fails

**Tests (2c):**
- [ ] Valid ii–V–I → shapes + events with correct beat timing
- [ ] Grid `"1/4"`, no repeats: each chord = 1 beat, startBeats = [0, 1, 2]
- [ ] Repeated chords produce longer durations: `["Dm7","Dm7","G7"]` at `"1/4"` → events with durations [2, 1], startBeats [0, 2]
- [ ] Invalid chord symbol → error result with `failedSymbols` identifying bad symbol(s)
- [ ] Empty chords array → empty shapes + events (not error)
- [ ] Shape object identity preserved through pipeline

---

### Phase 3: Interaction Wiring (Audio + UI State)

**Objective:** Wire RU interaction callbacks to AE immediate playback with lazy audio init, `onPointerDown` → immediate audio (UX-D4), and UI state gating (UX-D6).

#### 3a: Lazy audio initialization (`src/interaction-wiring.ts`)
- `createAppAudioState()` → mutable holder for `AudioTransport | null` + `ImmediatePlaybackState | null`
- `ensureAudio(state): Promise<{ transport, immediatePlayback }>` — lazy-inits on first call; caches

**Tests (3a):**
- [ ] `ensureAudio()` creates AudioTransport on first call
- [ ] Second call returns same instance (no double-init)
- [ ] Audio state is null before first call

#### 3b: `onPointerDown` immediate audio (UX-D4)
- On `onPointerDown(world)`:
  1. Check UIState — suppress if `"playback-running"` or `"progression-loaded"` (UX-D6 + INT-D6)
  3. `ensureAudio()` (lazy init on first gesture)
  4. Hit-test at `world` using `hitTest(world.x, world.y, radius, indices)`
  5. `HitTriangle` → `getTrianglePcs(ref)` → `playPitchClasses(state, pcs)`
  6. `HitEdge` → `getEdgeUnionPcs(edgeId, indices)` → null guard → `playPitchClasses(state, pcs)`
  7. `HitNone` → no audio
- Requires integration to hold refs to `getIndices()` and proximity radius (same as `InteractionController`)

**Tests (3b):**
- [ ] Pointer down on triangle → `playPitchClasses` called immediately
- [ ] Pointer down on edge → `playPitchClasses` called with 4 pcs
- [ ] Pointer down on background → no audio
- [ ] Pointer down during `"playback-running"` → suppressed
- [ ] First pointer down triggers lazy audio init

#### 3c: Interaction post-classification wiring
- `onTriangleSelect(triId, pcs)` → `UIState.selectChord(shape)` + `highlightTriangle()` (audio already playing from 3b)
- `onEdgeSelect(edgeId, triIds, pcs)` → `UIState.selectChord(shape)` + `highlightShape()` (audio already playing from 3b)
- `onDragScrub(triId, pcs)` → `playPitchClasses(state, pcs)` (retrigger on triangle change)
- `onPointerUp()` → `stopAll(state)`
- UI state gating: all callbacks suppressed when `"playback-running"` (UX-D6)
- Note: `UIStateController.selectChord()` silently rejects from `progression-loaded` — integration follows the state machine's lead for visual selection

**Tests (3c):**
- [ ] Triangle select → `UIState.selectChord()` called
- [ ] Edge select → `UIState.selectChord()` called
- [ ] Drag scrub → `playPitchClasses` on triangle change
- [ ] Pointer up → `stopAll`
- [ ] All callbacks suppressed when `"playback-running"`
- [ ] `"idle"` and `"chord-selected"`: audio plays + visual selection updates
- [ ] `"progression-loaded"`: audio and visual selection suppressed (INT-D6)

---

### Phase 4: Transport Wiring (Scheduled Playback + Animation)

**Objective:** Wire AudioTransport events to RU highlighting/animation and ControlPanel buttons to transport controls.

#### 4a: Transport → rendering (`src/transport-wiring.ts`)
- `wireTransportToPath(transport, pathHandle)` → `onChordChange` → `pathHandle.setActiveChord(index)`
- `wireTransportToUIState(transport, uiState)` → `onStateChange` → `startPlayback()` / `stopPlayback()`
- `wireTransportToControlPanel(transport, controlPanel)` → `onStateChange` → `setPlaybackRunning(playing)`
- Returns composite unsubscribe function

**Tests (4a):**
- [ ] `onChordChange` → `setActiveChord` called with correct index
- [ ] `onStateChange(playing:true)` → `uiState.startPlayback()`
- [ ] `onStateChange(playing:false)` → `uiState.stopPlayback()`
- [ ] `onStateChange` → `controlPanel.setPlaybackRunning()` updated
- [ ] Unsubscribe removes all listeners
- [ ] Natural completion (AE-D10) transitions UI to `"progression-loaded"`

#### 4b: ControlPanel → transport
- Play → `transport.play()`
- Stop → `transport.stop()`
- Clear → `transport.cancelSchedule()` + `uiState.clearProgression()` + clear rendered path + `controlPanel.setProgressionLoaded(false)`
- **Pause:** `AudioTransport.pause()` exists but is not wired in MVP. ControlPanel has Play/Stop/Clear only (confirmed in RU source). Pause available for future UI extension.
- **Tempo:** ControlPanel has no tempo input element. See INT-D8 for resolution.

**Tests (4b):**
- [ ] Play button → `transport.play()` called
- [ ] Stop button → `transport.stop()` called
- [ ] Clear button → cancel + UI reset + path cleared + panel updated

---

### Phase 5: Persistence Wiring (Save/Load/Share)

**Objective:** Wire PD APIs to UI for progression management, URL sharing, and startup settings.

#### 5a: Storage initialization + startup settings (`src/persistence-wiring.ts`)
- Create `StorageBackend` via `PD.createLocalStorageBackend()` — held at module scope
- `loadStartupSettings(backend): SettingsRecord` → `PD.loadSettings(backend)`
- Apply `tempo_bpm` to transport once audio is initialized (deferred)
- Check `location.hash` for `#p=...`: `PD.decodeShareUrl(hashContent)` → feed to progression pipeline
- Handle decode errors gracefully (log warning, continue to idle)

**Tests (5a):**
- [ ] `createLocalStorageBackend()` called once at startup
- [ ] Settings loaded → tempo applied to transport
- [ ] URL with `#p=Dm7-G7-Cmaj7&t=120&g=4&v=1` → progression auto-loaded
- [ ] Invalid URL hash → warning logged, idle state
- [ ] No hash → idle state

#### 5b: Save/Load/Share actions
- Save → `PD.saveProgression(backend, record)` with current chords, tempo, grid
- Load → `PD.loadProgression(backend, id)` → feed to progression pipeline
- Share → `PD.encodeShareUrl(record)` → set `location.hash` or copy to clipboard
- Settings persist on tempo change: `PD.saveSettings(backend, { tempo_bpm })`

**Tests (5b):**
- [ ] Save → `PD.saveProgression` called with correct record
- [ ] Load → progression pipeline receives correct chords
- [ ] Share → `encodeShareUrl` produces valid hash, assigned to URL
- [ ] Settings round-trip: change tempo → save → reload page → same tempo

---

### Phase 6: Application Assembly (main.ts)

**Objective:** Wire all phases together into the startup sequence per SPEC §Startup Sequence.

#### 6a: Startup sequence (`src/main.ts`)
1. **Create StorageBackend** — `PD.createLocalStorageBackend()`
2. **Load settings** — `PD.loadSettings(backend)`
3. **Init Rendering/UI** — scaffold SVG, camera, layout, grid, control panel, toolbar, UI state controller
4. **Init Audio (deferred)** — create `AppAudioState` (null until first gesture via `ensureAudio()`)
5. **Apply settings** — apply `tempo_bpm` (deferred to audio init)
6. **Check URL hash** — if `#p=...`: decode → parse → load pipeline → render path + schedule
7. **Wire callbacks** — interaction (Phase 3), transport (Phase 4), persistence (Phase 5)
8. **Ready** — UI in idle or progression-loaded state

#### 6b: `destroyApp()` teardown
- Collect all handles during startup: interaction controller, camera controller, control panel, toolbar, UI state controller, transport event unsubscribers, layout manager
- `destroyApp()` calls `.destroy()` on each + removes DOM elements
- Not critical for MVP single-page (never unmounts), but prevents refactor cost if app is later embedded in SPA or mobile wrapper

**Tests (6a/6b):**
- [ ] App initializes without error in JSDOM
- [ ] UI enters idle state after startup (no URL hash)
- [ ] URL hash present → progression-loaded state after startup
- [ ] `destroyApp()` cleans up all listeners and DOM elements
- [ ] No double-init on repeated startup calls

---

### Phase 7: Polish & Review

**Objective:** End-to-end manual verification, optimization, code cleanup, documentation alignment.

#### 7a: Integration tests
- Full pipeline: paste progression text → load → play → stop → clear
- Interactive: tap triangle → hear triad → pointer up → silence
- Edge selection: tap near shared edge → hear 4-note chord
- URL sharing round-trip: load → share → open in new tab → same progression

#### 7b: Code review
- Remove dead code
- Confirm no subsystem imports from integration (dependency direction)
- Verify all error paths (invalid chords, corrupt settings, bad URL hash)
- Documentation pass: remove redundancies in DEVPLAN, fix staleness

#### 7c: Optional polish (if time permits)
- Keyboard shortcuts (Escape = clear, Space = play/stop)
- Console logging for debug builds
- Performance: verify no unnecessary re-renders during playback

---

## Design Decisions

```
INT-D1: Bundler choice
Date: 2026-02-15
Status: Closed
Priority: Important
Decision: Vite
Rationale:
ESM-native dev server with HMR, zero-config TypeScript, asset hashing for
static deployment. Minimal config overhead. Vite uses Rollup internally for
production builds — well-tested bundling pipeline.
Trade-offs:
Slightly slower than raw esbuild for production builds. Irrelevant at this
project's scale.
Revisit if: Build times exceed 10s, or need SSR/advanced code-splitting.
```

```
INT-D2: Module location — root folder
Date: 2026-02-15
Status: Closed
Priority: Minor
Decision: Integration module lives in project root (not a subfolder like subsystems)
Rationale:
It is the application entry point and build target. Root placement makes
`vite.config.ts`, `index.html`, and `package.json` naturally discoverable.
Subsystems are referenced as `file:../SUBSYSTEM_NAME` dependencies.
Revisit if: Monorepo tooling is adopted (Nx, Turborepo).
```

```
INT-D3: Lazy audio initialization strategy
Date: 2026-02-15
Status: Closed
Priority: Critical
Decision:
`initAudio()` is deferred to the first `onPointerDown` callback via
`ensureAudio()`. Audio state (transport, immediate playback) is null
until then. All audio-consuming code paths guard on null.
Rationale:
Browser autoplay policy requires user gesture before AudioContext can
produce sound. `onPointerDown` is the earliest gesture event — any
earlier (e.g., page load) would result in a suspended context.
Trade-offs:
First interaction has a one-time async delay (~5–20ms for context creation).
Subsequent interactions are synchronous.
Revisit if: Browser APIs change to allow pre-gesture audio, or if the
async delay is perceptible on slow devices.
```

```
INT-D4: Grid-to-beat repeated chord collapsing
Date: 2026-02-15
Status: Closed
Priority: Important
Decision:
Consecutive identical chord symbols in PD's `chords[]` array are collapsed
into a single Shape with extended duration (count × gridBeats). The
integration module performs this collapsing before passing to HC's
`mapProgressionToShapes()`.
Rationale:
PD's data model encodes duration by repetition (PD-D2). HC and AE are
unaware of this convention. The integration module is the correct location
for this bridge logic.
Revisit if: PD adopts explicit per-chord duration fields.
```

```
INT-D5: Variable-duration ChordEvent construction
Date: 2026-02-15
Status: Closed
Priority: Important
Decision: Option A — build ChordEvent[] manually in progression-pipeline.ts.
Rationale:
AE.shapesToChordEvents() accepts only a single scalar beatsPerChord and
assigns uniform duration. After collapsing repeated chords (INT-D4), we
need variable per-chord durations. Manual construction is 3–5 lines of
startBeat accumulation — trivial and keeps AE's API stable. No cross-module
change required.
Trade-offs:
AE.shapesToChordEvents() becomes unused by the integration module (still
available for uniform-duration callers).
Revisit if: Multiple callers need variable-duration event construction —
at that point, extend AE's API to accept number | number[].
```

```
INT-D6: Interactive playback in progression-loaded state
Date: 2026-02-15
Status: Closed
Priority: Important
Decision: Option A — suppress audio in progression-loaded state.
Rationale:
UIStateController.selectChord() already silently rejects from
progression-loaded (no visual highlight). Allowing audio without visual
feedback creates a confusing mismatch. Suppressing both keeps behavior
consistent: user clears progression first, then explores interactively.
No module changes required.
Trade-offs:
Slightly restrictive — user cannot preview chords while a progression
is displayed. Acceptable for MVP.
Revisit if: User testing shows progression-loaded tap suppression is
frustrating — at that point consider Option C (add progression-loaded →
chord-selected transition to UIStateController).
```

```
INT-D7: Progression text input delimiter
Date: 2026-02-15
Status: Closed
Priority: Normal
Decision: Option C — accept both pipe | and whitespace as delimiters.
Rationale:
Most forgiving for users. Pipe matches lead-sheet convention; whitespace
is natural for quick entry. Slash chords ("C/E", future) are unaffected
since "/" is not a delimiter. Implementation: split on regex /[|\s]+/,
trim each token, reject empty tokens.
Trade-offs:
None significant. Both delimiters are unambiguous with current and planned
chord grammar.
Revisit if: Chord grammar expands to include symbols that contain spaces.
```

```
INT-D8: Tempo control UI element
Date: 2026-02-15
Status: Open
Priority: Normal
Decision: (deferred to UI testing phase)
Context:
SPEC §Cross-Module Wiring Points lists "ControlPanel tempo input →
AudioTransport.setTempo(bpm)". But ControlPanel (RU source) has no tempo
input element — only textarea, Load, Play, Stop, Clear buttons.
Options:
A) Add tempo <input type="number"> to ControlPanel — requires RU module change.
B) Add a standalone tempo input in main.ts outside ControlPanel — no RU change.
C) Defer tempo UI to post-MVP. Use PD's stored tempo_bpm (from shared URL
   or saved progression) and default 120 BPM otherwise. No runtime tempo change.
Trade-offs:
A: cleanest UX, but modifies a completed module.
B: quick, but tempo input lives outside the panel — inconsistent layout.
C: simplest, no UI work. Tempo is still set from PD records and URL payloads.
Note: Decision deferred — will be resolved during UI testing when element
positioning and layout can be evaluated visually. Not blocking implementation;
tempo is set from PD data in the interim.
```
