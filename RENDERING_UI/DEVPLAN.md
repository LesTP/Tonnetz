# DEVPLAN — Rendering/UI

Module: Rendering/UI
Version: 0.3
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
- Responsive window sizing: 24×24 desktop, 18×18 tablet, 12×12 phone; minimum triangle side ~40px (RU-D10, RU-D11)
- ViewBox-based camera for pan/zoom (RU-D13)
- Layered `<g>` groups from the start (RU-D12)
- Zero runtime dependencies — native DOM API + thin SVG helpers (RU-D14)
- Proximity-circle hit testing: circle ~half triangle size determines triangle vs edge selection (UX-D1, RU-D3)
- Drag-scrub triggers sequential triads only; union chords are tap/click-only (UX-D3)
- No distinct sustain mode; chord sounds on pointer-down, stops on pointer-up (UX-D4)
- Pointer movement sampled via requestAnimationFrame; retrigger only on triangle change (RU-D5)
- Renderer reacts to UI controller state; does not manage UI state internally (RU-D7)
- API type signatures deferred to post-implementation; draft contract in ARCH_RENDERING_UI §11 (RU-D9)

**Gotchas:**
- This is a **plain git repo** (not Sapling/ISL) — commit with `git add -A && git commit`, not `sl` or `jf`
- Boundary edges never produce union chords — proximity circle must cross a shared interior edge
- Node overlap (3+ triangles in proximity circle) is undefined for MVP — treat as nearest-triangle selection
- JavaScript `%` operator returns negative values for negative operands — use safe mod for any pitch-class math (though Rendering/UI should not need pc math directly)
- SVG namespace is `"http://www.w3.org/2000/svg"` — all SVG element creation must use `createElementNS`, not `createElement`

---

## Current Status

**Phase:** 1 — Lattice Rendering Fundamentals (planning complete, ready for code)
**Focus:** Static SVG grid, coordinate transforms, camera, responsive window sizing
**Blocked/Broken:** Nothing

---

## Phase 0: Pre-Implementation UX Discussion (COMPLETE)

**Outcome:** UX_SPEC.md updated to Draft 0.4 with UX-D1 through UX-D5. ARCH_RENDERING_UI.md updated to Draft 0.5 with RU-D9 through RU-D14. SPEC.md updated (adjacent triangle selection merged into edge selection per UX-D2). ARCH_AUDIO_ENGINE.md updated with shared transport timebase definition.

All Phase 0 checklist items complete. See Phase 0 details in DEVPLAN v0.2 history.

---

## Phase 1: Lattice Rendering Fundamentals

**Objective:** Deliver a visible, navigable Tonnetz lattice with labeled nodes. No interaction, no chord highlighting, no audio. This is the visual foundation for all subsequent phases.

**Scope:**
- Project scaffolding (package.json, tsconfig, test setup)
- Coordinate transform functions (lattice → world, world → lattice)
- ViewBox-based camera state (fit-to-viewport, pan, zoom, reset)
- SVG scaffold with layered `<g>` groups
- Static grid rendering from Harmony Core `WindowIndices`
- Pitch-class node labels
- Responsive window sizing
- Container resize handling

---

### Phase 1a: Project Scaffolding

**Scope:**
- Create `RENDERING_UI/package.json` (mirrors Harmony Core: ESM, TypeScript, Vitest)
- Create `RENDERING_UI/tsconfig.json`
- Create `RENDERING_UI/vitest.config.ts`
- Create `RENDERING_UI/src/` directory structure
- Add Harmony Core as a local path dependency (`"harmony-core": "file:../HARMONY_CORE"`)
- Verify: `npm install`, `npm run typecheck`, `npm test` all work (even with zero tests)

**Files to create:**
- `RENDERING_UI/package.json`
- `RENDERING_UI/tsconfig.json`
- `RENDERING_UI/vitest.config.ts`
- `RENDERING_UI/src/index.ts` (empty barrel export)

**Tests:**
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm test` runs (no tests yet, but vitest executes without crashing)
- [ ] Harmony Core types (`NodeCoord`, `TriRef`, `WindowIndices`, etc.) are importable

---

### Phase 1b: Coordinate Transforms

**Scope:**
- Implement `latticeToWorld(u, v)` → `{ x: number, y: number }`
- Implement `worldToLattice(x, y)` → `{ u: number, v: number }` (inverse — needed in Phase 2 for hit-testing, but implement now for completeness and testability)
- Both are pure functions with no dependencies beyond math

**Transform formulas (RU-D10):**
```
latticeToWorld:
  x = u + v * 0.5
  y = v * (√3 / 2)

