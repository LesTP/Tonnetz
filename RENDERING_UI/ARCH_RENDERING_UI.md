# ARCH_RENDERING_UI.md

Version: Draft 0.5
Date: 2026-02-13

---

## 1. Purpose and Scope

Rendering/UI subsystem is responsible for:

* visual rendering of the Tonnetz lattice
* interaction handling (triangle, edge, node selection)
* animation of chord shapes and progression paths
* coordinate transforms between Tonnetz lattice space and screen space
* UI overlays, layout integration, and camera control (pan/zoom)

Non-goals: harmonic computation (Harmony Core), audio synthesis (Audio Engine), persistence logic.

---

## 2. Rendering Model

The renderer displays a **finite visible window** of the infinite Tonnetz lattice provided by Harmony Core.

Rendering layers (implemented as nested `<g>` groups in the SVG, RU-D12):

1. `<g id="layer-grid">` — lattice grid layer (static)
2. `<g id="layer-chords">` — triangle/chord layer (dynamic)
3. `<g id="layer-dots">` — node/dot layer (dynamic)
4. `<g id="layer-path">` — progression path layer (dynamic)
5. `<g id="layer-interaction">` — interaction overlay layer

Layer separation allows efficient updates of interactive elements without re-rendering the full grid.

---

## 3. Graphics Technology and Window Sizing

**RU-D1: Primary rendering technology**
Status: Closed
Decision: Use **SVG-based rendering** for MVP.

**RU-D10: Responsive window sizing**
Status: Closed

Window size in anchor coordinates adapts to the rendering surface:

| Surface | Window Size | Approximate Element Count |
|---------|-------------|--------------------------|
| Desktop (≥1024px viewport width) | 24×24 anchors | ~1,152 triangles, ~625 nodes |
| Tablet (~768px) | 18×18 anchors | ~648 triangles, ~361 nodes |
| Phone (<768px) | 12×12 anchors | ~288 triangles, ~169 nodes |

The window size is chosen so that individual triangles remain large enough for comfortable touch interaction. The renderer selects bounds at initialization based on container dimensions and a **minimum triangle screen size** threshold (e.g., triangle side ≥ ~40px on screen). If the container is resized across a breakpoint, the window can be rebuilt with new bounds.

Future option:

* hybrid Canvas/SVG rendering if scaling requires it.

---

## 4. Coordinate Transform Pipeline

**RU-D2: Transform ownership**
Status: Closed
Decision: Rendering/UI owns all coordinate transforms.

**RU-D10: Equilateral triangle geometry**
Status: Closed

The Tonnetz lattice uses integer coordinates `(u, v)` from Harmony Core. The renderer transforms these to world coordinates using an equilateral triangle layout:

```
worldX(u, v) = u + v * 0.5
worldY(u, v) = v * (√3 / 2)
```

This produces equilateral triangles with unit-length edges. The `v` axis is tilted 60° from the `u` axis, matching the standard Tonnetz visual convention.

The inverse transform (for hit-testing in Phase 2):

```
v = worldY / (√3 / 2)
u = worldX - v * 0.5
```

Full transform pipeline:

```
Lattice (u,v)  →  World (x,y)  →  Screen (sx,sy)
               equilateral        viewBox
               affine transform   mapping
```

**RU-D11: Fit-to-viewport scaling**
Status: Closed

Initial camera computes scale so the active window fills the container:

```
scale = min(containerWidth, containerHeight) / windowWorldExtent
```

A minimum triangle screen size is enforced (~40px side length) to ensure touch usability. If the computed scale would produce triangles smaller than this threshold, the window bounds are reduced (fewer anchors) rather than shrinking triangles.

Zoom is applied as a multiplier on this base scale via the SVG `viewBox`.

---

## 5. Interaction / Hit Testing

**RU-D3: Hit-testing model**
Status: Closed (updated by UX-D1)
Decision: Use **proximity-circle hit testing**.

Hit-testing uses a proximity circle centered on the pointer position. The circle radius is approximately half the triangle size.

* Circle **entirely enclosed** by one triangle → that triangle is selected (triad)
* Circle **crosses a shared interior edge** → both adjacent triangles are selected (union chord, 4 pitch classes)
* Circle **near a node** overlapping 3+ triangles → nearest-triangle selection for MVP (node overlap behavior undefined)
* **Boundary edges** (only one adjacent triangle) never produce union chords

This replaces the earlier "SVG element-based hit testing" decision. The proximity model unifies triangle and edge selection into a single spatial mechanism and provides generous touch targets on mobile.

See UX-D1 in UX_SPEC.md §11.

### Drag vs Tap Distinction (UX-D3)

Edge-proximity selection is **suppressed during drag**:

