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

**Phase:** 2 — Interaction Layer ✅ (all steps 2a–2f complete, code review complete)
**Blocked/Broken:** Nothing
**Test count:** RU 173 passing (9 test files, 10 source files), HC 168 passing

**Harmony Core Dependency:** Phase 7 (Code Review) complete. New `CentroidCoord` type alias exported for centroid handling. See HARMONY_CORE/DEVLOG.md Entry Phase 7. **No HC changes required for Phase 2 — all needed APIs are already exported.**

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

## Phase 2: Interaction Layer

**Objective:** Pointer-based interaction on the Tonnetz lattice. Disambiguate tap vs drag, resolve proximity-circle hit-testing (triangle selection, edge-proximity union chords), emit selection events, wire gesture disambiguation with the existing camera controller. No rendering of chord shapes yet (Phase 3) — this phase establishes the interaction *plumbing*.

**Key specs:** UX-D1 (proximity circle), UX-D3 (drag-scrub vs tap), UX-D4 (press-hold = sustain), RU-D3 (hit-testing model), RU-D5 (rAF pointer sampling), ARCH §5, §7.

### Pre-Implementation Analysis (Phase 2 Prep)

#### HC API Surface Consumed by Phase 2

All functions below are already exported from `HARMONY_CORE/src/index.ts`. No Harmony Core changes needed.

| Function / Map | Used In | Purpose |
|---|---|---|
| `triVertices(tri)` | 2a | Triangle vertex positions for containment / distance tests |
| `getTrianglePcs(tri)` | 2d | Pitch classes for selection event payloads |
| `getEdgeUnionPcs(edgeId, indices)` | 2d | Union pitch classes for edge selection events |
| `triId(tri)` | 2a | Constructing TriId from computed TriRef |
| `nodeId(u, v)` | 2a | Node ID construction (if needed during lattice lookup) |
| `parseEdgeId(eid)` | 2a | Extracting edge vertex coords for distance calculation |
| `indices.edgeToTris` | 2a | Boundary vs shared edge check (length 1 = boundary, 2 = shared) |
| `indices.triIdToRef` | 2a | Getting TriRef from TriId for vertex access |
| `indices.nodeToTris` | 2a | Node-overlap detection (3+ triangles) |

#### Triangle Containment Algorithm (2a)

The Tonnetz lattice has a perfectly regular structure — each integer cell `(floor(u), floor(v))` contains exactly one Up and one Down triangle. Given fractional `(u, v)` from `worldToLattice(x, y)`:

1. Compute anchor: `anchorU = floor(u)`, `anchorV = floor(v)`
2. Compute fractional offsets: `fu = u - anchorU`, `fv = v - anchorV`
3. Determine orientation: `fu + fv < 1` → Up triangle at `(anchorU, anchorV)`; otherwise → Down triangle at `(anchorU, anchorV)`

This avoids brute-force point-in-triangle tests over the entire window. After identifying the containing triangle, edge proximity is computed by point-to-line-segment distance for each of the triangle's 3 edges.

#### Edge Distance Calculation (2a)

For each edge of the containing triangle, compute the perpendicular distance from the pointer position to the line segment (in world coordinates). If the distance is less than the proximity radius AND the edge has 2 triangles in `edgeToTris` (shared interior edge), it's an edge hit. Boundary edges (1 triangle) are excluded per UX-D1.

If multiple edges qualify, use the nearest one.

#### Screen→World Conversion (2b, 2d)

Both gesture controller and interaction controller need screen-to-world conversion. The formula uses the current viewBox:

```
worldX = viewBox.minX + (screenX / svgClientWidth) * viewBox.width
worldY = viewBox.minY + (screenY / svgClientHeight) * viewBox.height
```

This is currently done inline in `camera-controller.ts` (lines 119–122 for zoom). Phase 2 should factor this into a shared utility function in `coords.ts` or a new `screen-coords.ts` to avoid duplication.

#### Camera Refactor Strategy (2c)

Current `camera-controller.ts` attaches `pointerdown`/`pointermove`/`pointerup` directly (lines 131–133) and unconditionally enters pan mode on any primary pointerdown (line 88–92). This blocks lattice interaction.