worldToLattice:
  v = y / (√3 / 2)
  u = x - v * 0.5
```

**File:** `RENDERING_UI/src/coords.ts`

**Tests:**
- [ ] `latticeToWorld(0, 0)` = `{ x: 0, y: 0 }`
- [ ] `latticeToWorld(1, 0)` = `{ x: 1, y: 0 }` (pure u movement)
- [ ] `latticeToWorld(0, 1)` = `{ x: 0.5, y: √3/2 }` (pure v movement)
- [ ] `latticeToWorld(1, 1)` = `{ x: 1.5, y: √3/2 }`
- [ ] `latticeToWorld(0, 2)` = `{ x: 1, y: √3 }`
- [ ] Edge length verification: distance from `(0,0)` to `(1,0)` in world = 1.0 (u-axis edge)
- [ ] Edge length verification: distance from `(0,0)` to `(0,1)` in world = 1.0 (v-axis edge)
- [ ] Edge length verification: distance from `(1,0)` to `(0,1)` in world = 1.0 (diagonal edge)
- [ ] All three edge lengths equal → equilateral triangles confirmed
- [ ] Round-trip: `worldToLattice(latticeToWorld(u, v))` ≈ `(u, v)` for integer inputs
- [ ] Round-trip: `latticeToWorld(worldToLattice(x, y))` ≈ `(x, y)` for arbitrary inputs
- [ ] Negative coordinates: `latticeToWorld(-1, -1)` produces correct values
- [ ] `worldToLattice` returns fractional values (not rounded) — rounding is caller's job

---

### Phase 1c: Camera and Viewport Math

**Scope:**
- Define `CameraState` type: `{ centerX, centerY, zoom }` in world coordinates
- Implement `computeInitialCamera(containerWidth, containerHeight, windowBounds)` — fit-to-viewport (RU-D11)
- Implement `computeViewBox(camera, containerWidth, containerHeight)` → `{ minX, minY, width, height }` string for SVG viewBox attribute
- Implement `computeWindowBounds(containerWidth, containerHeight, minTriSizePx)` → `WindowBounds` — responsive window sizing (RU-D10)
- Implement `applyPan(camera, dx, dy)` → new `CameraState`
- Implement `applyZoom(camera, factor, anchorX, anchorY)` → new `CameraState` (zoom centered on anchor point)

**File:** `RENDERING_UI/src/camera.ts`

**Key design notes:**
- ViewBox width/height in world units = container dimensions / (base scale × zoom)
- Base scale is computed from container size and window world extent
- Pan translates the viewBox center; zoom scales viewBox dimensions
- Zoom anchor: when zooming at pointer position, the world point under the pointer stays fixed

**Tests:**
- [ ] `computeWindowBounds(1024, 768, 40)` → bounds producing ~24×24 window (desktop)
- [ ] `computeWindowBounds(768, 1024, 40)` → bounds producing ~18×18 window (tablet-ish)
- [ ] `computeWindowBounds(375, 667, 40)` → bounds producing ~12×12 window (phone)
- [ ] `computeWindowBounds` never produces triangles smaller than `minTriSizePx` on screen
- [ ] `computeInitialCamera` centers the window in the viewport
- [ ] `computeViewBox` at zoom=1 shows the full window
- [ ] `computeViewBox` at zoom=2 shows half the window (zoomed in)
- [ ] `applyPan` shifts the viewBox center by the given world-coordinate delta
- [ ] `applyZoom(camera, 2, anchorX, anchorY)` — the anchor point's world position is unchanged after zoom
- [ ] `applyZoom` clamps zoom to a reasonable range (e.g., 0.25 to 8)

---

### Phase 1d: SVG Scaffold and Grid Rendering

**Scope:**
- Implement thin SVG helper: `svgEl(tag, attrs?)` → SVGElement, `setAttrs(el, attrs)` (RU-D14)
- Implement `createSvgScaffold(container)` — create root `<svg>` with 5 layered `<g>` groups (RU-D12), set viewBox
- Implement `renderGrid(layerGroup, indices, latticeToWorld)` — render static lattice:
  - Triangle outlines (edges as `<line>` or `<path>` elements)
  - Node circles at each vertex
  - Pitch-class label (`<text>`) at each node
- Node labels use standard pitch-class names: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
- Each SVG element gets a `data-id` attribute with its Harmony Core ID (TriId, EdgeId, NodeId) for future interaction targeting
- Triangle fill is transparent for now (filled polygons added in Phase 3)

**Files:**
- `RENDERING_UI/src/svg-helpers.ts`
- `RENDERING_UI/src/renderer.ts`

**Design notes:**
- Grid rendering iterates Harmony Core's `WindowIndices`:
  - `triIdToRef` → enumerate all triangles → transform vertices → draw `<polygon>` outlines
  - Collect unique nodes from triangle vertices → draw `<circle>` + `<text>` at each
  - Edges are drawn implicitly as triangle outlines (each edge appears once per adjacent triangle, but SVG overlap is invisible for outlines)
- Alternative: draw edges explicitly via `edgeToTris` keys. Slightly more work but avoids double-drawing and allows future per-edge styling. **Use explicit edge rendering.**

**Tests (Vitest + jsdom or happy-dom):**
- [ ] `createSvgScaffold` creates an `<svg>` element with 5 child `<g>` groups
- [ ] Each `<g>` has the correct `id` attribute (`layer-grid`, `layer-chords`, `layer-dots`, `layer-path`, `layer-interaction`)
- [ ] `svgEl("circle", { cx: 1, cy: 2, r: 3 })` creates an SVGCircleElement with correct attributes
- [ ] `renderGrid` for a 1×1 window (2 triangles) produces:
  - 2 `<polygon>` elements (triangle outlines)
  - 4 unique `<circle>` nodes (the 4 distinct vertices of 2 triangles sharing a hypotenuse)
  - 4 `<text>` labels
  - All edges as `<line>` elements (5 unique edges for 2 triangles: 3 + 3 - 1 shared = 5)
- [ ] `renderGrid` for a 2×2 window produces correct element counts:
  - 8 triangles → 8 `<polygon>` elements
  - Node and edge counts match `WindowIndices` map sizes
- [ ] All `<polygon>` vertex coordinates match `latticeToWorld` output for their triangle's vertices
- [ ] All `<circle>` positions match `latticeToWorld` output for their node coordinate
- [ ] All `<text>` elements contain correct pitch-class names (verify against `pc(u,v)`)
- [ ] Every rendered element has a `data-id` attribute matching its Harmony Core ID
- [ ] SVG namespace is correct (`http://www.w3.org/2000/svg`) on all elements

