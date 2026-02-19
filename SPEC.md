# SPEC.md — Tonnetz Interactive Harmonic Explorer

Version: Draft 0.5
Date: 2026-02-18

---

# Product Vision

## Problem Statement

Musicians understand harmonic relationships conceptually but lack intuitive tools that visualize harmonic motion spatially and interactively. Existing chord charts and theory diagrams do not effectively show voice-leading proximity, harmonic transformations, or progression geometry.

## Solution

Develop an interactive Tonnetz-based harmonic exploration application that allows users to:

* play chords directly from a Tonnetz grid
* visualize chord progressions as geometric paths
* hear smooth voice-led harmonic motion
* explore harmonic relationships spatially
* later: analyze harmonic corpora as graph structures

## Target User

* jazz and contemporary musicians
* composers and improvisers
* music theory students and educators
* music technology researchers

---

# Requirements

## Functional Requirements (MVP)

* interactive Tonnetz lattice
* triangle selection → triad playback
* edge-proximity selection → union chord playback (two adjacent triangles, 4 pitch classes; see UX-D1, UX-D2)
* paste chord progression → render path + playback
* supported chord types:

  * triads (maj, min, dim, aug)
  * 6, add9, 6/9
  * maj7, 7, m7
  * dim7, m7b5 (half-diminished)
* local progression save/load
* URL-based progression sharing

### MVP Chord Limitations

* diminished and augmented triads are represented as dot clusters (not triangles) on the lattice
* extended chords built on augmented triads (e.g., aug7, augMaj7) are excluded from MVP

---

## Non-Functional Requirements

* responsive desktop and mobile interaction
* modular subsystem architecture
* deterministic harmonic placement
* client-side operation (no accounts required)
* portability to mobile wrappers

---

# Design Specifications

## Technical Architecture

### Subsystem Structure

The system is divided into the following documents:

* SPEC.md (product-level specification)
* ARCH_HARMONY_CORE.md
* ARCH_RENDERING_UI.md
* ARCH_AUDIO_ENGINE.md
* ARCH_PERSISTENCE_DATA.md
* ARCH_DEPLOYMENT_HOSTING.md
* UX_SPEC.md

Subsystem responsibilities:

| Subsystem          | Responsibility                                                   |
| ------------------ | ---------------------------------------------------------------- |
| Harmony Core       | Tonnetz math, chord parsing, decomposition, progression modeling |
| Rendering/UI       | lattice rendering, interaction handling, animations              |
| Audio Engine       | chord voicing, synthesis, playback scheduling                    |
| Persistence/Data   | progression storage, import/export, URL sharing                  |
| Deployment/Hosting | build, hosting topology, caching/versioning                      |
| UX                 | detailed definitions for interaction behaviors                   |


### Development Governance Model

* System architecture is defined by SPEC and subsystem architecture documents.
* UX interaction design is defined in **UX_SPEC.md**, which acts as a cross-cutting design reference affecting multiple modules.
* UX decisions that affect subsystem interfaces are incorporated into architecture documents before module development begins.
* Interaction Architecture precedes module implementation and defines interaction vocabulary, layout zones, and interface contracts affecting multiple subsystems.
* After Interaction Architecture completion, subsystems are developed in **parallel module work tracks**, each maintaining:

  * a module-specific DEVPLAN
  * a module-specific DEVLOG
* SPEC, UX_SPEC, and architecture documents together form the **shared source of truth**.
* A **master integration track** coordinates subsystem integration milestones and manages interface-level changes across modules.

---

# Harmony Core API Overview

Harmony Core is the first completed subsystem. Other modules consume it through the public API exported from `HARMONY_CORE/src/index.ts`. Full signatures and implementation details are in ARCH_HARMONY_CORE.md Section 11.

## Coordinate System & ID Construction

| Function | Description |
|----------|-------------|
| `pc(u, v)` | Pitch class at lattice node (0–11) |
| `nodeId(u, v)` | Canonical node ID string |
| `parseNodeId(id)` | Parse node ID back to coordinates |
| `triId(tri)` | Canonical triangle ID string |
| `triVertices(tri)` | Three vertex coordinates of a triangle |
| `getTrianglePcs(tri)` | Three pitch classes of a triangle (sorted) |
| `edgeId(a, b)` | Canonical edge ID from two node coordinates |
| `parseEdgeId(id)` | Parse edge ID back to two node coordinates |

## Window Indexing