**Refactor plan:**
- Remove the three internal pointer handlers and their `addEventListener` calls
- Add `panStart()`, `panMove(worldDx, worldDy)`, `panEnd()` to the `CameraController` interface
- Keep `onWheel` (zoom) as-is — wheel events are unambiguous
- The gesture controller (2b) performs the screen→world delta conversion and calls `panMove` with world-coordinate deltas
- `panMove` directly calls `applyPan(camera, worldDx, worldDy)` + `syncViewBox()`
- All 20 existing camera-controller tests must be adapted from dispatching pointer events to calling the new `panStart`/`panMove`/`panEnd` API

#### Implementation Order

The order 2a → 2b → 2c → 2d → 2e → 2f respects dependencies:

```
2a (hit-test math)      pure functions, no DOM — safest starting point
      ↓
2b (gesture controller) consumes nothing yet, but will be consumed by 2d
      ↓
2c (camera refactor)    must happen before 2d wires everything together
      ↓
2d (interaction ctrl)   combines 2a + 2b + 2c
      ↓
2e (pan clamping)       independent of 2a–2d, can be done in parallel
      ↓  (ordering only, no data dependency)
2f (review + cleanup)   always last
```

#### Items to Watch

| # | Concern | Detail | Mitigation |
|---|---------|--------|------------|
| W1 | **Camera refactor risk** (2c) | Modifying a well-tested module (20 tests). Removing pointer listeners changes the module's contract. | Adapt tests from event-dispatch to direct API calls in the same commit as the refactor. Run full suite after each change. |
| W2 | **`requestAnimationFrame` in happy-dom** (2d) | Phase 1 never used rAF. happy-dom may not provide it or may provide a synchronous stub. Drag-scrub sampling (2d) depends on rAF. | Check happy-dom's rAF behavior early in 2d. If absent or broken, use `vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; })` in tests. |
| W3 | **Triangle containment edge cases** (2a) | Points exactly on a triangle edge or vertex produce degenerate containment results. The `fu + fv == 1` case is exactly on the U/D boundary. | Use consistent tie-breaking (e.g., `fu + fv < 1` → Up, `>= 1` → Down). Document the convention. Test the boundary explicitly. |
| W4 | **Edge-distance ties** (2a) | Pointer equidistant from two edges — both qualify as edge hits. | Nearest-edge wins. If truly equidistant (float equality), pick by deterministic EdgeId sort order. Unlikely in practice with floating-point pointer coords. |
| W5 | **Proximity radius tuning** (2a) | The "half triangle side" heuristic from UX-D1 may be too generous or too tight at different zoom levels. | `computeProximityRadius(zoom, baseTriSize)` makes the radius configurable. Start with 0.5 * edge length, tune during manual testing. |
| W6 | **Drag-scrub complexity** (2d) | rAF-sampled hit-testing on every drag move, plus triangle-change detection, plus edge-suppression — nontrivial state machine inside `InteractionController`. | Consider implementing drag-scrub as a separate internal state/method rather than inline in the drag handler. Keep the state machine explicit and testable. |
| W7 | **Screen→world duplication** | The conversion formula exists inline in `camera-controller.ts` zoom handler. Phase 2 needs it in gesture controller too. | Factor into shared utility (`screenToWorld(sx, sy, viewBox, svgWidth, svgHeight)`) during 2b or 2c. |

---

### 2a: Proximity-Circle Hit-Test Math

`src/hit-test.ts` — Pure functions, no DOM. Given a world-coordinate point and a proximity radius, determine what the user is pointing at.

- `hitTest(worldX, worldY, radius, indices): HitResult`
  - Classify pointer position relative to the lattice:
    - **Triangle** — proximity circle enclosed by a single triangle → `{ type: "triangle", triId }`
    - **Edge** — proximity circle crosses a shared interior edge → `{ type: "edge", edgeId, triIds: [a, b] }`
    - **None** — outside lattice bounds or ambiguous (node overlap) → `{ type: "none" }`
  - Boundary edges (only one adjacent triangle) never produce edge hits (UX-D1)
  - Node overlap (3+ triangles) → nearest-triangle fallback for MVP
