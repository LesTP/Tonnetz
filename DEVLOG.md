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
