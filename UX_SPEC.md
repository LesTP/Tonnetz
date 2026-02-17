# UX_SPEC.md

Version: Draft 0.5
Date: 2026-02-13

---

## 1. Purpose

Defines interaction vocabulary, visual encoding rules, layout zones, and interface behavior contracts for the Tonnetz Interactive Harmonic Explorer.
Serves as the authoritative cross-module UX reference.

---

## 2. Interaction Vocabulary

### Gesture Classification

All pointer/touch interactions are classified by movement:

* **Tap/click** — pointer down + pointer up with movement below drag threshold (~5px or platform default). Eligible for triangle selection and edge-proximity selection.
* **Drag** — pointer down + movement exceeds drag threshold. Always triggers **camera pan** regardless of start position (triangle, edge, or background). Audio and selection events are not fired during drag.
* **Press-hold** — pointer down, chord plays immediately and sounds for the duration of the hold. There is no distinct sustain mode; "sustain" is simply the natural result of holding the pointer down. If the user begins dragging after holding, pan begins once the drag threshold is exceeded and the chord stops on pointer-up. (UX-D4)

### Camera navigation

* Drag (any start position) → pan
* Scroll / pinch → zoom
* Reset control → reset view

### Harmonic interaction

* Hover triangle → highlight (desktop)
* Tap/click triangle → play triad
* Hold triangle → chord sounds for duration of hold (release stops)
* Tap/click near shared edge → play union chord (see Hit-Testing Model below) (UX-D1)
* Node selection → single pitch preview (future)

### Hit-Testing Model (UX-D1)

Interaction hit-testing uses a **proximity circle** centered on the pointer position. The circle radius is 0.12 world units (approximately 12% of the triangle edge length), sized to fit comfortably inside a triangle without reaching nearby edges.

* If the circle is **entirely enclosed** by a single triangle → that triangle's triad is selected
* If the circle **crosses a shared edge** between two triangles → union chord of both triangles (4 pitch classes) is selected
* If the circle is **centered near a node** and overlaps three or more triangles → behavior is undefined for MVP (treat as nearest-triangle selection)
* **Boundary edges** (only one adjacent triangle) never produce union chords — the circle must cross a shared interior edge

The same proximity radius is used for **visual highlighting**, **audio hit-testing**, and the **proximity cursor** display — all three are synchronized.

### Progression interaction

* Paste progression → render path
* Play/Stop/Loop progression
* Step forward/back through chords
* Clear button → dismiss progression and return to Idle Exploration (UX-D5)

---

## 3. Visual Encoding Rules

