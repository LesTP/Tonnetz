# UX_SPEC.md

Version: Draft 0.8
Date: 2026-02-25

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
* **Pinch** — two-finger gesture (touch only). Triggers **camera zoom** centered between the two pointers. Audio stops on pinch start (same as drag). Drag/tap states are cancelled when a second pointer arrives.
* **Press-hold** — pointer down, chord plays immediately and sounds for the duration of the hold. There is no distinct sustain mode; "sustain" is simply the natural result of holding the pointer down. If the user begins dragging after holding, pan begins once the drag threshold is exceeded and the chord stops on pointer-up. (UX-D4)

### Camera navigation

* Drag (any start position) → pan
* Scroll → zoom (desktop)
* Pinch → zoom (touch; two-finger gesture tracking via `onPinchZoom`)

### Harmonic interaction

* Hover triangle → highlight (desktop)
* Tap/click triangle → play triad
* Hold triangle → chord sounds for duration of hold (release stops)
* Tap/click near shared edge → play union chord (see Hit-Testing Model below) (UX-D1)
* Tap/click node → play single pitch (Phase 4e, POL-D29)

### Hit-Testing Model (UX-D1)

Interaction hit-testing uses a **proximity circle** centered on the pointer position. The circle radius is 0.12 world units (approximately 12% of the triangle edge length), sized to fit comfortably inside a triangle without reaching nearby edges.

* If the circle is **entirely enclosed** by a single triangle → that triangle's triad is selected
* If the circle **crosses a shared edge** between two triangles → union chord of both triangles (4 pitch classes) is selected
* If the circle is **centered near a node** and overlaps three or more triangles → behavior is undefined for MVP (treat as nearest-triangle selection)
* **Boundary edges** (only one adjacent triangle) never produce union chords — the circle must cross a shared interior edge

The same proximity radius is used for **visual highlighting**, **audio hit-testing**, and the **proximity cursor** display — all three are synchronized.

### Progression interaction

* Paste progression → press Play → render path + start playback (POL-D17: no separate Load step)
* Play/Stop/Loop progression
* Step forward/back through chords
* Clear button → dismiss progression, clear textarea, reset camera, and return to Idle Exploration (UX-D5, POL-D21)
* Share button → generate full URL + copy to clipboard (POL-D27)