| Function | Description |
|----------|-------------|
| `buildWindowIndices(bounds)` | Precompute index maps for a rectangular lattice window |
| `getAdjacentTriangles(tri, indices)` | Edge-sharing neighbor triangles |
| `getEdgeUnionPcs(edgeId, indices)` | Union pitch classes of two triangles sharing an edge (4 pcs) |

## Chord Parsing

| Function | Description |
|----------|-------------|
| `parseChordSymbol(text)` | Text → structured chord (root, quality, extension) |
| `computeChordPcs(rootPc, quality, extension)` | Compute pitch-class sets from parsed components |

## Placement & Decomposition

| Function | Description |
|----------|-------------|
| `placeMainTriad(chord, focus, indices)` | Nearest-triangle placement relative to focus coordinate |
| `decomposeChordToShape(chord, mainTri, focus, indices)` | Full Shape with main triangle, extensions, dots, centroid |

## Progression Mapping

| Function | Description |
|----------|-------------|
| `mapProgressionToShapes(chords, initialFocus, indices)` | Chain-focus progression → sequence of Shapes |

## Key Types

| Type | Description |
|------|-------------|
| `NodeCoord` | Lattice coordinate pair `{ u, v }` — used for both integer node positions and fractional centroids |
| `CentroidCoord` | Alias for `NodeCoord` when used as a fractional centroid/focus coordinate |
| `NodeId` | Branded string ID for a node (`"N:u,v"`) |
| `TriId` | Branded string ID for a triangle (`"T:U:u,v"` or `"T:D:u,v"`) |
| `EdgeId` | Branded string ID for an edge (`"E:N:a,b\|N:c,d"`) |
| `Orientation` | Triangle orientation (`"U"` or `"D"`) |
| `TriRef` | Triangle reference (orientation + anchor coordinate) |
| `WindowBounds` | Rectangular lattice window bounds |
| `WindowIndices` | Precomputed index maps for active window |
| `Quality` | Chord quality (`"maj"`, `"min"`, `"dim"`, `"aug"`) |
| `Extension` | Chord extension (`"6"`, `"7"`, `"maj7"`, `"add9"`, `"6/9"`, `"dim7"`, `"m7b5"`) |
| `Chord` | Parsed chord structure with pitch-class sets |
| `Shape` | Decomposed chord on the lattice (triangles, dots, centroid, `root_vertex_index` nullable for dot-only shapes) |

See ARCH_HARMONY_CORE.md Section 11 for full type definitions and function signatures.

---

# Rendering/UI API Overview

Rendering/UI handles SVG rendering, interaction, and layout. Other modules consume it through the public API exported from `RENDERING_UI/src/index.ts`. Full signatures and implementation details are in ARCH_RENDERING_UI.md Section 11.

## Coordinate Transforms

| Function | Description |
|----------|-------------|
| `latticeToWorld(u, v)` | Lattice→world equilateral transform |
| `worldToLattice(x, y)` | World→lattice inverse transform |
| `screenToWorld(...)` | Screen pixel→world coordinate via viewBox |

## Camera & Viewport

| Function | Description |
|----------|-------------|
| `computeWindowBounds(cW, cH, minTriPx)` | Responsive window bounds |
| `computeInitialCamera(cW, cH, bounds)` | Fit-to-viewport camera state |
| `computeViewBox(camera, cW, cH, bounds)` | Camera state→SVG viewBox |
| `applyPan(camera, dx, dy, bounds?, clampFactor?)` | Pan with optional boundary clamping |
| `applyZoom(camera, factor, anchorX, anchorY)` | Zoom with anchor stability |
| `createCameraController(svg, cW, cH, bounds)` | Sole viewBox writer controller |

## SVG Rendering

| Function | Description |
|----------|-------------|
| `createSvgScaffold(container)` | Root SVG + 5-layer `<g>` scaffold |
| `renderGrid(layerGroup, indices)` | Static lattice grid rendering |
| `renderShape(layerChords, layerDots, shape, indices, options?)` | Render Shape to chord/dot layers |
| `renderProgressionPath(layerPath, shapes, options?)` | Render centroid-connected path |

## Interaction

| Function | Description |
|----------|-------------|
| `hitTest(worldX, worldY, radius, indices)` | Proximity-circle hit classification |
| `createGestureController(options)` | Tap/drag disambiguation |
| `createInteractionController(options)` | Orchestration: gesture→hit-test→selection events |

## Highlighting

