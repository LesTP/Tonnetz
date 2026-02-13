# DEVPLAN — Rendering/UI

Module: Rendering/UI
Version: 0.8
Date: 2026-02-13
Architecture reference: ARCH_RENDERING_UI.md (Draft 0.5)

---

## Cold Start Summary

**What this is:**
SVG-based rendering and interaction subsystem for the Tonnetz Interactive Harmonic Explorer. Responsible for lattice rendering, coordinate transforms (lattice → world → screen), interaction hit-testing (triangles, edges via proximity circle, nodes), chord shape visualization, progression path animation, camera control (pan/zoom), and layout zone management. Consumes Harmony Core's public API for all harmonic computation.

**Key constraints:**
- SVG rendering for MVP (RU-D1); hybrid Canvas/SVG deferred
- Rendering/UI owns all coordinate transforms; Harmony Core operates purely in lattice coordinates (RU-D2)
- Equilateral triangle layout: `worldX = u + v*0.5`, `worldY = v * √3/2` (RU-D15)
- Responsive window sizing: min triangle side ~40px, breakpoints scale with container (RU-D10, RU-D11)
- ViewBox-based camera for pan/zoom (RU-D13)
- Layered `<g>` groups from the start (RU-D12)
- Zero runtime dependencies — native DOM API + thin SVG helpers (RU-D14)
- Proximity-circle hit testing: circle ~half triangle size (UX-D1, RU-D3)
- Drag-scrub triggers sequential triads only; union chords are tap/click-only (UX-D3)
- Pointer movement sampled via requestAnimationFrame; retrigger only on triangle change (RU-D5)
- Renderer reacts to UI controller state; does not manage UI state internally (RU-D7)

**Gotchas:**
- **Plain git repo** — commit with `git add -A && git commit`, not `sl` or `jf`
- SVG namespace `"http://www.w3.org/2000/svg"` — all element creation uses `createElementNS`
- Boundary edges never produce union chords
- Node overlap (3+ triangles in proximity circle) is undefined for MVP
- JavaScript `%` returns negative for negative operands — use safe mod if needed

---

## Current Status

**Phase:** 4 — Path Rendering ✅ COMPLETE
**Blocked/Broken:** Nothing
**Test count:** RU 232 passing (12 test files, 13 source files), HC 168 passing

**Harmony Core Dependency:** Phase 7 (Code Review) complete. New `CentroidCoord` type alias exported for centroid handling. See HARMONY_CORE/DEVLOG.md Entry Phase 7. **No HC changes required — all needed APIs are already exported.**

**Next Phase:** 5 — Layout Integration

---

## Phase 0: Pre-Implementation UX Discussion ✅

Resolved 5 UX ambiguities (UX-D1 through UX-D5). Updated UX_SPEC.md, ARCH_RENDERING_UI.md, SPEC.md, ARCH_AUDIO_ENGINE.md. See DEVLOG Entry 1.

---

## Phase 1: Lattice Rendering Fundamentals ✅

**Objective:** Visible, navigable Tonnetz lattice with labeled nodes. No interaction, no chord highlighting, no audio.

### 1a: Project Scaffolding ✅

`package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`. HC as local path dependency. **5 smoke tests.**

### 1b: Coordinate Transforms ✅

`src/coords.ts` — `latticeToWorld(u, v)`, `worldToLattice(x, y)`. Pure equilateral transform + inverse. **25 tests.**

### 1c: Camera & Viewport Math ✅

`src/camera.ts` — `CameraState`, `computeWindowBounds`, `computeInitialCamera`, `computeViewBox`, `applyPan`, `applyZoom`. ViewBox-based camera with zoom anchor stability, zoom clamped to [0.25, 8]. **19 tests.**

### 1d: SVG Scaffold & Grid Rendering ✅

