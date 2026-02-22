# ARCH_RENDERING_UI.md

Version: Draft 0.6
Date: 2026-02-22

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

The window size is chosen so that individual triangles remain large enough for comfortable touch interaction. The renderer selects bounds at initialization based on container dimensions and a **minimum triangle screen size** threshold (`MIN_TRI_SIZE_PX = 25`, revised from 40 in Phase 4a — roughly doubles the lattice on tablets). If the container is resized across a breakpoint, the window can be rebuilt with new bounds.

Future option:

* hybrid Canvas/SVG rendering if scaling requires it.

---

## 4. Coordinate Transform Pipeline

**RU-D2: Transform ownership**
Status: Closed
Decision: Rendering/UI owns all coordinate transforms.

**RU-D15: Equilateral triangle geometry**
Status: Closed

The Tonnetz lattice uses integer coordinates `(u, v)` from Harmony Core. The renderer transforms these to world coordinates using an equilateral triangle layout:

```
worldX(u, v) = u + v * 0.5
worldY(u, v) = v * (√3 / 2)
```

This produces equilateral triangles with unit-length edges. The `v` axis is tilted 60° from the `u` axis, matching the standard Tonnetz visual convention.

The inverse transform (used by hit-testing):

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

A minimum triangle screen size is enforced (`MIN_TRI_SIZE_PX = 25`, revised from 40 in Phase 4a) to ensure touch usability. If the computed scale would produce triangles smaller than this threshold, the window bounds are reduced (fewer anchors) rather than shrinking triangles.

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

All drag gestures trigger **camera pan**, regardless of start position (triangle, edge, or background). Audio and selection events are not fired during drag.

* **Tap/click** (pointer movement < ~5px threshold): eligible for both triangle selection and edge-proximity union chord
* **Drag** (pointer movement ≥ threshold): always camera pan — no audio, no selection events

See UX-D3 (Superseded) in UX_SPEC.md §11.

### Pinch-to-Zoom (RU-D18)

Two-finger touch gesture for camera zoom (Phase 4a). The gesture controller tracks active pointers via `Map<number, {x, y}>`. When a second pointer arrives:

1. Enters pinch mode — cancels any active drag/tap state
2. Stops audio (`onPointerUp` fired to trigger `stopAll`)
3. On each move with 2 pointers, computes scale factor from inter-pointer distance change
4. Fires `onPinchZoom(worldCenter, factor)` callback
5. Integration module wires this to `cameraController.zoom(factor, anchorX, anchorY)`

Pinch gestures prevent browser default behavior (`touchstart` with `{ passive: false }` + `preventDefault()`). Context menu suppressed on SVG via `contextmenu` event listener + `-webkit-touch-callout: none` CSS to prevent Android long-press dialogs.

---

## 6. Animation and Timing Model

**RU-D4: Timing synchronization model**
Status: Closed

* Interactive actions trigger immediate visual updates.
* Scheduled playback uses a **shared transport timebase** defined by the Audio Engine (see ARCH_AUDIO_ENGINE.md §5–6).

The renderer synchronizes with the Audio Engine via the `AudioTransport` interface:

* **Event-driven:** Subscribe to `onChordChange` for discrete chord highlight updates
* **Polling:** Query `getTime()` in rAF loop for smooth path progress animation

See ARCH_AUDIO_ENGINE.md §6.3 for the cross-module usage pattern.

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
Status: Closed (superseded by POL-D1/POL-D9)

Renderer must support the layout zones. The original three-zone layout (Toolbar, Canvas, Control Panel) via `createLayoutManager()`, `createControlPanel()`, and `createToolbar()` is superseded by the Integration module's `createSidebar()` (two-tab sidebar: Play | Library, with responsive hamburger overlay). The RU layout components remain exported for backward compatibility but are unused in the current application. See [SPEC.md — Appendix: Superseded APIs](../SPEC.md#appendix-superseded-apis) for the full supersession table.

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

* transforms `centroid_uv` to screen space
* draws path segments between centroids
* animates traversal during playback

Note: Harmony Core exports `CentroidCoord` as a type alias for `NodeCoord` when the coordinate represents a fractional centroid position (not an integer lattice node). This is a documentation-only distinction — both types are structurally identical `{ u: number, v: number }`.

---

## 11. Public API (Module Interface)