---

### Phase 1e: Camera Interaction (Pan, Zoom, Reset)

**Scope:**
- Implement pointer event handlers for pan (drag on background)
- Implement wheel event handler for zoom
- Implement reset button/function
- Wire camera state changes to viewBox updates on the root `<svg>`
- Pan: `pointerdown` on background → track movement → `applyPan` → update viewBox
- Zoom: `wheel` event → `applyZoom` centered on pointer position → update viewBox
- Reset: restore `computeInitialCamera` values

**File:** `RENDERING_UI/src/camera-interaction.ts`

**Design notes:**
- Pan requires converting screen-space pointer delta to world-space delta. With viewBox-based camera: `worldDelta = screenDelta * (viewBox.width / svg.clientWidth)`
- Zoom must convert pointer screen position to world position before and after zoom to keep the point under the cursor fixed
- `pointer-events: none` on the interaction overlay group during pan to prevent triangle hover interference (future-proofing)

**Tests:**
- [ ] Pan: simulating `pointerdown` + `pointermove` on SVG background shifts viewBox origin
- [ ] Pan: `pointermove` without prior `pointerdown` does not pan
- [ ] Zoom: simulating `wheel` event scales viewBox width/height
- [ ] Zoom: world point under pointer stays fixed after zoom (anchor stability)
- [ ] Zoom: clamped within min/max range
- [ ] Reset: viewBox returns to initial fit-to-viewport values
- [ ] All camera changes update the SVG viewBox attribute (verified by reading `svg.getAttribute("viewBox")`)

---

### Phase 1f: Responsive Resize

**Scope:**
- Attach `ResizeObserver` to the container element
- On resize: recalculate viewport dimensions, update viewBox aspect ratio
- If resize crosses a responsive breakpoint (RU-D10): rebuild `WindowIndices` with new bounds, re-render grid
- Debounce resize to avoid excessive re-renders (e.g., 150ms)

