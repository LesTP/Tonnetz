# ARCH_RENDERING_UI.md

Version: Draft 0.3
Date: 2026-02-12

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

Rendering layers:

1. lattice grid layer (static)
2. triangle/chord layer (dynamic)
3. node/dot layer (dynamic)
4. progression path layer (dynamic)
5. interaction overlay layer

Layer separation allows efficient updates of interactive elements without re-rendering the full grid.

---

## 3. Graphics Technology

**RU-D1: Primary rendering technology**
Status: Closed
Decision: Use **SVG-based rendering** for MVP.

Default interactive window target:

* approximately **24×24 anchor coordinates** (configurable)

Future option:

* hybrid Canvas/SVG rendering if scaling requires it.

---

## 4. Coordinate Transform Ownership

**RU-D2: Transform ownership**
Status: Closed
Decision: Rendering/UI owns all coordinate transforms.

```
Tonnetz (u,v) → world coordinates → screen coordinates
```

Harmony Core operates purely in lattice coordinates.

---

## 5. Interaction / Hit Testing

**RU-D3: Hit-testing model**
Status: Closed
Decision: Use SVG element-based hit testing.

---

## 6. Animation and Timing Model

**RU-D4: Timing synchronization model**
Status: Closed

* Interactive actions trigger immediate visual updates.
* Scheduled playback uses a **shared transport timebase** shared with Audio Engine.

---

## 7. Interaction Sampling

**RU-D5: Pointer sampling model**
Status: Closed

* pointer movement processed using **requestAnimationFrame sampling**
* retrigger only when triangle selection changes

---

## 8. Layout Integration

**RU-D6: Layout zone awareness**
Status: Closed

Renderer must support the layout zones defined in UX_SPEC:

* Central Canvas — Tonnetz interaction surface
* Control Panel — playback and progression input
* Toolbar — view and overlay controls

Canvas viewport must dynamically resize when panels expand or collapse.

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

```
initRenderer(container)
setCamera(position, zoom)
renderWindow(indices)
renderShape(shape)
renderProgressionPath(path)
highlightTriangle(tri)
clearHighlights()
```

---

## 12. Decision Summary

* RU-D1 SVG rendering
* RU-D2 UI owns transforms
* RU-D3 SVG hit testing
* RU-D4 shared transport timing
* RU-D5 rAF pointer sampling
* RU-D6 layout zone awareness
* RU-D7 UI state consumption
* RU-D8 centroid-based path rendering