`src/svg-helpers.ts` — `svgEl`, `setAttrs`, `SVG_NS`.
`src/renderer.ts` — `createSvgScaffold` (5-layer `<g>` groups), `renderGrid` (triangles, edges, nodes with `data-id` attributes, pitch-class labels). Pre-computed `WorldPoint` cache eliminates redundant `latticeToWorld` calls. **24 tests.**

### 1e: Camera Interaction ✅

`src/camera-controller.ts` — `createCameraController` (pan via pointer events, zoom via wheel, reset, destroy). Sole viewBox writer (RU-DEV-D5). `updateDimensions()` for live resize sync (RU-DEV-D6). **20 tests.**

### 1f: Responsive Resize ✅

`src/resize-controller.ts` — `createResizeController` (ResizeObserver, 150ms debounce, breakpoint detection, grid rebuild). Does not manage camera/viewBox — notifies CameraController via `onResize` callback. **14 tests.**

### 1g: Post-Review Housekeeping ✅

Code review of Phase 1 identified 8 items. Immediate fixes and Harmony Core tasks completed before Phase 2.

**Implemented:**
- [x] Export `SVG_NS` from `svg-helpers.ts` (was private, redeclared in tests)
- [x] Pre-compute `WorldPoint` cache in `renderGrid` (~60% fewer `latticeToWorld` calls)
- [x] Move `parseNodeId`/`parseEdgeId` to Harmony Core public API (HC owns ID format)
- [x] Refactor camera ownership: CameraController sole viewBox writer + `updateDimensions()`; ResizeController no longer manages camera state

**Deferred to Phase 2+:**
- Pan captures all pointerdowns → will conflict with interaction. Resolve via gesture disambiguator (drag threshold per UX-D3).
- `innerHTML` clearing fine for static grid; dynamic layers should use incremental DOM updates.
- `computeWindowBounds` iterative heuristic works correctly; closed-form optimization deferred unless edge cases found.

**Tests added:** 6 new tests (5 `updateDimensions`, 1 viewBox ownership). Total: **107 RU tests.**

---

## Phase 1 Summary

| Step | Key Files | Key Functions | Tests |
|------|-----------|---------------|-------|
| 1a | package.json, tsconfig, vitest.config | — | 5 |
| 1b | coords.ts | `latticeToWorld`, `worldToLattice` | 25 |
| 1c | camera.ts | `computeWindowBounds`, `computeInitialCamera`, `computeViewBox`, `applyPan`, `applyZoom` | 19 |
| 1d | svg-helpers.ts, renderer.ts | `svgEl`, `setAttrs`, `createSvgScaffold`, `renderGrid` | 24 |
| 1e | camera-controller.ts | `createCameraController` (pan, zoom, reset, updateDimensions) | 20 |
| 1f | resize-controller.ts | `createResizeController` (ResizeObserver, debounce, breakpoint) | 14 |
| 1g | (refactors across above files + HC) | Post-review fixes | — |
| **Total** | **7 source files, 6 test files** | | **107** |

---

## Design Decisions

```
RU-DEV-D1: Phase 0 UX resolution before implementation
Status: Closed | Priority: Critical
Decision: All UX interaction ambiguities resolved before code. Per GOVERNANCE.md.
```

```
RU-DEV-D2: API type signatures deferred to post-implementation
Status: Closed | Priority: Normal
Decision: Draft contract in ARCH §11; full signatures after implementation. Rendering has more unknowns than HC's pure algebra.
```

```
RU-DEV-D3: HC consumed as local path dependency
Status: Closed | Priority: Normal
Decision: "harmony-core": "file:../HARMONY_CORE". Simplest for monorepo.
```

```
RU-DEV-D4: happy-dom for SVG unit testing
Status: Closed | Priority: Normal
Decision: Vitest + happy-dom via per-file pragma. Lighter than jsdom, supports SVG namespacing.
```

```
RU-DEV-D5: CameraController is sole viewBox writer
Status: Closed | Priority: High
Decision: CameraController owns all viewBox writes. ResizeController notifies via callback; consumer calls updateDimensions(). Prevents dual-writer conflicts.
```