**File:** update `RENDERING_UI/src/renderer.ts`

**Tests:**
- [ ] Simulating container resize updates viewBox dimensions
- [ ] ViewBox aspect ratio matches container aspect ratio after resize
- [ ] Crossing breakpoint (e.g., 1024px → 700px) triggers window rebuild with smaller bounds
- [ ] Grid element count decreases after downsizing to a smaller window
- [ ] ResizeObserver is disconnected on `destroy()`

---

### Phase 1 Completion Tests

- [ ] Full integration: `initRenderer(container)` on a 1024px-wide container → renders ~24×24 grid with correct node labels
- [ ] Full integration: same on a 375px-wide container → renders ~12×12 grid
- [ ] Pan and zoom work after initial render
- [ ] Reset returns to initial view
- [ ] All node labels are correct pitch-class names for their lattice position (spot-check 10+ nodes)
- [ ] No console errors or warnings
- [ ] `destroy()` removes all SVG elements and event listeners
- [ ] No runtime dependencies (verify `package.json` has zero `dependencies`, only `devDependencies`)

---

## Decision Log (Module-Level)

```
RU-DEV-D1: Phase 0 UX resolution required before implementation
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision: All UX interaction ambiguities (edge gesture, adjacent triangle mechanics,
drag-vs-edge conflict, sustain behavior, progression dismissal) resolved before
any Rendering/UI code is written.
Rationale: Per GOVERNANCE.md — "Interaction Architecture precedes module implementation."
Revisit if: Never — foundational decision.
```

```
RU-DEV-D2: API type signatures deferred to post-implementation
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision: ARCH_RENDERING_UI §11 defines a draft interface contract. Full TypeScript
signatures will be specified after initial implementation, matching Harmony Core's
approach.
Rationale: Rendering has more implementation unknowns than Harmony Core's pure-logic
algebra. Draft contract gives other modules enough to plan against.
Revisit if: Another module needs precise type contracts before Rendering/UI is complete.
```

```
RU-DEV-D3: Harmony Core consumed as local path dependency
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision: Rendering/UI's package.json references Harmony Core via
"harmony-core": "file:../HARMONY_CORE". Types and functions imported directly.
Rationale: Monorepo-style path import is simplest for local development. No build
step needed on HC side for type access (TS project references or direct source
import). Consistent with single-repo structure.
Revisit if: Modules are split into separate repositories.
```

```
RU-DEV-D4: jsdom/happy-dom for SVG unit testing
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision: Use Vitest with happy-dom (or jsdom) environment for testing SVG rendering.
Coordinate transform functions tested in default node environment (pure math).
Rationale: SVG rendering tests need a DOM. happy-dom is lighter than jsdom and
supports SVG namespacing. Vitest supports per-file environment configuration.
Revisit if: happy-dom SVG support proves insufficient; fall back to jsdom.
```

---

## Future Phases (to be detailed after Phase 1 completion)

| Phase | Scope | Depends On |
|-------|-------|------------|
| 2 | Interaction layer — proximity-circle hit-testing, drag/tap distinction, selection state | Phase 1 |
| 3 | Shape rendering — triangle fills, extension fills, dot clusters, root marker | Phase 1, Phase 2 |
| 4 | Progression path rendering — centroid path, playback animation, clear button | Phase 3 |
| 5 | Layout integration — control panel, toolbar, responsive resize | Phase 1 |
| 6 | Public API assembly, type signatures, integration tests | All above |

---

## Summary

| Step | Scope | Key Files | Key Functions |
|------|-------|-----------|---------------|
| 1a | Project scaffolding | package.json, tsconfig, vitest.config | — |
| 1b | Coordinate transforms | src/coords.ts | `latticeToWorld`, `worldToLattice` |
| 1c | Camera & viewport math | src/camera.ts | `computeWindowBounds`, `computeInitialCamera`, `computeViewBox`, `applyPan`, `applyZoom` |
| 1d | SVG scaffold & grid rendering | src/svg-helpers.ts, src/renderer.ts | `svgEl`, `setAttrs`, `createSvgScaffold`, `renderGrid` |
| 1e | Camera interaction | src/camera-interaction.ts | pointer/wheel handlers, reset |
| 1f | Responsive resize | src/renderer.ts | ResizeObserver wiring, breakpoint detection |