| Function | Description |
|----------|-------------|
| `highlightTriangle(layer, triId, indices, style?)` | Highlight single triangle |
| `highlightShape(layer, shape, indices, style?)` | Highlight entire Shape |
| `clearHighlight(handle)` | Clear single highlight |
| `clearAllHighlights(layer)` | Clear all highlights from layer |

## UI Components

| Function | Description |
|----------|-------------|
| `createUIStateController()` | UI state machine (idle, chord-selected, progression-loaded, playback-running) |
| ~~`createLayoutManager(options)`~~ | ⚠️ Superseded by `createSidebar()` in Integration (POL-D1) |
| ~~`createControlPanel(options)`~~ | ⚠️ Superseded by `createSidebar()` in Integration (POL-D1) |
| ~~`createToolbar(options)`~~ | ⚠️ Superseded by `createSidebar()` in Integration (POL-D1) |

## Key Types

| Type | Description |
|------|-------------|
| `WorldPoint` | World coordinate `{ x, y }` |
| `LatticePoint` | Lattice coordinate `{ u, v }` |
| `CameraState` | Camera state `{ centerX, centerY, zoom }` |
| `ViewBox` | SVG viewBox `{ minX, minY, width, height }` |
| `HitResult` | Discriminated union: `HitTriangle \| HitEdge \| HitNone` |
| `ShapeHandle` | Handle for clearing rendered shapes |
| `PathHandle` | Handle for progression path (`clear`, `setActiveChord`, `getChordCount`) |
| `HighlightHandle` | Handle for clearing highlights |
| `UIState` | State union: `"idle" \| "chord-selected" \| "progression-loaded" \| "playback-running"` |
| `UIStateController` | Controller interface with state transitions and event subscription |
| ~~`LayoutManager`~~ | Superseded — see `createSidebar()` in Integration (POL-D1) |
| ~~`ControlPanel`~~ | Superseded — see `createSidebar()` in Integration (POL-D1) |
| ~~`Toolbar`~~ | Superseded — see `createSidebar()` in Integration (POL-D1) |

See ARCH_RENDERING_UI.md Section 11 for full type definitions and function signatures.

---

# Audio Engine API Overview

Audio Engine handles chord voicing, Web Audio synthesis, and playback scheduling. Other modules consume it through the public API exported from `AUDIO_ENGINE/src/index.ts`. Full signatures and implementation details are in ARCH_AUDIO_ENGINE.md Sections 3, 5b, and 6.

## Initialization

| Function | Description |
|----------|-------------|
| `initAudio(options?)` | Create AudioContext (with autoplay resume) → returns `AudioTransport` |
| `createImmediatePlayback(transport)` | Create immediate playback state (master gain + voice tracking) |

## Immediate Playback (ARCH §6.2)

| Function | Description |
|----------|-------------|
| `playPitchClasses(state, pcs, options?)` | Play pitch classes immediately (voice-led from previous voicing) |
| `playShape(state, shape, options?)` | Play Shape's `covered_pcs` immediately |
| `stopAll(state)` | Hard-stop all sounding voices, clear voicing state |

## Voicing (ARCH §3)

| Function | Description |
|----------|-------------|
| `nearestMidiNote(target, pc)` | MIDI note with pitch class `pc` closest to `target` |
| `voiceInRegister(pcs, register?)` | Place pitch classes around register (no voice-leading) |
| `voiceLead(prevVoicing, newPcs, register?)` | Greedy minimal-motion voice-leading (AE-D3) |

## Synthesis (AE-D2)

| Function | Description |
|----------|-------------|
| `createVoice(ctx, dest, midi, velocity?, when?)` | Create single voice (dual-oscillator pad signal chain) |
| `midiToFreq(midi)` | MIDI note number → frequency Hz (A4 = 440) |

## Scheduling (ARCH §5b)

| Function | Description |
|----------|-------------|
| `beatsToSeconds(beats, bpm)` | Convert beats to seconds at tempo |
| `secondsToBeats(seconds, bpm)` | Convert seconds to beats at tempo |
| `shapesToChordEvents(shapes, beatsPerChord?)` | Convert `Shape[]` → `ChordEvent[]` (sequential, equal duration) |

## AudioTransport (14 methods — ARCH §6.1)

