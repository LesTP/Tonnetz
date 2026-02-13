# UX_SPEC.md

Version: Draft 0.3
Date: 2026-02-13

---

## 1. Purpose

Defines interaction vocabulary, visual encoding rules, layout zones, and interface behavior contracts for the Tonnetz Interactive Harmonic Explorer.
Serves as the authoritative cross-module UX reference.

---

## 2. Interaction Vocabulary

### Camera navigation

* Drag background → pan
* Scroll / pinch → zoom
* Reset control → reset view

### Harmonic interaction

* Hover triangle → highlight (desktop)
* Tap/click triangle → play triad
* Press-hold triangle → sustain
* Drag across triangles → scrub playback (trigger on triangle change)
* Edge selection → play union chord (union of two adjacent triangles; typically 4 pitch classes)
* Node selection → single pitch preview (future)

### Progression interaction

* Paste progression → render path
* Play/Stop/Loop progression
* Step forward/back through chords

---

## 3. Visual Encoding Rules

* Main triad → bright fill
* Extension triangles → pale fill
* Non-triangulated tones → dot markers
* Dot-only chords (e.g., diminished and augmented triads) → cluster of dot markers near focus
* Selected chord → highlighted cluster
* Root tone → distinct outline on root vertex
* Progression path → centroid-connected overlay

---

## 4. Layout Zones

The interface is organized into three primary zones:

| Zone           | Function                                    |
| -------------- | ------------------------------------------- |
| Central Canvas | Tonnetz lattice, interaction surface        |
| Control Panel  | progression input, playback controls, tempo |
| Toolbar        | view reset, optional overlays, mode toggles |

Layout must remain responsive:

* control panel collapsible on small screens
* canvas remains primary focus element

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

* Idle → Chord Selected (triangle or edge interaction)
* Idle → Progression Loaded (paste/import)
* Progression Loaded → Playback Running (play)
* Playback Running → Progression Loaded (stop)

Audio and renderer must react deterministically to these states.

---

## 6. Interaction Timing Rules

* Interactive playback: immediate
* Scheduled playback: shared transport timebase
* Pointer movement sampled per animation frame
* Retrigger only on triangle change

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

Harmony Core:

* `Shape` includes:

  * `root_vertex_index` (nullable for dot-only shapes)
  * `centroid_uv`
* `getEdgeUnionPcs(edgeId, indices)` computes union pitch-class set for edge selection

Rendering/UI:

* supports centroid path rendering
* exposes triangle/edge/node hit identifiers
* edge hit targets correspond to shared edges between two triangles (boundary edges excluded)

Audio:

* supports immediate playback and scheduled playback modes
* edge selection triggers 4-note playback (union of two triads)

Persistence:

* supports progression structures compatible with playback scheduling

---

## 9. Accessibility Baselines

* touch-sized interaction targets
* keyboard navigation (future)
* sufficient visual contrast for triad vs extension encoding
* dot-cluster markers distinguishable from triangle fills

---

## 10. Future UX Extensions

* roman numeral overlay
* tonal center highlighting
* harmonic heatmaps
* guided harmonic navigation