> **Note:** POL-D* decisions referenced throughout this document originate from the MVP Polish module (see `MVP_POLISH/DEVLOG.md`). They are cited here when they modify UX contracts.

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
* **Dot-only chords** (dim, aug, m7b5, dim7): highlighted as node circle strokes + connecting edge strokes using the **greedy chain** nearest-node algorithm (nearest to shape centroid, then each subsequent dot nearest to already-picked nodes). Only one node per pitch class highlighted. Algorithm implemented in `INTEGRATION/src/grid-highlighter.ts`; anchor point is the shape's centroid (see POL-D13 for dot-only centroid rule, HC-D9 revised per POL-D15).
* **Centroid / path marker:** For all chord types, centroid_uv is the **root vertex position** (the lattice node whose pitch class matches the chord root). Progression path traces root motion. See HC-D9 (revised) in ARCH_HARMONY_CORE.md.
* **Active chord path label:** During progression playback, the active chord marker (orange circle) displays a compact chord symbol. Labels are shortened for space: `dim` → `o`, `m7b5` → `ø7`, `dim7` → `o7`, `maj7` → `△7`, `aug` → `+`, `add9` → `+9`. Enharmonic roots use the more common spelling: Bb over A#, Eb over D#, Ab over G#, Db over C#, F# over Gb. See `formatShortChordLabel()` in `RENDERING_UI/src/path-renderer.ts`.
* **Centroid marker note labels:** In root motion mode, each centroid dot displays a white note-name label (matching grid label font, white fill) so the grid label underneath remains readable despite the opaque marker. Two-character names (Eb, Bb, F#, Ab, Db) use a slightly smaller font than single-character names. In tonal centroid mode, labels are suppressed (centroid floats between nodes, no correct note name to show). Controlled by `PathRenderOptions.showCentroidLabels`.
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
| Sidebar        | Title/branding, progression input, library browser, playback controls + tempo, Staccato/Legato toggle, Share |
| Central Canvas | Tonnetz lattice, interaction surface |

### Responsive Behavior

| Breakpoint | Sidebar | Canvas |
|------------|---------|--------|
| Desktop (≥1024px) | Permanent left panel, always visible | Fills remaining width |
| Mobile/Tablet (<1024px) | Hidden by default; revealed via hamburger (☰) button as overlay/dropdown | Full width; interaction unaffected by sidebar state |

- Hamburger button positioned at top-left corner on mobile/tablet
- Sidebar dismisses on: outside tap, hamburger tap, or Escape key
- Canvas viewport dynamically resizes when sidebar appears/disappears on desktop
- Mobile sidebar overlays the canvas without resizing it; sidebar content scrollable with info footer pinned at bottom
- **Floating transport strip** (mobile only, POL-D24): Play/Stop, Loop, Share, Clear buttons below hamburger in canvas area. Visible when progression loaded + sidebar closed. Auto-syncs with sidebar button states.
- **Auto-hide on Play** (mobile, POL-D25): sidebar closes automatically when Play is tapped. Sidebar open/close is otherwise manual via hamburger only.
- Breakpoint raised from 768 to 1024 (POL-D23) — sidebar is always hamburger-overlay on phones and tablets in both orientations

### Sidebar Content Order (top to bottom)

1. **Header** (persistent, pinned above scroll)
   - **Title / branding** — "Tone Nets" (30px) with subtitle "an interactive Tonnetz explorer" (17px), centered, full-width
   - Separated from content below by thin grey border

2. **Controls section** (single scrollable panel, SB-D7)
   - **Progression input** — textarea for paste/type (no label; placeholder text serves as prompt)
   - **Playback controls + tempo** — single transport row (SB-D1, SB-D2, SB-D4):
     - ▶/■ Play/Stop toggle (single button, icon swaps on state), 🔁 Loop (geometric SVG cycle icon, toggle), 🔗 Share (link icon, POL-D27), ✕ Clear (icon, also resets camera + textarea, POL-D21), `[BPM]` tempo field (numeric input, 20–960, default 150)
   - **Settings row** — preset dropdown + playback mode toggle on one row:
     - Sound preset: dropdown (Cathedral Organ default)
     - Playback mode: "Staccato" ↔ "Legato" (click to toggle, POL-D19)
   - Separated from library below by thin grey border

3. **Library section** (scrolls with controls, SB-D5, SB-D7)
   - **Filter tabs** — All | By Genre | By Harmonic Feature
   - **Scrollable entry list** — expandable accordion cards with teal ▶ triangle (SB-D5):
     - Summary: title, composer, genre badge, chord preview, ▶ play button (right-aligned)
     - Detail (expanded): comment, tempo, harmonic features (informational only, no Load button)
     - Clicking ▶ triangle → loads + plays + closes sidebar on mobile
     - Clicking card text → expands/collapses detail

4. **Info buttons** (pinned at sidebar bottom, above border, POL-D18)
   - "How / to use" (pink) → interaction guide, keyboard shortcuts, supported chord symbols, input tips, library usage
   - "What / this is" (blue) → Tonnetz history & theory, harmonic geometry, credits/author
   - Open full-viewport overlay modals
   - Separated from library above by thin grey border

### 4b. Progression Library

Bundled library of 26 curated progressions. Static data (not user-generated; user save/load is PD's domain).

**Three browsing views:**
1. **All (alphabetical)** — flat list sorted by title
2. **By genre** — grouped/filtered by genre tag
3. **By harmonic feature** — grouped/filtered by harmonic feature tag (e.g., "ii-V-I", "chromatic mediant", "tritone sub")

**Per-entry display:** title, composer (if present), genre badge, first few chords as preview, comment (expandable or tooltip).

**Interaction:** selecting an entry loads the progression into the pipeline (same as paste).

---

> **Legacy note:** The previous three-zone layout APIs are superseded by the sidebar design (POL-D1). See [SPEC.md — Appendix: Superseded APIs](SPEC.md#appendix-superseded-apis).

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

* Idle → Chord Selected (triangle, edge-proximity, or node interaction)
* Idle → Progression Loaded (paste/import)
* Chord Selected → Progression Loaded (paste/import dismisses current selection)
* Progression Loaded → Chord Selected (triangle, edge-proximity, or node interaction — audio plays, highlight shown; progression path remains rendered) (POL-D28, revises INT-D6)
* Progression Loaded → Playback Running (play)
* Playback Running → Progression Loaded (stop)
* Playback Running → Playback Running (tap/click is ignored during active playback; user must stop first) (UX-D6)
* Progression Loaded → Idle Exploration (clear button) (UX-D5)
* Chord Selected → Idle Exploration (tap empty space or timeout)

Audio and renderer must react deterministically to these states.

### Gesture Sub-States

The macro states above do not model transient gesture mechanics. During **Chord Selected**, the following sub-sequence is handled entirely by the gesture controller and does not produce named state transitions:

1. **Pointer-down** on a triangle → chord begins sounding (enters Chord Selected)
2. **Hold** → chord continues sounding (still Chord Selected)
3. **Drag threshold exceeded** → chord stops, camera pan begins (still Chord Selected visually, but audio silenced and pan active)
4. **Pointer-up** → pan ends; state remains Chord Selected until timeout or next tap

This means Chord Selected can produce audio → silence → pan → silence within a single pointer lifecycle without transitioning to a different macro state. The gesture controller owns this lifecycle; the UI state machine only observes the net result (a Chord Selected state entered on pointer-down, potentially cleared on timeout). See UX-D4 for the design rationale.

**Implication for audio:** The Audio Engine receives `playPitchClasses()` on pointer-down and `stopAll()` when the drag threshold is crossed. There is no "pause" — it is a hard stop followed by pan. If the user releases without dragging, `stopAll()` fires on pointer-up instead. The gesture controller must guarantee exactly one `stopAll()` call per pointer lifecycle regardless of path taken (hold-only vs hold-then-drag).

**Implication for rendering:** The highlight applied on pointer-down should be cleared when drag begins (the user's intent has shifted from "play this chord" to "move the viewport"). This prevents stale highlights persisting during pan.

**Implication for state machine:** No changes needed. The macro state machine correctly ignores gesture internals. The gesture controller is the sole owner of the pointer-down → pointer-up lifecycle and makes its own stop/clear decisions without consulting UIStateController.

---

## 6. Interaction Timing Rules

* Interactive playback: immediate (chord sounds on pointer-down, stops on pointer-up; async race protection via generation counter)
* Scheduled playback: shared transport timebase (see ARCH_AUDIO_ENGINE.md §5)
* Drag threshold: ~5px pointer movement or platform default; below threshold = tap, above = pan

---

## 7. Progression Focus Policy

When a progression is loaded and rendered as a path, chord placement uses **blended chain focus** (refined in MVP Polish Entry 18):

* The first chord is placed relative to the current viewport center (initial focus).
* Each subsequent chord uses a blended focus: `CHAIN_BLEND` (0.61) × previous triangle centroid + (1 − CHAIN_BLEND) × running cluster center (mean of all placed centroids). The cluster center acts as a gravity well that keeps placements compact without lagging on modulating progressions.
* Distance-gated root reuse: when a root pitch class recurs within `REUSE_THRESHOLD` (1.5 world units) of its prior placement, the prior position is preferred (prevents visually confusing leaps for repeated roots).
* After path rendering, the camera auto-centers to frame the entire progression path (POL-D20, via `camera.fitToBounds()`).

See HC-D11 in ARCH_HARMONY_CORE.md. Known limitations: Giant Steps (symmetric tritone jumps) and Tristan chord Am placement require a future global optimizer.

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
| Triangle/edge/node hit classification | `HitResult` (discriminated union: HitTriangle \| HitEdge \| HitNode \| HitNone) | ✅ Implemented |
| Node proximity hit testing | `HitNode` type (`type, nodeId, pc, u, v`) + `NODE_HIT_RADIUS` (0.20) | ✅ Implemented |
| UI state machine | `createUIStateController()` | ✅ Implemented |
| Clear button integration | `UIStateController.clearProgression()` + `ControlPanel` | ✅ Implemented |

> Three legacy Rendering/UI APIs (`createLayoutManager`, `createControlPanel`, `createToolbar`) have been superseded. See [SPEC.md — Appendix: Superseded APIs](SPEC.md#appendix-superseded-apis).

### Audio Engine

| Requirement | API | Status |
|-------------|-----|--------|
| Immediate playback mode | `createImmediatePlayback(transport, options?)`, `playShape(state, shape)`, `playPitchClasses(state, pcs)`, `stopAll(state)` | ✅ Implemented |
| Audio initialization | `initAudio(options?)` (async), `initAudioSync(options?)` (sync, for iOS Safari) | ✅ Implemented |
| Scheduled playback mode | `AudioTransport` interface (play/stop/pause/setTempo/scheduleProgression/setPreset/setLoop) | ✅ Implemented |
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
* ~~node-proximity interaction (three-triangle overlap at node — currently undefined)~~ — node tap plays single pitch (Phase 4e); three-triangle overlap still undefined
* theming architecture — customizable color palette for triangle fills, dots, path, highlights, grid (target: module assembly phase)

---

## 11. UX Decision Log

```
UX-D1: Proximity-circle hit-testing model
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision:
Hit-testing uses a proximity circle (0.12 world units, ~12% of triangle edge length) centered
on the pointer. Circle enclosed by one triangle → triad. Circle crosses shared edge → union
chord. Boundary edges excluded. Node overlap (3+ triangles) undefined for MVP.
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
Clear button dismisses the loaded progression, clears the textarea input,
resets camera pan/zoom, and returns the UI to Idle Exploration state (POL-D21:
Clear absorbs Reset View).
Rationale:
Explicit, always discoverable, works on both desktop and mobile. Single button
for full reset reduces cognitive load.
Revisit if: Users need independent camera-reset vs progression-clear actions.
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

---

## Appendix: Superseded APIs

See [SPEC.md — Appendix: Superseded APIs](SPEC.md#appendix-superseded-apis) for the canonical list of superseded Rendering/UI APIs (`createLayoutManager`, `createControlPanel`, `createToolbar`, and associated types) replaced by `createSidebar()` in the Integration module (POL-D1).