| Group | Methods |
|-------|---------|
| Time queries | `getTime()`, `getContext()` |
| State queries | `getState()`, `isPlaying()`, `getTempo()`, `getCurrentChordIndex()` |
| Playback control | `setTempo(bpm)`, `scheduleProgression(events)`, `play()`, `stop()`, `pause()`, `cancelSchedule()` |
| Event subscriptions | `onStateChange(cb)`, `onChordChange(cb)` |

## Key Types

| Type | Description |
|------|-------------|
| `AudioTransport` | 14-method cross-module transport contract |
| `TransportState` | Snapshot: `{ playing, tempo, currentChordIndex, totalChords }` |
| `ChordEvent` | Scheduled chord: `{ shape, startBeat, durationBeats }` |
| `PlaybackStateChange` | Event payload: `{ playing, timestamp }` |
| `ChordChangeEvent` | Event payload: `{ chordIndex, shape, timestamp }` |
| `ImmediatePlaybackState` | Opaque state for immediate playback (master gain, voices, voicing) |
| `PlayOptions` | Options: `{ register?, velocity?, duration? }` |
| `InitAudioOptions` | Options: `{ AudioContextClass?, initialTempo? }` |
| `VoiceHandle` | Per-voice handle: `{ midi, release(when?), stop() }` |

See ARCH_AUDIO_ENGINE.md Sections 3, 5b, and 6 for full type definitions, algorithm details, and usage patterns.

---

# Integration Module

The integration module is the top-level orchestrator that wires subsystem APIs together. It is built after individual modules are complete and imports from all subsystems without any subsystem depending on it.

## Responsibilities

* Initialize Audio Engine (`initAudio()`, `createImmediatePlayback()`)
* Initialize Rendering/UI (scaffold, camera, interaction controller)
* Build sidebar layout (two-tab Play/Library panel, responsive hamburger overlay)
* Initialize Persistence/Data (load settings, detect URL-shared progression)
* Wire interaction events to audio playback
* Wire AudioTransport events to rendering animation
* Wire sidebar controls to transport (tempo, loop, play/stop/clear)
* Bridge PD grid notation to AE beat-based scheduling
* Enforce UI state constraints (e.g., suppress interactive playback during scheduled playback per UX-D6)

## Cross-Module Wiring Points

### Audio ↔ Rendering

| Direction | From → To | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| Interaction → Audio | RU → AE | `InteractionCallbacks` → `playPitchClasses(state, pcs)`, `stopAll(state)` | Interactive chord playback on tap/click (AE-D9) |
| Transport → Animation | AE → RU | `AudioTransport.onChordChange()` → `PathHandle.setActiveChord(index)` | Progression highlight sync |
| Transport → UI | AE → RU | `AudioTransport.onStateChange()` → sidebar state update | Play/stop button state |
| Transport → Animation | AE → RU | `AudioTransport.getTime()` in rAF loop | Smooth path progress animation |
| UI → Audio | RU → AE | Sidebar callbacks → `AudioTransport.play()` / `.stop()` | Transport control buttons |
| UI → Audio | RU → AE | Sidebar tempo slider → `AudioTransport.setTempo(bpm)` | Tempo control (POL-D1, resolves INT-D8) |

### Persistence ↔ Other Modules

| Direction | From → To | Mechanism | Purpose |
|-----------|-----------|-----------|---------|
| Startup → Settings | PD → AE + RU | `loadSettings()` → `setTempo(bpm)`, apply view prefs | Restore user preferences on page load |
| URL → Progression | PD → HC → RU + AE | `decodeShareUrl(hash)` → `parseChordSymbol()` each → `mapProgressionToShapes()` → `UIState.loadProgression()` | Auto-load shared progression from URL fragment |
| Load → Progression | PD → HC → RU + AE | `loadProgression(id)` → same parse pipeline | Load saved progression from local storage |
| Save ← UI | RU → PD | Sidebar save action → `saveProgression({ title, tempo_bpm, chords })` | Persist current progression locally |
| Share ← UI | RU → PD | Sidebar share action → `encodeShareUrl(prog)` → clipboard / URL bar | Generate shareable URL |
| Settings ← UI | RU → PD | Tempo change, view prefs → `saveSettings(partial)` | Persist user preferences |
| Duration → Beats | Integration | Each chord token = 4 beats (one bar). `shapesToChordEvents(shapes)` produces `ChordEvent[]` directly — no grid conversion needed (POL-D17). |

### Data Flow: Progression Load Pipeline