```
RU-DEV-D6: CameraController.updateDimensions() for live resize
Status: Closed | Priority: High
Decision: updateDimensions(cW, cH, bounds) updates stored dimensions, resets camera, syncs viewBox. Prevents stale aspect ratios after resize.
```

```
RU-DEV-D7: Pan boundary clamping
Status: Closed | Priority: Normal
Decision: Soft-clamp camera center to ~1.5× window world extent. applyPan() accepts optional bounds and clampFactor params (default 1.5). Margin = extent × (clampFactor - 1) / 2 on each side. Omitting bounds preserves unclamped behavior (backward compat). CameraController passes cBounds through to applyPan automatically.
```

```
RU-DEV-D8: Drag-start hit-test uses pointerDown origin
Status: Closed | Priority: High
Decision: The interaction controller stores the world position from onPointerDown and uses it for the hit-test in onDragStart, rather than the position where the gesture controller's drag threshold was exceeded. The user's intent (triangle scrub vs background pan) is determined by where they pressed, not where the pointer was when it crossed the 5px threshold.
```

---

## Phase 2: Interaction Layer ✅

**Objective:** Pointer-based interaction on the Tonnetz lattice. Disambiguate tap vs drag, resolve proximity-circle hit-testing (triangle selection, edge-proximity union chords), emit selection events, wire gesture disambiguation with camera controller.

### 2a: Proximity-Circle Hit-Test Math ✅

`src/hit-test.ts` — `hitTest(worldX, worldY, radius, indices)`, `computeProximityRadius(factor)`. Triangle containment via lattice floor trick, edge distance via point-to-segment. Boundary edges excluded. **15 tests.**

### 2b: Gesture Disambiguator ✅

`src/gesture-controller.ts` — `createGestureController(options)`. Tap vs drag (5px threshold), pointer lifecycle events (`onTap`, `onDragStart/Move/End`, `onPointerDown/Up`). Screen→world conversion via viewBox. **20 tests.**

### 2c: Refactor Camera Pan ✅

Modified `camera-controller.ts` — removed internal pointer listeners, added `panStart()`, `panMove(worldDx, worldDy)`, `panEnd()` API. Wheel zoom unchanged. Sole viewBox writer preserved (RU-DEV-D5). **23 tests** (adapted from pointer events to API calls).

### 2d: Interaction Controller ✅

`src/interaction-controller.ts` — `createInteractionController(options)`. Orchestrates gesture→hit-test→selection events. Drag-start hit-test determines pan (background) vs scrub (triangle) mode. rAF-sampled scrub hit-testing. Edge selection suppressed during drag (UX-D3). **16 tests.**

### 2e: Pan Boundary Clamping ✅

Modified `camera.ts` — `applyPan(camera, dx, dy, bounds?, clampFactor?)` with soft-clamp to ~1.5× window extent. Backward compatible (omit bounds = unclamped). **7 tests** (added to camera.test.ts).

### 2f: Code Review & Cleanup ✅

Code review identified 7 improvements (see DEVLOG Entry 19):
- **Optimizations:** Cached `windowWorldExtent`, batched DOM insertions via `DocumentFragment`
- **Simplifications:** Fixed JSDoc, moved `EDGE_PAIRS` to module scope, added `screenToWorld` overload
- **Disambiguations:** Renamed `_world` → `dragStartWorld`, replaced `indices` with `getIndices` callback

---

## Phase 2 Summary

| Step | Key Files | Key Functions | Tests |
|------|-----------|---------------|-------|
| 2a | hit-test.ts | `hitTest`, `computeProximityRadius` | 15 |
| 2b | gesture-controller.ts | `createGestureController` | 20 |
| 2c | camera-controller.ts | `panStart`, `panMove`, `panEnd` (refactor) | 23 |
| 2d | interaction-controller.ts | `createInteractionController` | 16 |
| 2e | camera.ts | `applyPan` (boundary clamping) | +7 |
| 2f | (review + cleanup) | Code review fixes | — |
| **Total** | **10 source files, 9 test files** | | **173** |