* **Tap/click** (pointer movement < ~5px threshold): eligible for both triangle selection and edge-proximity union chord
* **Drag** (pointer movement ≥ threshold): always triangle-scrub mode; crossing an edge during drag triggers two sequential triads, not a union chord

This prevents musically disruptive 4-note union chords from firing at every triangle boundary during scrub playback.

See UX-D3 in UX_SPEC.md §11.

---

## 6. Animation and Timing Model

**RU-D4: Timing synchronization model**
Status: Closed

* Interactive actions trigger immediate visual updates.
* Scheduled playback uses a **shared transport timebase** defined by the Audio Engine (see ARCH_AUDIO_ENGINE.md §5).

The renderer queries the Audio Engine's transport clock to synchronize chord highlighting and path animation with scheduled playback.

---

## 7. Interaction Sampling

**RU-D5: Pointer sampling model**
Status: Closed

* pointer movement processed using **requestAnimationFrame sampling**
* retrigger only when triangle selection changes
* pointer-down/pointer-up state tracked to distinguish tap from drag (UX-D3, UX-D4)
* chord sounds on pointer-down, stops on pointer-up (no distinct sustain mode)

---

## 8. Layout Integration

**RU-D6: Layout zone awareness**
Status: Closed

Renderer must support the layout zones defined in UX_SPEC:

* Central Canvas — Tonnetz interaction surface
* Control Panel — playback and progression input (includes Clear button for progression dismissal, UX-D5)
* Toolbar — view and overlay controls

Canvas viewport must dynamically resize when panels expand or collapse. Renderer re-renders on container resize (via internal `ResizeObserver`). If container resize crosses a responsive window breakpoint, the renderer may rebuild window indices with new bounds (RU-D10).

---

## 9. UI State Model Integration

**RU-D7: UI state consumption**
Status: Closed

Renderer reacts to UI controller state:

| UI State           | Rendering behavior            |
| ------------------ | ----------------------------- |
| Idle Exploration   | render lattice normally       |
| Chord Selected     | highlight selected Shape      |
| Progression Loaded | display progression path      |
| Playback Running   | animate active chord and path |

Renderer does not manage UI state internally.

State transition note: Progression Loaded → Idle Exploration is triggered by the Clear button (UX-D5). Renderer clears progression path and returns to normal lattice rendering.

---

## 10. Path Rendering Requirement

**RU-D8: Centroid-based path rendering**
Status: Closed

Progression paths must be rendered using **Shape centroid coordinates** supplied by Harmony Core.

Renderer:

* transforms centroid_uv to screen space
* draws path segments between centroids
* animates traversal during playback

---

## 11. Public API (Module Interface)