```
PD record { chords: ["Dm7","G7","Cmaj7"], tempo_bpm: 120 }
  │
  ├─→ HC: parseChordSymbol() each → Chord[]
  ├─→ HC: mapProgressionToShapes(chords, focus, indices) → Shape[]
  │
  ├─→ RU: UIState.loadProgression(shapes)
  ├─→ RU: renderProgressionPath(shapes)
  │
  ├─→ AE: setTempo(120)
  └─→ AE: shapesToChordEvents(shapes) → scheduleProgression(events)
```

## Dependency Direction

```
Integration Module
  ├── imports from: Harmony Core       (parsing, placement, types)
  ├── imports from: Rendering/UI       (scaffold, interaction, UI state)
  ├── imports from: Audio Engine       (transport, playback, scheduling)
  └── imports from: Persistence/Data   (save/load, URL encode/decode, settings)
```

No subsystem imports from the integration module. Subsystems do not import from each other except: AE and RU both import types from HC. The integration module is the sole location where cross-subsystem dependencies are resolved.

## Startup Sequence

The integration module owns the application startup sequence:

1. **Load settings** — `PD.loadSettings()` → retrieve persisted tempo, view preferences
2. **Init Audio Engine** — `initAudio()` (deferred until first user gesture per browser autoplay policy)
3. **Init Rendering/UI** — scaffold SVG, camera, interaction controller, layout, control panel
4. **Apply settings** — `setTempo(settings.tempo_bpm)`, apply saved view state to camera
5. **Check URL hash** — if `location.hash` contains `#p=...`:
   - `PD.decodeShareUrl(hash)` → progression record
   - Parse chords via HC → place shapes → load into UIState + render path
   - Schedule on transport (ready to play, not auto-playing)
6. **Wire callbacks** — bind interaction, transport, and persistence event handlers
7. **Ready** — UI in idle or progression-loaded state

Audio Engine initialization (step 2) may be deferred to first user interaction (tap/click) to comply with browser autoplay policies. The integration module handles this by lazy-initializing on the first `InteractionCallbacks.onPointerDown`.

## UI State Enforcement

Audio Engine is stateless with respect to UI state (see ARCH_AUDIO_ENGINE.md §4). The integration module checks `UIStateController` state before invoking Audio Engine APIs:

* **Idle / Chord Selected:** immediate playback permitted via `playPitchClasses()`
* **Playback Running:** interactive playback suppressed (UX-D6); only `AudioTransport` controls active
* **Progression Loaded:** ready for scheduled playback; interactive playback suppressed (INT-D6) — user clears progression first to return to exploration

## Duration Model

Each chord token represents 4 beats (one bar) at the current tempo. There is no grid notation, no duration-by-repetition, and no chord collapsing (POL-D17). `Dm7 Dm7` produces two shapes totaling 8 beats. For more than one chord per bar, repeat chords and increase tempo.

`shapesToChordEvents(shapes)` converts `Shape[]` → `ChordEvent[]` with 4 beats per chord. The integration module passes the result directly to `scheduleProgression(events)`.

## Integration Readiness Checklist

All items must be verified before starting integration module development.

### Harmony Core

- [x] Public API complete: all functions in ARCH §11 exported and tested
- [x] Types consumed by other modules exported: `Shape`, `Chord`, `NodeCoord`, `CentroidCoord`, `TriRef`, `TriId`, `EdgeId`, `WindowBounds`, `WindowIndices`
- [x] `parseChordSymbol()` handles all MVP chord grammar (HC-D4)
- [x] `mapProgressionToShapes()` implements chain focus (HC-D11)
- [x] `getEdgeUnionPcs()` returns `number[] | null` (boundary edge = null)
- [x] All tests passing (168 tests)
- [x] No runtime dependencies on UI, audio, or storage

### Rendering/UI

- [x] SVG scaffold, grid rendering, camera controller operational
- [x] `hitTest()` returns discriminated `HitResult` (HitTriangle | HitEdge | HitNone)
- [x] `createInteractionController()` emits `onTriangleSelect`, `onEdgeSelect`, `onPointerUp` with pitch classes
- [x] `renderShape()` / `renderProgressionPath()` render HC Shape objects
- [x] `PathHandle.setActiveChord(index)` ready for transport subscription
- [x] `createUIStateController()` implements all state transitions (idle → chord-selected → progression-loaded → playback-running)
- [x] `createControlPanel()` exposes play/stop/clear callbacks (superseded by sidebar; legacy API still exported)
- [x] `createLayoutManager()` provides three-zone layout (superseded by sidebar; legacy API still exported)
- [x] All tests passing (344 tests including 20 AE contract tests)
- [x] No runtime dependencies on audio or storage