---

## Future Phases

| Phase | Scope | Depends On | Status |
|-------|-------|------------|--------|
| 3 | Shape rendering — triangle fills, extension fills, dot clusters, root marker | Phase 2 | ✅ Complete |
| 4 | Progression path rendering — centroid path, `setActiveChord` API | Phase 3 | ✅ Complete |
| 5 | Layout integration — control panel (incl. clear button), toolbar, responsive resize | Phase 4 | Ready |
| 6 | Public API assembly, type signatures, integration tests | Phase 5 | Pending |
| — | **Deferred: Audio Integration** | Audio Engine | Blocked |

### Deferred Work (Audio Integration)

The following items are blocked by Audio Engine implementation:

| Item | Description | Dependency |
|------|-------------|------------|
| Playback animation | Subscribe to `AudioTransport.onChordChange()`, call `PathHandle.setActiveChord()` | Audio Engine transport |
| Transport sync | rAF loop with `AudioTransport.getTime()` for smooth path progress | Audio Engine transport |

These will be addressed in a cross-module integration phase after Audio Engine is implemented. The `PathHandle.setActiveChord()` API is already available — integration is trivial wiring.

### Phase 5 Scope (Expanded)

Phase 5 (Layout Integration) now includes clear button integration:
- Control Panel UI with progression input, playback controls, tempo
- **Clear button** → calls `clearProgression(handle)`, state transition: Progression Loaded → Idle Exploration (UX-D5)
- Toolbar with view reset, optional overlays, mode toggles
- Responsive resize behavior for layout zones

---

## Phase 3: Shape Rendering

**Objective:** Render Harmony Core `Shape` objects visually — main triangle fill with root marker, extension triangle fills, and dot clusters for dim/aug triads. Provide highlight API for selection feedback. Wire to interaction callbacks from Phase 2.

**Key specs:** ARCH §2 (layer-chords, layer-dots), SPEC §Shape, HC Shape type (main_tri, ext_tris, dot_pcs, root_vertex_index, centroid_uv).

### Pre-Implementation Analysis

#### Shape Data Structure (from HC types.ts)

```ts
interface Shape {
  chord: Chord;                      // parsed chord with pitch classes
  main_tri: TriRef | null;           // primary triangle (null for dim/aug)
  ext_tris: TriRef[];                // extension triangles (7th, etc.)
  dot_pcs: number[];                 // pitch classes rendered as dots
  covered_pcs: ReadonlySet<number>;  // all covered pitch classes
  root_vertex_index: 0 | 1 | 2 | null; // which vertex is the root (null for dot-only)
  centroid_uv: NodeCoord;            // fractional centroid for focus/path
}
```

#### Rendering Layers

From Phase 1, we have 5 layers:
- `layer-grid` — static lattice (rendered in Phase 1)
- `layer-chords` — **triangle fills go here** (Phase 3a)
- `layer-dots` — **dot clusters go here** (Phase 3b)
- `layer-path` — progression path (Phase 4)
- `layer-interaction` — interaction overlays (highlights, Phase 3c)

#### Visual Design (Draft)

| Element | Visual Treatment |
|---------|------------------|
| Main triangle fill | Semi-transparent fill (e.g., `rgba(100, 149, 237, 0.4)`) |
| Extension triangle fill | Lighter fill (e.g., `rgba(100, 149, 237, 0.2)`) or distinct color |
| Root vertex marker | Small filled circle at root node, or triangle vertex accent |
| Dot cluster | Filled circles at pitch-class node positions |
| Selection highlight | Brighter fill or stroke overlay on `layer-interaction` |

#### API Design