* Main triad → bright fill (red for major/Up, blue for minor/Down)
* Extension triangles → pale fill (same color scheme, half intensity)
* Non-triangulated tones → dot markers
* Dot-only chords (e.g., diminished and augmented triads) → cluster of dot markers near focus
* Selected chord → highlighted cluster (same color scheme as fills)
* Root tone → distinct outline on root vertex (bold, darker shade)
* Progression path → centroid-connected overlay
* Union chord (edge selection) → both adjacent triangles highlighted
* **Dot-only chords** (dim, aug, m7b5, dim7): highlighted as node circle strokes + connecting edge strokes using the **greedy chain** nearest-node algorithm (nearest to shape centroid, then each subsequent dot nearest to already-picked nodes). Only one node per pitch class highlighted.
* **Dot-only color rule:** dim/m7b5 (minor 3rd) → blue (minor palette); aug (major 3rd) → red (major palette)
* Node labels → dark grey (`#555`); enharmonic nodes show sharp name on top, flat name on bottom (e.g., D# / Eb)

### At-Rest vs Playing States

The grid uses a **mutate-grid** approach: playing state is achieved by changing existing grid element attributes (fill, stroke, stroke-width) directly, rather than creating overlay elements. This ensures node circles remain visually on top of triangle fills.

**At rest (idle):**

| Element | Fill | Stroke | Stroke Width |
|---------|------|--------|-------------|
| Major (Up) triangle | pale red, 0.45 opacity | light grey (`#d0d0d0`) | 0.01 |
| Minor (Down) triangle | pale blue, 0.45 opacity | light grey (`#d0d0d0`) | 0.01 |
| Edge lines | — | grey (`#bbb`) | 0.02 |
| Node circles | light grey (`#e8e8e8`) | grey (`#bbb`) | 0.02 |

**Playing (active):**

| Element | Fill | Stroke | Stroke Width |
|---------|------|--------|-------------|
| Major (Up) main triangle | opaque red (`#c84646`) | none | — |
| Minor (Down) main triangle | opaque blue (`#5082d2`) | none | — |
| Extension triangles | lighter opaque (major `#d99a9a`, minor `#9ab5d9`) | none | — |
| Edge lines | — | colored (major `#b05050`, minor `#5070b0`) | 0.035 |
| Non-root node circles | unchanged fill | colored (major `#b05050`, minor `#5070b0`) | 0.035 |
| Root node circle | unchanged fill | dark colored (major `#7a1515`, minor `#153a7a`) | 0.05 |

**Visual continuity rules:**
* At rest: edges and node circles share the same grey shade (`#bbb`) and stroke width (`0.02`)
* Playing: edges and non-root node circles share the same colored shade and stroke width (`0.035`)
* Triangle polygon stroke is set to `none` when active to prevent double-line overlap with edge `<line>` elements

---

## 4. Layout Zones

The interface is organized into two primary zones with responsive behavior:

| Zone           | Function                                    |
| -------------- | ------------------------------------------- |
| Sidebar        | Title/branding, progression input, library browser, playback controls + tempo, info/about button |
| Central Canvas | Tonnetz lattice, interaction surface        |

### Responsive Behavior

| Breakpoint | Sidebar | Canvas |
|------------|---------|--------|
| Desktop (≥768px) | Permanent left panel, always visible | Fills remaining width |
| Mobile (<768px) | Hidden by default; revealed via hamburger (☰) button as overlay/dropdown | Full width; interaction unaffected by sidebar state |

- Hamburger button positioned at top-left corner on mobile
- Sidebar dismisses on: outside tap, hamburger tap, or Escape key
- Canvas viewport dynamically resizes when sidebar appears/disappears on desktop
- Mobile sidebar overlays the canvas without resizing it

### Sidebar Content Order (top to bottom)

1. **Header (persistent across tabs)**
   - **Title / branding** — "Tone Nets" with subtitle "an interactive Tonnetz explorer" (POL-D2)
   - **Info buttons** — `?` (How to Use) and `ⓘ` (What This Is), right-aligned next to title → open full-viewport overlay modals (POL-D8)
   - **Tab bar** — two tabs: `▶ Play` (default) | `📚 Library`

2. **Tab: Play** (doing — active controls)
   - **Active chord display** — compact single-line showing current chord name (POL-D10)
   - **Progression input** — textarea for paste/type, Load button
   - **Playback controls** — standard transport icons (POL-D11):
     - ▶ Play, ■ Stop, 🔁 Loop (toggle), ✕ Clear
   - **Tempo controller** — slider (40–240 BPM) + BPM display + Italian tempo marking (Largo, Adagio, Andante, Moderato, Allegro, Vivace, Presto, Prestissimo — updates dynamically with BPM)

3. **Tab: Library** (choosing — browse and select)
   - **Filter tabs** — All | By Genre | By Harmonic Feature
   - **Scrollable entry list** — expandable accordion cards (POL-D12):
     - Summary: title, composer, genre badge, chord preview
     - Detail (expanded): comment, roman numerals, tempo, full chords, Load button
   - Selecting "Load" from a card → loads progression + auto-switches to Play tab

4. **Info overlay modals** (full-viewport, not sidebar content; POL-D8)
   - `?` → "How to Use": interaction guide, keyboard shortcuts, supported chord symbols, input tips, library usage
   - `ⓘ` → "What This Is": Tonnetz history & theory, harmonic geometry, credits/author

### 4b. Progression Library

Bundled library of ~25 curated progressions. Static data (not user-generated; user save/load is PD's domain).

**Three browsing views:**
1. **All (alphabetical)** — flat list sorted by title
2. **By genre** — grouped/filtered by genre tag
3. **By harmonic feature** — grouped/filtered by harmonic feature tag (e.g., "ii-V-I", "chromatic mediant", "tritone sub")

**Per-entry display:** title, composer (if present), genre badge, first few chords as preview, comment (expandable or tooltip).

**Interaction:** selecting an entry loads the progression into the pipeline (same as paste).

---

### Legacy Layout (superseded)

The previous three-zone layout (Toolbar, Canvas, Control Panel) implemented via `createLayoutManager()` and `createControlPanel()` in RU is superseded by the sidebar design. See POL-D1 for implementation approach.

---

## 5. UI State Model

Primary interface states:

| State              | Description                            |
| ------------------ | -------------------------------------- |
| Idle Exploration   | user freely explores lattice           |
| Chord Selected     | chord cluster highlighted and playable |
| Progression Loaded | progression path displayed             |
| Playback Running   | scheduled playback active              |

State transitions:

* Idle → Chord Selected (triangle or edge-proximity interaction)
* Idle → Progression Loaded (paste/import)
* Chord Selected → Progression Loaded (paste/import dismisses current selection)
* Progression Loaded → Playback Running (play)
* Playback Running → Progression Loaded (stop)
* Playback Running → Playback Running (tap/click is ignored during active playback; user must stop first) (UX-D6)
* Progression Loaded → Idle Exploration (clear button) (UX-D5)
* Chord Selected → Idle Exploration (tap empty space or timeout)

Audio and renderer must react deterministically to these states.

---

## 6. Interaction Timing Rules

* Interactive playback: immediate (chord sounds on pointer-down, stops on pointer-up; async race protection via generation counter)
* Scheduled playback: shared transport timebase (see ARCH_AUDIO_ENGINE.md §5)
* Drag threshold: ~5px pointer movement or platform default; below threshold = tap, above = pan

---

## 7. Progression Focus Policy

When a progression is loaded and rendered as a path, chord placement uses **chain focus**:

* The first chord is placed relative to the current viewport center (initial focus).
* Each subsequent chord uses the preceding chord shape's centroid as its placement focus.
* If the progression path drifts beyond the visible viewport, the user corrects via pan/zoom.

See HC-D11 in ARCH_HARMONY_CORE.md.

---

## 8. Cross-Module Interface Requirements

UX introduces the following interface expectations:

### Harmony Core

| Requirement | API | Status |
|-------------|-----|--------|
| Shape centroid for path rendering | `Shape.centroid_uv` | ✅ Implemented |
| Root vertex identification | `Shape.root_vertex_index` (nullable for dot-only) | ✅ Implemented |
| Edge union pitch classes | `getEdgeUnionPcs(edgeId, indices)` | ✅ Implemented |

### Rendering/UI

| Requirement | API | Status |
|-------------|-----|--------|
| Centroid path rendering | `renderProgressionPath(layer, shapes, options)` | ✅ Implemented |
| Progression path clearing | `clearProgression(handle)` | ✅ Implemented |
| Active chord highlight | `PathHandle.setActiveChord(index)` | ✅ Implemented |
| Proximity-circle hit testing | `hitTest(worldX, worldY, radius, indices)` | ✅ Implemented |
| Triangle/edge hit classification | `HitResult` (discriminated union: HitTriangle \| HitEdge \| HitNone) | ✅ Implemented |
| UI state machine | `createUIStateController()` | ✅ Implemented |
| Clear button integration | `UIStateController.clearProgression()` + `ControlPanel` | ✅ Implemented |
| Layout zones | `createLayoutManager(options)` | ✅ Implemented |
| Control panel | `createControlPanel(options)` | ✅ Implemented |
| Toolbar | `createToolbar(options)` | ✅ Implemented |

### Audio Engine

| Requirement | API | Status |
|-------------|-----|--------|
| Immediate playback mode | `createImmediatePlayback(transport)`, `playShape(state, shape)`, `playPitchClasses(state, pcs)`, `stopAll(state)` | ✅ Implemented |
| Scheduled playback mode | `AudioTransport` interface (play/stop/pause/setTempo/scheduleProgression) | ✅ Implemented |
| Chord change events | `AudioTransport.onChordChange()` | ✅ Implemented |
| 4-note edge-proximity playback | Integration module wiring (`InteractionCallbacks` → `playPitchClasses`) | ✅ Implemented |

### Persistence

| Requirement | API | Status |
|-------------|-----|--------|
| Progression serialization | `saveProgression()` / `loadProgression()` / `encodeShareUrl()` / `decodeShareUrl()` | ✅ Implemented |

---

## 9. Accessibility Baselines

* touch-sized interaction targets (proximity circle provides generous hit area)
* keyboard navigation (future)
* sufficient visual contrast for triad vs extension encoding
* dot-cluster markers distinguishable from triangle fills

---

## 10. Future UX Extensions

* roman numeral overlay
* tonal center highlighting
* harmonic heatmaps
* guided harmonic navigation
* node-proximity interaction (three-triangle overlap at node — currently undefined)
* theming architecture — customizable color palette for triangle fills, dots, path, highlights, grid (target: module assembly phase)

---

## 11. UX Decision Log

```
UX-D1: Proximity-circle hit-testing model
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
Hit-testing uses a proximity circle (~half triangle edge length) centered on the pointer.
Circle enclosed by one triangle → triad. Circle crosses shared edge → union chord.
Boundary edges excluded. Node overlap (3+ triangles) undefined for MVP.
Rationale:
Provides generous touch targets. Unifies triangle and edge selection into a single
spatial model. Avoids separate edge hit targets with small tap areas.
Revisit if: Mobile testing reveals the proximity radius needs tuning, or node overlap
becomes musically useful.
```

```
UX-D2: Adjacent triangle selection is edge selection
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
"Adjacent triangle selection" in SPEC.md is a synonym for edge selection, not a
distinct interaction. Remove as separate functional requirement.
Rationale:
Edge selection (union chord of two adjacent triangles) already covers the same
behavior. A separate "adjacent triangle" interaction would duplicate it with a
different gesture for no added value.
Revisit if: Multi-select interaction (building extensions interactively) is added
in a future phase.
```

```
UX-D3: Drag-scrub removed — all drag is camera pan
Date: 2026-02-16
Status: Superseded
Priority: Important
Original decision (2026-02-13):
Dragging across triangles plays sequential triads (scrub mode). Drag starting on
background pans the camera.
Revised decision (2026-02-16):
Scrub mode removed entirely. ALL drag gestures trigger camera pan, regardless of
whether the pointer starts on a triangle, edge, or background. This makes panning
reliable at every zoom level and removes the low-utility scrub feature.
Rationale:
User testing showed scrub was not useful in practice, and it competed with panning
for the drag gesture — especially at high zoom where triangles cover most of the
viewport, making it difficult to find empty background to start a pan.
Revisit if: A future interaction design needs drag-to-play (e.g., mobile two-finger
scrub while single-finger pans).
```

```
UX-D4: No distinct sustain mode
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Press-hold is not a separate sustain mode. The chord sounds on pointer-down and
stops on pointer-up. If the user begins dragging after holding, pan mode begins
once the drag threshold is exceeded.
Rationale:
Simplest model. "Sustain" is the natural result of holding the pointer down.
No mode transition ambiguity between hold and drag.
Revisit if: Musicians request a latch/sustain toggle for hands-free exploration.
```

```
UX-D5: Progression dismissal via clear button
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
A visible Clear button in the control panel dismisses the loaded progression and
returns the UI to Idle Exploration state.
Rationale:
Explicit, always discoverable, works on both desktop and mobile.
Keyboard shortcut (Escape) may be added later as a convenience.
Revisit if: User testing shows a need for additional dismissal gestures.
```

```
UX-D6: Interaction suppressed during active playback
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Tap/click interactions on the lattice are suppressed while scheduled playback is
running. The user must stop playback before selecting new chords or edges.
Drag interactions (pan/zoom) remain available during playback.
Rationale:
Prevents conflicting audio triggers (interactive vs scheduled). Keeps the
playback state machine simple. Pan/zoom is harmless during playback and useful
for following a long progression path.
Revisit if: Users request the ability to interrupt playback by tapping a chord.
```