### Audio Engine

- [x] `initAudio()` → `AudioTransport` with all 14 interface methods
- [x] `createImmediatePlayback()` / `playPitchClasses()` / `playShape()` / `stopAll()` operational
- [x] `AudioTransport.scheduleProgression()` / `play()` / `stop()` / `pause()` operational
- [x] `AudioTransport.onChordChange()` / `onStateChange()` fire correctly
- [x] `shapesToChordEvents()` converts `Shape[]` → `ChordEvent[]`
- [x] Voice-leading (`voiceLead`) threads across sequential chords
- [x] All tests passing (172 tests)
- [x] No runtime dependencies on UI or storage

### Persistence/Data

- [x] `saveProgression()` / `loadProgression()` / `listProgressions()` / `deleteProgression()` operational
- [x] `encodeShareUrl()` / `decodeShareUrl()` produce valid URL-fragment payloads
- [x] `loadSettings()` / `saveSettings()` round-trip correctly
- [x] Schema version field present in all stored records
- [x] All tests passing (108 tests)
- [x] No runtime dependencies on UI, audio, or harmony logic

### Cross-Module Compatibility

- [x] HC `Shape.covered_pcs` (Set) → AE `playShape()` accepts Shape directly
- [x] HC `getTrianglePcs()` → `number[]` → AE `playPitchClasses()` accepts `readonly number[]`
- [x] HC `getEdgeUnionPcs()` → `number[] | null` → null guard before AE `playPitchClasses()`
- [x] RU `InteractionCallbacks` pitch-class arrays compatible with AE immediate playback
- [x] AE `AudioTransport` interface satisfies RU event subscription needs (onChordChange, onStateChange, getTime)
- [x] AE `ChordEvent.shape` references HC `Shape` — same object identity preserved through pipeline
- [x] PD `chords: string[]` → HC `parseChordSymbol()` each → valid `Chord[]` (integration pipeline)
- [x] Each chord = 4 beats (POL-D17) → `shapesToChordEvents(shapes)` → AE `scheduleProgression(events)`

---

# Decisions

### Decision Log

```
D-1: Modular multi-document architecture
Date: 2026-02-12
Status: Closed
Priority: Critical
Decision:
Use one main spec plus subsystem architecture documents.
Rationale:
Supports parallel development, maintainability, and future platform portability.
```

```
D-2: Tonnetz as primary harmonic representation
Date: 2026-02-12
Status: Closed
Priority: Critical
Decision:
All harmonic modeling and visualization occur in Tonnetz coordinate space.
Rationale:
Enables geometric voice-leading representation and harmonic graph analytics.
```

```
D-3: Static-first deployment model
Date: 2026-02-12
Status: Closed
Priority: Critical
Decision:
Deploy MVP as static web application hosted on an existing server.
Rationale:
Simplifies infrastructure and enables rapid iteration without backend systems.
```

```
D-4: Local-first persistence and URL-based sharing
Date: 2026-02-12
Status: Closed
Priority: Important
Decision:
Store progressions locally and enable sharing via URL-encoded payloads.
Rationale:
Avoids account systems and backend storage while supporting collaboration.
```

```
D-5: Explicit subsystem interface contracts
Date: 2026-02-12
Status: Closed
Priority: Important
Decision:
Each subsystem defines a public module API; inter-module communication occurs exclusively through these interfaces.
Rationale:
Ensures modularity, testability, and future mobile portability.
```

```
D-6: Chain focus policy for progression placement
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Progression chord placement uses chain focus: each chord's placement focus is the preceding chord shape's centroid.
User corrects viewport drift via pan/zoom.
Rationale:
Simplest policy that produces geometrically coherent progression paths.
See HC-D11 in ARCH_HARMONY_CORE.md.
```

```
D-7: Diminished and augmented triads as dot clusters
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Diminished and augmented triads do not form triangles in the Tonnetz lattice and are represented as dot-cluster shapes.
Rationale:
Diminished: stacked minor-third intervals do not correspond to adjacent nodes.
Augmented: stacked major-third intervals place all three nodes along the same diagonal axis.
See HC-D5 in ARCH_HARMONY_CORE.md.
```