```ts
// Shape rendering
renderShape(layerChords, layerDots, shape, indices, options?): ShapeHandle;
clearShape(handle): void;

// Highlight for selection feedback
highlightTriangle(layerInteraction, triId, indices, style?): HighlightHandle;
highlightShape(layerInteraction, shape, indices, style?): HighlightHandle;
clearHighlight(handle): void;
clearAllHighlights(layerInteraction): void;
```

#### Implementation Steps

### 3a: Shape Rendering Module

`src/shape-renderer.ts` — Render Shape objects to the chord and dot layers.

- `renderShape(layerChords, layerDots, shape, indices, options?)` → `ShapeHandle`
  - Render `main_tri` as filled polygon (if not null)
  - Render `ext_tris` as filled polygons (different color/opacity)
  - Render root vertex marker at `root_vertex_index` position (if not null)
  - Render `dot_pcs` as circles at their node positions
  - Return a handle for clearing
- `clearShape(handle)` — remove rendered elements
- Uses `latticeToWorld` for coordinate conversion
- Uses `triVertices` from HC for triangle geometry

**Test plan:**
- [ ] renderShape with main_tri only → one filled polygon
- [ ] renderShape with main_tri + ext_tris → multiple filled polygons
- [ ] renderShape with dot_pcs → circles at correct positions
- [ ] renderShape with dot-only Shape (aug/dim) → no triangles, only dots
- [ ] root_vertex_index marker rendered at correct vertex
- [ ] clearShape removes all elements
- [ ] Multiple shapes can be rendered simultaneously

### 3b: Dot Cluster Rendering

Part of 3a, but specifically handles `dot_pcs` rendering.

- Dots positioned at the node whose `pc(u,v) === dotPc` within the visible window
- For MVP: use nearest occurrence to shape centroid, or first match in window
- Dots rendered on `layer-dots` (above chords, below path)

**Test plan:**
- [ ] dot_pcs rendered as circles
- [ ] Dots positioned correctly via pc-to-node lookup
- [ ] Dots use correct styling (filled, distinct from node circles)

### 3c: Highlight API

`src/highlight.ts` — Selection feedback for tap/scrub interactions.

- `highlightTriangle(layer, triId, indices, style?)` → `HighlightHandle`
- `highlightShape(layer, shape, indices, style?)` → `HighlightHandle`
- `clearHighlight(handle)` — remove single highlight
- `clearAllHighlights(layer)` — remove all highlights from layer
- Highlights rendered on `layer-interaction` (topmost)
- Style options: fill color, stroke, opacity

**Test plan:**
- [ ] highlightTriangle renders overlay polygon
- [ ] highlightShape highlights main_tri + ext_tris
- [ ] clearHighlight removes specific highlight
- [ ] clearAllHighlights clears layer
- [ ] Multiple highlights can coexist

### 3d: Integration with Interaction Callbacks

Wire Phase 2 interaction events to Phase 3 rendering:

- `onTriangleSelect` → `highlightTriangle` (immediate visual feedback)
- `onDragScrub` → update highlight to current triangle
- `onPointerUp` → optionally clear highlight (or keep until next selection)

This step may be a consumer-side integration, not a new module. Document the pattern and provide example wiring code.

**Test plan:**
- [ ] Integration test: tap triangle → highlight appears
- [ ] Integration test: drag scrub → highlight follows pointer

### 3e: Review & Cleanup

Review pass, update barrel exports, update DEVPLAN/DEVLOG.

---

## Phase 3 Summary

| Step | Key Files | Key Functions | Tests |
|------|-----------|---------------|-------|
| 3a | shape-renderer.ts | `renderShape`, `clearShape` | 16 |
| 3b | (part of 3a) | Dot cluster rendering | (included in 3a) |
| 3c | highlight.ts | `highlightTriangle`, `highlightShape`, `clearHighlight`, `clearAllHighlights` | 14 |
| 3d | (integration) | Wiring pattern test | 1 |
| 3e | — | Review, exports, docs | — |
| 3f | coords.ts, shape-renderer.ts, highlight.ts | `triPolygonPoints` extraction, `parseNodeId`, DocumentFragment batching | 3 |
| **Total** | **12 source files, 11 test files** | | **207** |