Draft interface contract. Full type signatures will be specified after initial implementation (similar to Harmony Core's post-implementation API expansion). See RU-D9.

### Render Commands

| Function | Description |
|----------|-------------|
| `initRenderer(container)` | Mount renderer into a DOM container element |
| `setCamera(position, zoom)` | Set camera position (world coordinates) and zoom level |
| `renderWindow(indices)` | Render the static lattice grid for the given window indices |
| `renderShape(shape)` | Render a chord Shape (triangles, extensions, dots, root marker) |
| `renderProgressionPath(shapes)` | Render centroid-connected path for a progression |
| `highlightTriangle(tri)` | Apply highlight style to a triangle |
| `highlightEdge(edgeId)` | Apply highlight style to a shared edge and both adjacent triangles |
| `renderDotCluster(pcs, position)` | Render dot markers for non-triangulated pitch classes |
| `clearHighlights()` | Remove all highlight styles |
| `clearProgression()` | Remove progression path and return to normal rendering |

### Interaction Events

| Function | Description |
|----------|-------------|
| `onTriangleSelect(callback)` | Register callback for triangle tap/click selection |
| `onEdgeProximity(callback)` | Register callback for edge-proximity selection (union chord) |
| `onPointerDown(callback)` | Register callback for pointer-down (immediate playback trigger) |
| `onPointerUp(callback)` | Register callback for pointer-up (playback stop) |
| `onDragScrub(callback)` | Register callback for drag-scrub triangle changes |

### Lifecycle

| Function | Description |
|----------|-------------|
| `resize()` | Recalculate layout and re-render (call on container resize, or use internal ResizeObserver) |
| `destroy()` | Clean up event listeners and DOM elements |

---

## 12. Camera Model

**RU-D13: ViewBox-based camera**
Status: Closed

Camera is implemented via SVG `viewBox` attribute manipulation:

* **Pan:** Translate the viewBox origin. Drag on background shifts viewBox `(minX, minY)`.
* **Zoom:** Scale viewBox `width` and `height`. Scroll/pinch adjusts the viewBox dimensions around the pointer position.
* **Reset:** Restore viewBox to the initial fit-to-viewport values.

ViewBox-based camera is native SVG behavior, avoids double-transform issues, and keeps coordinate math simple. All world-coordinate calculations remain valid regardless of camera state because SVG's built-in viewBox→viewport mapping handles the screen transform.

---

## 13. Runtime Dependencies

**RU-D14: Zero runtime dependencies**
Status: Closed

Rendering/UI has zero runtime dependencies. SVG elements are created via native DOM API (`document.createElementNS`). A thin internal SVG helper utility (`svgEl`, `setAttrs`) wraps repetitive element creation. No framework, no D3.

Consistent with Harmony Core's zero-dependency approach.

---

## 14. Decision Summary

* RU-D1 SVG rendering
* RU-D2 UI owns transforms
* RU-D3 Proximity-circle hit testing (updated from SVG element-based; incorporates UX-D1)
* RU-D4 Shared transport timing (timebase defined in ARCH_AUDIO_ENGINE.md)
* RU-D5 rAF pointer sampling
* RU-D6 Layout zone awareness (includes Clear button, UX-D5)
* RU-D7 UI state consumption (includes Progression Loaded → Idle transition)
* RU-D8 Centroid-based path rendering
* RU-D9 API signatures deferred to post-implementation (draft contract in §11)
* RU-D10 Equilateral triangle geometry + responsive window sizing
* RU-D11 Fit-to-viewport scaling with minimum triangle size enforcement
* RU-D12 Layered `<g>` groups from the start (5 layers per §2)
* RU-D13 ViewBox-based camera (pan/zoom via viewBox manipulation)
* RU-D14 Zero runtime dependencies (native DOM API + thin SVG helpers)

---

## 15. Module Decision Log

```
RU-D9: API type signatures deferred to post-implementation
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision:
Section 11 defines a draft interface contract (function names, descriptions, event
model). Full TypeScript type signatures will be specified after initial implementation,
matching the approach used for Harmony Core.
Rationale:
Rendering has more implementation unknowns (SVG structure, event wiring, proximity
geometry) than Harmony Core's pure-logic algebra. Premature type-level lock-in risks
churn. The draft contract gives other modules enough to plan against.
Revisit if: Another module begins implementation and needs precise type contracts
before Rendering/UI is complete.
```

```
RU-D10: Equilateral triangle geometry + responsive window sizing
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
Lattice-to-world transform uses equilateral layout:
  worldX(u, v) = u + v * 0.5
  worldY(u, v) = v * (√3 / 2)
Window size adapts to viewport: 24×24 (desktop), 18×18 (tablet), 12×12 (phone).
Selection is based on minimum triangle screen size (~40px side length).
Rationale:
Equilateral triangles are the standard Tonnetz visual convention. Musicians expect
this layout. The affine transform is trivial. Responsive window sizing ensures
triangles remain large enough for touch interaction on smaller screens.
Revisit if: Performance testing shows SVG element count needs further reduction on
low-end mobile devices.
```

```
RU-D11: Fit-to-viewport scaling
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Initial camera scale computed from container dimensions so the full window fills
the viewport. Minimum triangle screen size (~40px) enforced — if triangles would
be too small, window bounds are reduced rather than shrinking triangles.
Rationale:
Responsive by default. Works for any screen size without manual configuration.
Zoom adjusts from this computed baseline.
Revisit if: Users need explicit control over initial zoom level.
```

```
RU-D12: Layered SVG groups from the start
Date: 2026-02-13
Status: Closed
Priority: Normal
Decision:
Root SVG contains 5 nested <g> groups matching the rendering layers defined in §2.
Empty groups are created at initialization for future phases.
Rationale:
Zero cost now. Avoids restructuring the SVG tree when dynamic layers are added in
Phase 2–4. Layer groups provide natural z-ordering (later groups render on top).
Revisit if: Never — trivial structural decision.
```

```
RU-D13: ViewBox-based camera
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Pan and zoom implemented by manipulating the SVG viewBox attribute.
Pan shifts viewBox origin. Zoom scales viewBox dimensions.
Rationale:
Native SVG mechanism. Simpler than transform-on-group approach. No double-transform
issues. All world-coordinate calculations remain valid because SVG's viewBox→viewport
mapping handles the screen transform.
Revisit if: Edge cases with pointer coordinate mapping arise during hit-testing.
```

```
RU-D14: Zero runtime dependencies
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
No frameworks, no D3.js. SVG elements created via native DOM API
(document.createElementNS). Thin internal helper utilities for element creation.
Rationale:
Consistent with Harmony Core's zero-dependency approach. The SVG creation boilerplate
is minimal. Full control over the DOM tree. No bundler required for MVP.
Revisit if: Dynamic data-binding complexity makes a lightweight framework worthwhile.
```
