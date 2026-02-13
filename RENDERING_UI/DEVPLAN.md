# DEVPLAN — Rendering/UI

Module: Rendering/UI
Version: 0.6
Date: 2026-02-13
Architecture reference: ARCH_RENDERING_UI.md (Draft 0.5)

---

## Cold Start Summary

**What this is:**
SVG-based rendering and interaction subsystem for the Tonnetz Interactive Harmonic Explorer. Responsible for lattice rendering, coordinate transforms (lattice → world → screen), interaction hit-testing (triangles, edges via proximity circle, nodes), chord shape visualization, progression path animation, camera control (pan/zoom), and layout zone management. Consumes Harmony Core's public API for all harmonic computation.

**Key constraints:**
- SVG rendering for MVP (RU-D1); hybrid Canvas/SVG deferred
- Rendering/UI owns all coordinate transforms; Harmony Core operates purely in lattice coordinates (RU-D2)
- Equilateral triangle layout: `worldX = u + v*0.5`, `worldY = v * √3/2` (RU-D10)
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

**Phase:** 1 — Lattice Rendering Fundamentals ✅ COMPLETE
**Focus:** Phase 2 planning (interaction layer — proximity-circle hit-testing)
**Blocked/Broken:** Nothing
**Test count:** RU 107 passing, HC 168 passing

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

---

## Future Phases

| Phase | Scope | Depends On |
|-------|-------|------------|
| 2 | Interaction layer — proximity-circle hit-testing, drag/tap distinction, selection state | Phase 1 |
| 3 | Shape rendering — triangle fills, extension fills, dot clusters, root marker | Phase 1, Phase 2 |
| 4 | Progression path rendering — centroid path, playback animation, clear button | Phase 3 |
| 5 | Layout integration — control panel, toolbar, responsive resize | Phase 1 |
| 6 | Public API assembly, type signatures, integration tests | All above |