- `computeProximityRadius(zoom, baseTriSize): number` — radius scales with zoom so the hit circle covers ~half a triangle side at any zoom level
- Uses `worldToLattice` for coordinate conversion, HC's `getAdjacentTriangles`/`getEdgeUnionPcs` for adjacency lookups

**Test plan:**
- [ ] Point at triangle centroid → triangle hit
- [ ] Point near shared interior edge → edge hit with correct pair
- [ ] Point near boundary edge → triangle hit (not edge)
- [ ] Point far outside lattice → none
- [ ] Point near node (3-triangle overlap) → nearest-triangle fallback
- [ ] Radius scaling with zoom
- [ ] Symmetric: both sides of a shared edge produce the same edge hit

### 2b: Gesture Disambiguator

`src/gesture-controller.ts` — Distinguishes tap/click from drag, manages pointer lifecycle, gates camera pan vs lattice interaction.

- `createGestureController(svg, options): GestureController`
  - **Drag threshold:** ~5px pointer movement (configurable). Below = tap, above = drag (UX-D3).
  - **Pointer lifecycle:** `pointerdown` → accumulate movement → classify on `pointerup` (tap) or on threshold crossing (drag)
  - **Camera pan gating:** Pan only starts after drag threshold is exceeded. Replaces the current `pointerdown` → immediate pan behavior in `camera-controller.ts`. (Resolves Phase 1 deferred item: "pan captures all pointerdowns")
  - **Events emitted:**
    - `onTap(worldX, worldY)` — pointer stayed below threshold
    - `onDragStart(worldX, worldY)` — threshold crossed
    - `onDragMove(worldX, worldY)` — subsequent moves during drag
    - `onDragEnd(worldX, worldY)` — pointer up after drag
    - `onPointerDown(worldX, worldY)` — immediate, before classification (for audio trigger per UX-D4)
    - `onPointerUp()` — pointer released (for audio stop per UX-D4)
  - Converts screen coordinates to world coordinates using current viewBox
  - Calls `setPointerCapture` for reliable drag tracking

**Test plan:**
- [ ] Small movement (<5px) → tap event, no drag events
- [ ] Large movement (>5px) → dragStart + dragMove + dragEnd, no tap
- [ ] Pointer down fires immediately (before classification)
- [ ] Pointer up fires on release
- [ ] Screen-to-world conversion is correct
- [ ] Right-click / non-primary button ignored
- [ ] Destroy removes all listeners

### 2c: Refactor Camera Pan to Use Gesture Controller

Modify `camera-controller.ts` to no longer attach its own `pointerdown`/`pointermove`/`pointerup` listeners. Instead, it exposes `panStart()`/`panMove(dx, dy)`/`panEnd()` methods that the gesture controller calls when a drag is classified.

- Add `panStart()`, `panMove(worldDx, worldDy)`, `panEnd()` to `CameraController` interface
- Remove internal `onPointerDown`, `onPointerMove`, `onPointerUp` listeners
- Keep `onWheel` (zoom) as-is — wheel is unambiguous, no gesture classification needed
- Existing `getCamera`, `getViewBox`, `updateDimensions`, `reset`, `destroy` unchanged

**Test plan:**
- [ ] Existing pan tests adapted to use new `panStart`/`panMove`/`panEnd` API
- [ ] `panMove` applies correct world-coordinate delta
- [ ] `panStart`/`panEnd` lifecycle (no pan movement outside of active pan)
- [ ] Zoom still works (wheel handler unmodified)
- [ ] `updateDimensions` and `reset` still work
- [ ] Old pointer listeners are NOT attached (verify no viewBox change on raw pointerdown/pointermove)

### 2d: Interaction Controller (Orchestration)

`src/interaction-controller.ts` — Wires gesture events to hit-testing and emits high-level selection events.

- `createInteractionController(options): InteractionController`
  - Owns the `GestureController` and `CameraController` internally
  - **On tap:** run `hitTest(worldX, worldY, radius, indices)` → emit `onTriangleSelect` or `onEdgeSelect` with HC IDs