Draft interface contract. Full type signatures will be specified after initial implementation (similar to Harmony Core's post-implementation API expansion). See RU-D9.

### Implemented — Phase 1 & 2

Actual exported API surface from `src/index.ts`:

| Export | Type | Source | Description |
|--------|------|--------|-------------|
| `latticeToWorld(u, v)` | Function | `coords.ts` | Lattice→world equilateral transform |
| `worldToLattice(x, y)` | Function | `coords.ts` | World→lattice inverse transform |
| `screenToWorld(sx, sy, vbMinX, vbMinY, vbW, vbH, cW, cH)` | Function | `coords.ts` | Screen pixel→world coordinate conversion via viewBox (8-param legacy) |
| `screenToWorld(sx, sy, viewBox, cW, cH)` | Function | `coords.ts` | Screen pixel→world conversion (5-param overload) |
| `WorldPoint` | Type | `coords.ts` | `{ readonly x: number; readonly y: number }` |
| `ViewBoxLike` | Type | `coords.ts` | `{ readonly minX, minY, width, height: number }` |
| `LatticePoint` | Type | `coords.ts` | `{ readonly u: number; readonly v: number }` |
| `computeWindowBounds(cW, cH, minTriPx)` | Function | `camera.ts` | Responsive window bounds (RU-D10) |
| `computeInitialCamera(cW, cH, bounds)` | Function | `camera.ts` | Fit-to-viewport camera (RU-D11) |
| `computeViewBox(camera, cW, cH, bounds)` | Function | `camera.ts` | Camera state→SVG viewBox |
| `applyPan(camera, dx, dy, bounds?, clampFactor?)` | Function | `camera.ts` | Pan with optional boundary clamping (RU-DEV-D7) |
| `applyPanWithExtent(camera, dx, dy, extent, clampFactor?)` | Function | `camera.ts` | Pan with pre-computed extent (avoids recomputation) |
| `applyZoom(camera, factor, anchorX, anchorY)` | Function | `camera.ts` | Zoom with anchor stability |
| `CameraState` | Type | `camera.ts` | `{ centerX, centerY, zoom }` |
| `windowWorldExtent(bounds)` | Function | `camera.ts` | World-space bounding box of window |
| `pointsWorldExtent(points)` | Function | `camera.ts` | World-space bounding box from arbitrary points (POL-D20) |
| `computeBaseExtent(gridExtent, cW, cH)` | Function | `camera.ts` | Aspect-fit base dimensions (shared by `computeViewBox` and `fitToBounds`) |
| `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_ZOOM` | Consts | `camera.ts` | Zoom clamp bounds and fallback |
| `WorldExtent` | Type | `camera.ts` | `{ readonly minX, minY, maxX, maxY: number }` |
| `ViewBox` | Type | `camera.ts` | `{ minX, minY, width, height }` |
| `svgEl(tag, attrs?)` | Function | `svg-helpers.ts` | Create SVG-namespaced element |
| `setAttrs(el, attrs)` | Function | `svg-helpers.ts` | Set multiple attributes |
| `SVG_NS` | Const | `svg-helpers.ts` | SVG namespace string |
| `createSvgScaffold(container)` | Function | `renderer.ts` | Root SVG + 5-layer `<g>` scaffold |
| `renderGrid(layerGroup, indices)` | Function | `renderer.ts` | Static lattice grid rendering |
| `LAYER_IDS` | Const | `renderer.ts` | Layer group ID strings |
| `SvgScaffold` | Type | `renderer.ts` | Scaffold return type |
| `LayerId` | Type | `renderer.ts` | Layer ID union type |
| `createCameraController(svg, cW, cH, bounds)` | Function | `camera-controller.ts` | Sole viewBox writer (RU-DEV-D5) |
| `CameraController` | Type | `camera-controller.ts` | `{ getCamera, getViewBox, panStart, panMove, panEnd, zoom, fitToBounds, updateDimensions, reset, destroy }` |
| `createResizeController(container, scaffold, onResize?)` | Function | `resize-controller.ts` | ResizeObserver + debounce + breakpoint |
| `ResizeController` | Type | `resize-controller.ts` | `{ destroy }` |
| `ResizeCallback` | Type | `resize-controller.ts` | Resize event payload type |
| `hitTest(worldX, worldY, radius, indices)` | Function | `hit-test.ts` | Proximity-circle hit classification |
| `computeProximityRadius(factor?)` | Function | `hit-test.ts` | Radius in world units |
| `HitResult`, `HitTriangle`, `HitEdge`, `HitNone` | Types | `hit-test.ts` | Discriminated union result types |
| `createGestureController(options)` | Function | `gesture-controller.ts` | Tap/drag/pinch disambiguation (UX-D3, RU-D18) |
| `GestureController` | Type | `gesture-controller.ts` | `{ destroy }` |
| `GestureControllerOptions`, `GestureCallbacks` | Types | `gesture-controller.ts` | Options and callback types (includes `onPinchZoom`) |
| `createInteractionController(options)` | Function | `interaction-controller.ts` | Orchestration: gesture→hit-test→selection events |
| `InteractionController` | Type | `interaction-controller.ts` | `{ destroy }` |
| `InteractionControllerOptions`, `InteractionCallbacks` | Types | `interaction-controller.ts` | Options and callback types |

### Resolved — Phase 4b+ (originally deferred, now wired in Integration)

| Function | Resolution |
|----------|------------|
| Playback animation integration | ✅ Wired in `INTEGRATION/src/transport-wiring.ts`: `AudioTransport.onChordChange()` → `PathHandle.setActiveChord(index)` |
| Clear button wiring | ✅ Wired in `INTEGRATION/src/sidebar.ts`: Clear → `transport.cancelSchedule()` + `uiState.clearProgression()` + clear path + panel update |

### Implemented — Phase 5

| Export | Type | Source | Description |
|--------|------|--------|-------------|
| `createUIStateController()` | Function | `ui-state.ts` | UI state machine (idle, chord-selected, progression-loaded, playback-running) |
| `UIState` | Type | `ui-state.ts` | State union type |
| `UIStateController` | Type | `ui-state.ts` | Controller interface with state transitions and event subscription |
| `UIStateChangeEvent` | Type | `ui-state.ts` | Event payload (state, prevState, selectedShape, progression) |
| `UIStateChangeCallback` | Type | `ui-state.ts` | Callback type for state changes |
| `createControlPanel(options)` | Function | `control-panel.ts` | HTML control panel (progression input, Load/Play/Stop/Clear buttons) |
| `ControlPanel` | Type | `control-panel.ts` | Panel interface (show/hide, setProgressionLoaded, setPlaybackRunning) |
| `ControlPanelOptions` | Type | `control-panel.ts` | Options (container, callbacks) |
| `createToolbar(options)` | Function | `toolbar.ts` | HTML toolbar (Reset View button) |
| `Toolbar` | Type | `toolbar.ts` | Toolbar interface (show/hide/destroy) |
| `ToolbarOptions` | Type | `toolbar.ts` | Options (container, onResetView) |
| `createLayoutManager(options)` | Function | `layout-manager.ts` | Three-zone layout (toolbar, canvas, control panel) |
| `LayoutManager` | Type | `layout-manager.ts` | Layout interface (getContainers, toggleControlPanel) |
| `LayoutManagerOptions` | Type | `layout-manager.ts` | Options (root, onCanvasResize) |
| `injectCSS(id, css)` | Function | `css-utils.ts` | Deduplicated style injection (internal utility, exported for testing) |
| `HIDDEN_CLASS` | Const | `css-utils.ts` | Shared hidden class name (`"tonnetz-hidden"`) |

### Implemented — Phase 4a

| Export | Type | Source | Description |
|--------|------|--------|-------------|
| `renderProgressionPath(layerPath, shapes, options?)` | Function | `path-renderer.ts` | Render centroid-connected path for a progression |
| `clearProgression(handle)` | Function | `path-renderer.ts` | Remove progression path elements |
| `PathHandle` | Type | `path-renderer.ts` | Handle with `clear()`, `setActiveChord(index)`, `getChordCount()` |
| `PathRenderOptions` | Type | `path-renderer.ts` | Customization options (stroke, fills, markers) |

### Implemented — Phase 3

| Export | Type | Source | Description |
|--------|------|--------|-------------|
| `renderShape(layerChords, layerDots, shape, indices, options?)` | Function | `shape-renderer.ts` | Render Shape to chord/dot layers |
| `clearShape(handle)` | Function | `shape-renderer.ts` | Remove rendered shape elements |
| `ShapeHandle` | Type | `shape-renderer.ts` | Handle for clearing rendered shapes |
| `ShapeRenderOptions` | Type | `shape-renderer.ts` | Customization options (fills, root marker) |
| `highlightTriangle(layer, triId, indices, style?)` | Function | `highlight.ts` | Highlight single triangle |
| `highlightShape(layer, shape, indices, style?)` | Function | `highlight.ts` | Highlight entire Shape |
| `clearHighlight(handle)` | Function | `highlight.ts` | Clear single highlight |
| `clearAllHighlights(layer)` | Function | `highlight.ts` | Clear all highlights from layer |
| `HighlightHandle` | Type | `highlight.ts` | Handle for clearing highlights |
| `HighlightStyle` | Type | `highlight.ts` | Style customization options |

---

## 12. Camera Model

**RU-D13: ViewBox-based camera**
Status: Closed

Camera is implemented via SVG `viewBox` attribute manipulation:

* **Pan:** Translate the viewBox origin. Drag on background shifts viewBox `(minX, minY)`.
* **Zoom:** Scale viewBox `width` and `height`. Scroll (desktop) or pinch (touch, RU-D18) adjusts the viewBox dimensions around the pointer position. `CameraController.zoom(factor, anchorX, anchorY)` applies the zoom with anchor stability.
* **Reset:** Restore viewBox to the initial fit-to-viewport values.
* **Fit to bounds (POL-D20):** `CameraController.fitToBounds(extent, padding?)` centers camera on the extent midpoint and computes zoom to frame the padded extent. Used by the integration module to auto-center the viewport on progression load.

### Auto-Center on Progression Load (RU-D17, POL-D20)

After a progression is loaded and rendered as a path, the integration module auto-centers the camera to frame the entire progression:

1. Map shape centroids to world coordinates via `latticeToWorld()`
2. Compute extent via `pointsWorldExtent()`
3. Bias extent rightward by 1.0 world unit (chord shapes extend right of root centroids in the equilateral layout)
4. Call `camera.fitToBounds(biasedExtent)`

**`fitToBounds(extent, padding?)` details:**
- Hybrid padding: `margin = max(rawExtent × padding, 1.5)` — fractional 20% for large progressions, absolute floor (1.5 world units ≈ triangle edge + marker radius) for short ones
- Degenerate bbox (single chord) falls back to `DEFAULT_ZOOM`
- Zoom clamped to `[MIN_ZOOM, MAX_ZOOM]`

**Supporting functions:**
- `pointsWorldExtent(points): WorldExtent | null` — computes world-space bounding box from an array of `{x, y}` points. Peer to `windowWorldExtent`, arbitrary point input.
- `computeBaseExtent(gridExtent, containerWidth, containerHeight): { baseW, baseH }` — extracted aspect-fit base dimension logic (shared by `computeViewBox` and `fitToBounds`; DRYs the zoom-to-viewBox-size relationship).
- `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_ZOOM` exported from `camera.ts` (were module-private; needed by `fitToBounds` for clamping and fallback).

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
* RU-D10 Responsive window sizing
* RU-D15 Equilateral triangle geometry
* RU-D11 Fit-to-viewport scaling with minimum triangle size enforcement
* RU-D12 Layered `<g>` groups from the start (5 layers per §2)
* RU-D13 ViewBox-based camera (pan/zoom via viewBox manipulation)
* RU-D14 Zero runtime dependencies (native DOM API + thin SVG helpers)
* RU-D16 Defensive error handling (console warnings, no API changes)
* RU-D17 Auto-center camera on progression load (POL-D20)
* RU-D18 Pinch-to-zoom (two-finger touch gesture, Phase 4a)

---

## 15. Error Handling Strategy

**RU-D16: Defensive error handling without API changes**
Status: Closed

Rendering functions use defensive try/catch patterns to prevent rendering failures from crashing the application. Errors are logged to the console with contextual information but do not change function signatures or return types.

### Guiding Principles

1. **Fail gracefully** — A rendering error should not crash the app or leave the UI in an inconsistent state.
2. **Log with context** — Console warnings include the function name and relevant parameters to aid debugging.
3. **No API changes** — Functions maintain their existing signatures. Callers do not need to handle errors explicitly.
4. **Preserve partial state** — If a function partially completes before an error, clean up any partially-rendered elements.

### Implementation Pattern

Rendering functions wrap critical sections in try/catch:

```ts
function renderShape(layerChords, layerDots, shape, indices, options?) {
  const elements: SVGElement[] = [];
  try {
    // Render main triangle
    const mainEl = renderMainTriangle(shape, indices);
    elements.push(mainEl);
    layerChords.appendChild(mainEl);

    // Render extension triangles
    for (const ext of shape.ext_tris) {
      const extEl = renderExtTriangle(ext, indices);
      elements.push(extEl);
      layerChords.appendChild(extEl);
    }

    // ... continue rendering

    return { clear: () => elements.forEach(el => el.remove()) };
  } catch (err) {
    // Clean up any partially-rendered elements
    elements.forEach(el => el.remove());
    console.warn('[renderShape] Rendering failed:', err, { shape });
    // Return a no-op handle
    return { clear: () => {} };
  }
}
```

### Functions with Error Handling

| Function | Error Behavior |
|----------|----------------|
| `renderGrid` | Logs warning, returns without rendering. Grid layer remains empty. |
| `renderShape` | Logs warning, cleans up partial elements, returns no-op handle. |
| `renderProgressionPath` | Logs warning, cleans up partial elements, returns no-op handle. |
| `highlightTriangle` | Logs warning, returns no-op handle. |
| `highlightShape` | Logs warning, returns no-op handle. |
| `createLayoutManager` | Logs warning if DOM structure fails. Returns manager with degraded behavior. (Superseded — see [SPEC.md appendix](../SPEC.md#appendix-superseded-apis)) |
| `createControlPanel` | Logs warning if DOM structure fails. Returns panel with no-op methods. (Superseded — see [SPEC.md appendix](../SPEC.md#appendix-superseded-apis)) |
| `createToolbar` | Logs warning if DOM structure fails. Returns toolbar with no-op methods. (Superseded — see [SPEC.md appendix](../SPEC.md#appendix-superseded-apis)) |

### Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| Invalid input | `null` shape, missing indices | Log warning, return no-op/empty result |
| DOM failure | `appendChild` throws (detached node) | Log warning, clean up, return no-op |
| Coordinate error | `NaN` from transform (rare) | Log warning, skip element |

### Console Warning Format

Warnings use a consistent format for easy filtering:

```
[functionName] Brief description: <error message>
  { contextual data }
```

Example:
```
[renderShape] Rendering failed: Cannot read property 'main_tri' of undefined
  { shape: undefined }
```

### Testing Error Handling

Error handling is tested by:
- Passing invalid inputs (null, undefined, empty arrays)
- Verifying console warnings are emitted (via `vi.spyOn(console, 'warn')`)
- Verifying no-op handles are returned
- Verifying no partial DOM pollution

---

## 16. Module Decision Log

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
RU-D10: Responsive window sizing
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
Window size adapts to viewport: 24×24 (desktop), 18×18 (tablet), 12×12 (phone).
Selection is based on minimum triangle screen size (~40px side length).
Rationale:
Responsive window sizing ensures triangles remain large enough for touch
interaction on smaller screens.
Revisit if: Performance testing shows SVG element count needs further reduction on
low-end mobile devices.
```

```
RU-D15: Equilateral triangle geometry
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
Lattice-to-world transform uses equilateral layout:
  worldX(u, v) = u + v * 0.5
  worldY(u, v) = v * (√3 / 2)
Rationale:
Equilateral triangles are the standard Tonnetz visual convention. Musicians expect
this layout. The affine transform is trivial.
Revisit if: Never — foundational geometric convention.
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

```
RU-D17: Auto-center camera on progression load
Date: 2026-02-19
Status: Closed
Priority: Important
Decision:
After loading a progression, the camera auto-fits to frame the entire path.
CameraController.fitToBounds(extent, padding?) centers camera on the extent
midpoint and computes zoom to fit. Hybrid padding: fractional 20% for large
progressions, absolute floor (1.5 world units) for short ones.
Rationale:
Previous behavior required manual pan/zoom after loading a progression. Auto-center
makes the progression immediately visible without user intervention.
Revisit if: Users need to preserve camera position across progression loads.
```

```
RU-D18: Pinch-to-zoom
Date: 2026-02-21
Status: Closed
Priority: Important
Decision:
Two-finger touch gesture for camera zoom. Gesture controller tracks active
pointers, computes scale factor from inter-pointer distance change, fires
onPinchZoom callback. Audio stops on pinch start (same as drag). Context menu
suppressed on SVG to prevent Android long-press dialogs.
Rationale:
Pinch-to-zoom is the expected mobile gesture for spatial exploration. Without it,
users could only zoom via scroll wheel (unavailable on touch devices).
Revisit if: Three-finger gestures or other multi-touch interactions are needed.
```