```
D-8: Augmented extended chords excluded from MVP
Date: 2026-02-13
Status: Closed
Priority: Minor
Decision:
Extended chords built on augmented triads (aug7, augMaj7, etc.) are excluded from MVP chord grammar.
Rationale:
Augmented triads are uncommon in target repertoire. Simplifies MVP scope; deferred to future grammar expansion.
See HC-D4 in ARCH_HARMONY_CORE.md.
```

---

# Development Phases

## Phase 1: Interactive Tonnetz Instrument (MVP)

**Objective:**
Deliver playable harmonic instrument with progression visualization.

**Steps:**

1. Harmony Core lattice/indexing implementation
2. SVG Tonnetz rendering and interaction
3. edge-proximity selection and union chord interaction
4. Audio engine playback
5. progression parsing and path visualization
6. local persistence and URL sharing

**Tests:**

* chord playback correctness
* adjacency detection
* edge union chord correctness
* progression rendering accuracy
* interaction latency

---

## Phase 2: Progression Tools

* ~~save/load library UI~~ (shipped in MVP Polish Phase 2)
* ~~loop playback controls~~ (shipped in MVP Polish Phase 1)
* transposition via Tonnetz motion
* improved voice-leading engine

---

## Phase 3: Harmonic Analytics Platform

* corpus ingestion
* harmonic transition graph construction
* similarity search
* style clustering

---

# Testing Strategy

## Unit Tests

* Tonnetz coordinate math
* adjacency indexing
* chord parsing
* chord decomposition
* edge union pitch-class computation
* diminished triad dot-cluster generation
* augmented triad dot-cluster generation

## Integration Tests

* chord playback synchronization
* edge selection → 4-note playback
* progression playback timing
* renderer interaction correctness

## Manual Acceptance Tests

* create ii–V–I via grid
* paste progression and verify playback
* drag progression across lattice
* verify mobile touch responsiveness
* select edge and verify 4-note playback

---

# Future Enhancements

## Priority 1

* MIDI export
* DAW integration
* extended chord visualization (9/11/13)
* augmented extended chords (aug7, augMaj7, etc.)

## Priority 2

* harmonic resolution suggestions
* corpus density heatmaps

## Priority 3

* AI-assisted reharmonization
* Tonnetz similarity search engine

---

# Known Limitations (v1)

* limited chord grammar (no augmented extended chords; no 9/11/13 tensions)
* diminished and augmented triads rendered as dot clusters, not triangles
* no shared progression library
* simple synthesis model
* minimal voice-leading optimization

---

# Development Environment

## Prerequisites

* Node.js (LTS recommended)
* npm (bundled with Node)

## Gotchas

* **Source control:** This project uses **Git**, not Sapling. Use `git` commands (`git status`, `git add`, `git commit`, etc.), not `sl`.
* **Shell environment:** Windows PowerShell (`pwsh`). No `tail`, `grep`, `head`, `cat` — use PowerShell equivalents (`Select-Object -Last`, `Select-String`, `Get-Content`). Pipe filtering: `| Select-Object -Last 5` instead of `| tail -5`.
* **Commit cadence:** One commit per phase. Commit early in the phase, then `git commit --amend` as work progresses. Do not create multiple commits within a single phase.
* **TypeScript:** TypeScript is installed **per-module** as a devDependency, not globally. To type-check, `cd` into the module directory first:
  ```bash
  cd HARMONY_CORE && npx tsc --noEmit
  cd RENDERING_UI && npx tsc --noEmit
  ```
  Running `npx tsc` from the project root will fail ("not the tsc command you are looking for").
* **Test runner:** Each module uses Vitest. Run tests from the module directory:
  ```bash
  cd HARMONY_CORE && npx vitest run
  ```
* **No monorepo tool:** There is no Lerna/Nx/Turborepo. Each module under the project root is an independent npm package with its own `package.json`, `tsconfig.json`, and `vitest.config.ts`.

---

# Glossary

* **Tonnetz** — geometric harmonic lattice representing pitch relationships
* **Triangle** — triad representation on the lattice (maj and min only; dim and aug use dots)
* **Shape** — chord representation (triangles + dots)
* **Dot Cluster** — non-triangulated pitch-class representation for chords without lattice triangles
* **Edge Union Chord** — 4-note chord formed by the pitch-class union of two adjacent triangles
* **Chain Focus** — progression placement policy where each chord's focus is the preceding shape's centroid
* **Progression Path** — ordered sequence of Tonnetz shapes