- **On drag (background start):** if the initial `hitTest` on `dragStart` returns `"none"` (pointer outside any triangle), forward to `CameraController.panStart/panMove/panEnd` for camera pan
  - **On drag (triangle start — scrub):** if the initial `hitTest` on `dragStart` returns a triangle, enter scrub mode: run `hitTest` on each `dragMove`, emit `onDragScrub` on triangle change (rAF-sampled per RU-D5). Only triangle hits during drag — edge selection suppressed (UX-D3). Pan is not active during scrub.
  - **On pointerDown/pointerUp:** forward for audio trigger/stop (UX-D4)
  - `requestAnimationFrame` sampling for `dragMove` hit-tests — retrigger only on triangle change
  - `setIndices(indices)` — update when resize rebuilds the window
  - `destroy()` — tears down gesture controller and camera controller

**Events emitted:**
- `onTriangleSelect(triId, pcs)` — tap on triangle
- `onEdgeSelect(edgeId, triIds, pcs)` — tap on shared edge (union chord)
- `onDragScrub(triId, pcs)` — triangle change during drag
- `onPointerDown(worldX, worldY)` — immediate (audio trigger)
- `onPointerUp()` — release (audio stop)

**Test plan:**
- [ ] Tap at triangle centroid → onTriangleSelect fires with correct triId
- [ ] Tap near shared edge → onEdgeSelect fires with correct edgeId + both triIds
- [ ] Drag → camera pans, no triangle/edge selection events
- [ ] Drag over triangles → onDragScrub fires on triangle change (not on every move)
- [ ] Drag over triangles → no edge selection events (UX-D3)
- [ ] rAF sampling — dragMove hit-test is throttled
- [ ] pointerDown/pointerUp forwarded correctly
- [ ] setIndices updates hit-test context
- [ ] destroy cleans up everything

### 2e: Pan Boundary Clamping

Add soft-clamp to `applyPan` in `camera.ts` so the camera center cannot drift beyond a configurable multiple of the window world extent.

- `applyPan(camera, dx, dy, bounds?, clampFactor?)` — optional bounds + factor (default ~1.5×)
- If `bounds` provided, clamp `centerX`/`centerY` to `[extent.minX - margin, extent.maxX + margin]` (where `margin = extent × (clampFactor - 1) / 2`)
- Backward compatible: omitting bounds preserves current unclamped behavior
- CameraController passes bounds through to `applyPan`

**Test plan:**
- [ ] Pan within bounds → no clamping
- [ ] Pan beyond 1.5× extent → clamped to boundary
- [ ] Pan with no bounds arg → unclamped (backward compat)
- [ ] Clamp factor configurable
- [ ] Zoom + pan interaction: clamping uses current zoom level's visible extent

### 2f: Post-Phase 2 Review & Cleanup

Review pass over all Phase 2 code. Fix test gaps, update barrel exports, update DEVPLAN/DEVLOG.

---

## Phase 2 Summary (Planned)

| Step | New File(s) | Key Concepts | Est. Tests |
|------|-------------|--------------|------------|
| 2a | hit-test.ts | Proximity circle, triangle/edge/none classification | ~10 |
| 2b | gesture-controller.ts | Tap vs drag, threshold, pointer lifecycle | ~10 |
| 2c | (modify camera-controller.ts) | Extract pan into panStart/panMove/panEnd API | ~8 |
| 2d | interaction-controller.ts | Orchestration, rAF sampling, selection events | ~12 |
| 2e | (modify camera.ts) | Pan boundary soft-clamp | ~6 |
| 2f | — | Review, cleanup, exports | — |
| **Total** | **2 new, 2 modified** | | **~46** |

---

## Future Phases

| Phase | Scope | Depends On |
|-------|-------|------------|
| 3 | Shape rendering — triangle fills, extension fills, dot clusters, root marker | Phase 2 |
| 4 | Progression path rendering — centroid path, playback animation, clear button | Phase 3 |
| 5 | Layout integration — control panel, toolbar, responsive resize | Phase 1 + Phase 4 |
| 6 | Public API assembly, type signatures, integration tests | All above |