---

## Phase 4: Progression Path Rendering

**Objective:** Render progression paths connecting Shape centroids, with support for active chord highlighting during playback. Provide clear button integration for returning to Idle Exploration state.

**Key specs:** ARCH §6 (AudioTransport interface sync), ARCH §10 (centroid-based path rendering), UX-D5 (clear button), ARCH_AUDIO_ENGINE.md §6 (transport interface).

### Pre-Implementation Analysis

#### Centroid Path Rendering

Progression paths are rendered as polylines connecting Shape centroids. Each Shape's `centroid_uv` is transformed to world coordinates via `latticeToWorld`.

#### API Design

```ts
// Path rendering
renderProgressionPath(layerPath, shapes, options?): PathHandle;
clearProgression(handle): void;

// PathHandle methods
interface PathHandle {
  clear(): void;
  setActiveChord(index: number): void;  // highlight during playback
  getChordCount(): number;
}
```

#### Transport Interface Dependency

For playback animation (Phase 4b), Rendering/UI will consume the `AudioTransport` interface from Audio Engine. The interface is defined in ARCH_AUDIO_ENGINE.md §6:

- `onChordChange(callback)` — subscribe to chord index changes
- `getTime()` — query transport time for smooth animation
- `isPlaying()` — check playback state

Phase 4a (path rendering) has no Audio Engine dependencies. Phase 4b (playback animation) will be deferred until Audio Engine transport is implemented.

### 4a: Path Rendering Module ✅

`src/path-renderer.ts` — Render progression paths connecting Shape centroids.

- `renderProgressionPath(layerPath, shapes, options?)` → `PathHandle`
  - Render SVG `<polyline>` connecting all Shape centroids
  - Render centroid markers (circles) at each chord position
  - Render active chord marker (initially hidden)
  - Transform `centroid_uv` to world coordinates via `latticeToWorld`
  - Return handle for clearing and active chord management
- `clearProgression(handle)` — remove rendered path elements
- `PathHandle.setActiveChord(index)` — move/show active marker at index, hide for -1 or out-of-bounds
- `PathHandle.getChordCount()` — return progression length

**Implemented files:**
- `src/path-renderer.ts` — Path rendering module
- `src/__tests__/path-renderer.test.ts` — 25 tests

**Test coverage:**
- [x] renderProgressionPath renders polyline connecting centroids
- [x] Polyline has correct number of points
- [x] Centroid markers rendered at each chord
- [x] Markers have data-chord-index attributes
- [x] Active marker initially hidden
- [x] getChordCount returns correct count
- [x] Empty progression handled gracefully
- [x] Single-chord progression renders correctly
- [x] setActiveChord shows marker at correct position
- [x] setActiveChord(-1) hides marker
- [x] Out-of-bounds index hides marker
- [x] clearProgression removes all elements
- [x] Options: pathStroke, pathStrokeWidth, centroidFill, activeFill
- [x] showCentroidMarkers=false hides centroid markers
- [x] World coordinate conversion correct

### 4b: Playback Animation (Deferred)

**Blocked by:** Audio Engine transport implementation (ARCH_AUDIO_ENGINE.md §6)

Will implement:
- Subscribe to `AudioTransport.onChordChange()` for active chord updates
- Use `PathHandle.setActiveChord()` to highlight current chord
- Optional: rAF loop with `getTime()` for smooth path progress indicator

### 4c: Clear Button Integration (Future)

Wire `clearProgression()` to Control Panel UI. State transition: Progression Loaded → Idle Exploration.

Depends on Layout integration (Phase 5).

---

## Phase 4a Summary

| Step | Key Files | Key Functions | Tests |
|------|-----------|---------------|-------|
| 4a | path-renderer.ts | `renderProgressionPath`, `clearProgression`, `PathHandle` | 25 |
| **Total** | **13 source files, 12 test files** | | **232** |
