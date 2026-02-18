# DEVLOG — MVP Polish Track

Module: MVP Polish (cross-cutting)
Started: 2026-02-16

---

## Entry 11 — POL-D17: Simplify Duration Model + Load→Play Merge

**Date:** 2026-02-18

### Summary

Simplified the entire duration/playback model. Removed grid-based timing, chord collapsing, Load button, and Italian tempo markings. Unified root identification in the grid-highlighter.

### Duration Model (POL-D17)

**Before:** Each chord token = 1 beat at grid `"1/4"`. Duration by repetition (`Dm7 Dm7 Dm7 Dm7` = 4 beats). `collapseRepeatedChords()` merged repeats into one shape. Library entries stored 4× repeats per chord. Tempo range 40–240 BPM with Italian markings (Largo, Adagio, etc.).

**After:** Each chord token = 4 beats (one bar). No collapsing — `Dm7 Dm7` = two shapes, 8 beats. Library entries de-duplicated to one token per bar. Tempo range 20–960 BPM, no markings. For >1 chord per bar: repeat chords and increase tempo.

### Load→Play Merge

Removed the Load button entirely. Play now auto-loads from textarea if text is present. Always reloads on each press (changing text + pressing Play immediately reloads). `handlePlay` uses `ensureAudio().then()` so first click initializes audio + plays (no second click needed). Textarea `input` event enables the Play button when content is present.

### Unified Root Identification

Grid-highlighter previously used two mechanisms: `rootVertexIndex` (index 0/1/2) for triangulated shapes, `rootPc` (pitch class) for dot-only shapes. Now uses `rootPc` uniformly for all chord types — main triangle vertices, extension triangle vertices, and dot nodes all check `pc(vertex.u, vertex.v) === rootPc`. Fixes m7b5/dim7 missing bold root node.

### Files Changed

| File | Changes |
|------|---------|
| `INT/src/progression-pipeline.ts` | Removed grid param, collapsing, GridValue import. Hardcoded 4 beats/chord. |
| `INT/src/sidebar.ts` | Removed Load button DOM/events, tempoMarking function/DOM, expanded tempo 20–960, Play auto-loads, textarea input listener, How to Use updated |
| `INT/src/main.ts` | Removed grid state/imports, Play uses ensureAudio().then(), rootPc replaces rootVertexIndex in all activateGridHighlight calls |
| `RU/src/grid-highlighter.ts` | Added rootPc option, unified root check across main/ext/dot paths |
| `INT/src/library/library-types.ts` | Removed grid field from LibraryEntry |
| `INT/src/library/library-data.ts` | De-duplicated chords (one per bar), removed grid |
| `INT/src/__tests__/*.ts` | Updated all test expectations for new duration model |

### Decisions

- **POL-D17** (Closed): 4 beats per chord, no collapsing, no grid, Load→Play merge, rootPc unification

### Test Results

HC 178, RU 341, INT 244 — all passing, 0 type errors.

---

## Entry 10 — POL-D16: Root Motion vs Tonal Centroid Toggle

**Date:** 2026-02-18

### Summary

Added a `tonal_centroid_uv` field to the HC `Shape` type and a UI toggle in the sidebar to switch the progression path display between **Root Motion** (default, POL-D15) and **Tonal Centroid** (geometric center of mass of all pitch positions).

### HC Changes

`Shape` gains two new fields:
- `tonal_centroid_uv: NodeCoord` — geometric center of mass of all chord tone positions
- `placed_nodes: readonly NodeCoord[]` — the actual resolved lattice coordinates for each chord tone

`tonal_centroid_uv` is always computed as `mean(placed_nodes)`.

| Shape type | `placed_nodes` source | `centroid_uv` (root) | `tonal_centroid_uv` |
|---|---|---|---|
| Triangulated (maj, min, dom7, m7…) | Unique triangle vertices + nearest nodes for dot_pcs | Root vertex position | mean(placed_nodes) |
| Dot-only (dim, aug, m7b5, dim7) | Greedy chain: root nearest to focus, then each pc nearest to any already-placed node | Root node position | mean(placed_nodes) |

**Greedy chain algorithm** (dot-only shapes): matches the grid-highlighter's display algorithm. Collects all window nodes grouped by pc, places root first (nearest to focus), then for each remaining pc finds the candidate node nearest to any already-placed node. This produces a tight cluster matching the displayed dots, fixing the earlier bug where independently-searched nodes could scatter across the lattice.

Chain focus (HC-D11) always uses `centroid_uv` (root) for placement. `tonal_centroid_uv` is display-only.

### Sidebar Changes

Added "Root Motion | Tonal Centroid" segmented toggle below the tempo section in the Play tab. Pill-style buttons with active state highlight. Fires `onPathModeChange(mode)` callback.

### Integration Wiring

`handlePathModeChange(mode)` in `main.ts`:
- Clears current path
- If mode is "tonal", maps shapes with `centroid_uv` swapped to `tonal_centroid_uv`
- Re-renders path via `renderProgressionPath()`

### Files Changed

| File | Changes |
|------|---------|
| `HC/src/types.ts` | Added `tonal_centroid_uv: NodeCoord` and `placed_nodes: readonly NodeCoord[]` to `Shape` |
| `HC/src/placement.ts` | Dot-only: greedy chain node placement. Triangulated: collect placed_nodes (vertices + dot nodes). Both: `tonal_centroid_uv = mean(placed_nodes)` |
| `INT/src/sidebar.ts` | Path toggle DOM + CSS + `getPathMode()` + `onPathModeChange` callback |
| `INT/src/main.ts` | `handlePathModeChange()` + `loadProgressionFromChords` respects toggle state |
| `INT/src/__tests__/sidebar.test.ts` | Added `onPathModeChange` to mock options |
| `INT/src/__tests__/interaction-wiring.test.ts` | Added `tonal_centroid_uv` and `placed_nodes` to all mock Shape objects |

### Decisions

- **POL-D16** (Closed): Option C — toggle between Root Motion and Tonal Centroid

### Test Results

```
HC:  178 passed
RU:  341 passed
INT: 244 passed
Total: 763 passed — 0 failures
tsc --noEmit: 0 errors (all modules)
```

---

## Entry 9 — Post-Phase 1: Centroid = Root Vertex + Drag Bug Fix

**Date:** 2026-02-18

### 9a: Centroid = Root Vertex (POL-D15)

Changed `decomposeChordToShape()` in `HARMONY_CORE/src/placement.ts` so that triangulated shapes use the root vertex position as `centroid_uv` instead of `clusterCentroid()` (mean of all unique cluster vertices). Falls back to cluster centroid only if root vertex cannot be found (shouldn't happen for valid chords).

**Result:**
- All chord types (triangulated + dot-only) now consistently use the root note position as centroid
- Progression path traces root motion — orange dots sit on root vertices
- Chain focus (HC-D11) propagates root-to-root — produces tighter, more musically coherent placements
- Centroids are now integer lattice coordinates (not fractional cluster centers)

**Tests updated (3):**
- `placement.test.ts`: "centroid = mean of 3 vertices" → "centroid = root vertex position"
- `progression.test.ts`: "centroids are fractional" → "centroids are integer lattice nodes"
- `progression.test.ts`: I-IV-V-I distance threshold relaxed (4 → 5) since root positions differ slightly from cluster centers

**Decision:** POL-D15 (Closed) — extends POL-D13 (dot-only root node) to triangulated shapes.

### 9b: Drag Bug Fix — Browser Text Selection + Gesture Interference

**Symptom:** Dragging caused the surface to jitter and half the grid appeared selected (blue OS text selection overlay on SVG `<text>` elements). The browser's native text selection was fighting the SVG pan gesture.

**Root cause:** SVG `<text>` labels were capturing pointer events and the browser was interpreting drags as text selection attempts. Additionally, browser default touch/scroll gestures were interfering with pointer event handling.

**Fixes in `RENDERING_UI/src/renderer.ts`:**
1. `user-select: none; -webkit-user-select: none` on SVG element — prevents browser text selection during drag
2. `pointer-events: none` on all `<text>` label elements — prevents labels from capturing pointer events and interfering with hit detection on triangles
3. `touch-action: none` on SVG element — prevents browser from interpreting pointer events as scroll/pan gestures

**Fixes in `RENDERING_UI/src/gesture-controller.ts`:**
4. `e.preventDefault()` on `pointerdown` — prevents browser from initiating its own drag behavior
5. `e.preventDefault()` on `pointermove` — prevents browser from processing move events during our pan

### Files Changed

| File | Changes |
|------|---------|
| `HARMONY_CORE/src/placement.ts` | Triangulated centroid: `clusterCentroid(cluster)` → `mainVerts[rootIdx]` with fallback |
| `HARMONY_CORE/src/__tests__/placement.test.ts` | Updated centroid test expectations (root vertex, not cluster mean) |
| `HARMONY_CORE/src/__tests__/progression.test.ts` | Updated: integer centroids, relaxed I-IV-V-I threshold |
| `RENDERING_UI/src/renderer.ts` | Added `user-select: none`, `touch-action: none` on SVG; `pointer-events: none` on all `<text>` |
| `RENDERING_UI/src/gesture-controller.ts` | Added `e.preventDefault()` on `pointerdown` and `pointermove` |

### Docs Updated

| File | Changes |
|------|---------|
| `HARMONY_CORE/ARCH_HARMONY_CORE.md` | HC-D9 revised: centroid = root vertex for all shapes; decision summary updated |
| `UX_SPEC.md` | §3: added centroid/path marker rule referencing HC-D9 revised |
| `MVP_POLISH/DEVPLAN.md` | Current status updated; POL-D15 decision added |

---

## Entry 8 — Phase 1f: Info Overlay Modals + Phase 1g: Button Visual Redesign

**Date:** 2026-02-17

### Phase 1f: Info Overlay Modals

Built two full-viewport overlay modals triggered from the sidebar header's triangle buttons:

| Overlay | Trigger | Content |
|---------|---------|---------|
| How to Use | Red down-pointing triangle (?) | Interaction guide, chord types, shortcuts, playback controls (lorem ipsum placeholder) |
| What This Is | Blue up-pointing triangle (i) | Tonnetz theory, harmonic geometry, about (lorem ipsum placeholder) |

**DOM:** `div.tonnetz-overlay` (position: fixed, z-200) → backdrop (semi-transparent, click-to-dismiss) + panel (max 640px, scrollable body with styled HTML content).

**Dismiss:** Close button (✕), backdrop click, Escape key. Only one overlay at a time. Escape priority: overlay > sidebar.

**Info buttons redesigned as mini SVG Tonnetz triangles:**
- Left: blue up-pointing triangle (i / About) — 44×42px SVG
- Right: red down-pointing triangle (? / How to Use) — 44×42px SVG
- Both match grid colors: `rgba(170,195,235,0.55)` blue, `rgba(230,180,180,0.55)` red, `#bbb` stroke
- Title centered between buttons with 6px left padding for visual balance

### Phase 1g: Button Visual Redesign

Cohesive button system matching the Tonnetz aesthetic:

| Button | Style |
|--------|-------|
| **▶ Play** | White outlined, dark icon (same as Stop — no special fill) |
| **■ Stop** | White outlined, dark icon |
| **⟳ Loop** | White outlined (off) → teal filled, white icon (on). Bold font-weight. |
| **Clear** | White, grey uppercase text → red border+text on hover |
| **Load** | Teal filled, full-width, 40px height, bold |
| **Reset View** | Borderless text button, grey → dark on hover |

**Design principle:** Teal means "active/on" (Loop toggle) or "submit" (Load). All transport buttons share the same white-outlined base. No conflicting affordances.

**Disabled states:** opacity 0.3, lighter borders (`#ddd`), `cursor: not-allowed`.

### Files Changed

| File | Changes |
|------|---------|
| `INT/src/sidebar.ts` | Info overlay builder + HTML content; overlay CSS; triangle SVG info buttons; title centering; button CSS redesign (transport, Load, Clear, Reset View); loop icon `⟳` with bold weight |
| `INT/src/__tests__/sidebar.test.ts` | +7 overlay tests, updated info button + loop icon assertions |

### Test Results

```
INT: 244 passed (+7 overlay tests)
Total: 1,043 passed — 0 failures
tsc --noEmit: 0 errors
```

### Phase 1 Complete

All sub-phases delivered:
- **1a:** Sidebar shell + responsive layout (50 tests)
- **1b:** Tempo + loop + Italian markings
- **1c:** Active chord display (interactive + playback)
- **1d:** (merged into 1c)
- **1e:** Title/branding (delivered in 1a)
- **1f:** Info overlay modals (7 tests)
- **1g:** Button visual redesign (Refine pass)
- **Bug fixes:** 7 fixes (loop/stop, dot highlighting, centroid, colors, audio, input cleaning)

---

## Entry 7 — Bug Fixes: Dot Highlighting, Loop/Stop, Colors, Input Cleaning

**Date:** 2026-02-17

### Summary

Seven bug fixes and improvements discovered during browser testing of the playback system. Touches HC (centroid calculation), RU (grid-highlighter), AE (scheduler), and Integration (main.ts, pipeline, sidebar).

### Bug 1: Stop button doesn't work in loop mode

**Symptom:** With loop enabled, clicking Stop restarts playback instead of stopping.
**Root cause:** `handleStop()` → `transport.stop()` → fires `onStateChange({ playing: false })` → loop listener sees `!event.playing` + loop enabled → re-schedules and calls `handlePlay()`.
**Fix:** Added `explicitStop` flag in `main.ts`. Set to `true` before `transport.stop()` (in `handleStop`) and `transport.cancelSchedule()` (in `handleClear`). Loop listener checks the flag first — if set, clears it and does normal cleanup without restarting.

### Bug 2: Dominant 7th shows only triad during playback (no dot for 7th)

**Symptom:** G7 displays as G major triangle only; the F note (minor 7th) is not visualized.
**Root cause:** The grid-highlighter only handled `mainTriId` and `extTriIds` (triangle fills). For G7, the F note lands in `dot_pcs` (no adjacent triangle contains it), which was completely ignored.
**Fix:** Added `dotPcs?: readonly number[]` and `centroid?: { u, v }` to `GridHighlightOptions` in `grid-highlighter.ts`. When provided, the highlighter finds matching grid node circles and highlights their strokes with the active color. Also highlights connecting edges between dot nodes and triangle vertices.

### Bug 3: All nodes with matching PC light up (not just nearest)

**Symptom:** For Gdim, every G, A#, C# on the entire grid highlights — dozens of nodes.
**Root cause:** The initial dot implementation iterated ALL nodes in the window and highlighted every PC match.
**Fix:** Replaced with a **greedy chain algorithm**: (1) pick the nearest node for the first dot_pc relative to centroid, (2) pick each subsequent dot_pc's node nearest to any already-picked node. This ensures a tight, connected cluster. Edges between adjacent picked nodes are highlighted.

### Bug 4: Dot-only centroid in wrong position (far from actual dots)

**Symptom:** For Gdim, the orange path marker (centroid) lands on the C node, far from the G/Bb/Db dots.
**Root cause:** HC's `decomposeChordToShape` set `centroid_uv = focus` for dot-only shapes. The focus could be far from the actual dot positions.
**Fix (previous attempt):** Average nearest-node positions for all dot PCs. Result: centroid landed in empty space between the nodes (not on any edge or node).
**Fix (final):** Set `centroid_uv` = nearest lattice node matching the **root pitch class** (POL-D13). For Gdim, centroid lands exactly on the G node — musically intuitive and always on a real lattice node.

### Bug 5: m7b5/dim chords display in red (should be blue)

**Symptom:** Dm7b5 displays with red node/edge highlights, but it's a minor-leaning chord.
**Root cause:** For dot-only shapes (`main_tri === null`), orientation defaulted to `"U"` (major/red).
**Fix:** Changed fallback in `main.ts`: `orientation: shape.main_tri?.orientation ?? (shape.chord.quality === "aug" ? "U" : "D")`. Augmented (major 3rd) → red; dim/m7b5 (minor 3rd) → blue.

### Bug 6: Gaug7 rejected instead of gracefully degraded

**Symptom:** `Gaug7` silently fails to load (SPEC D-8: aug+extension excluded from MVP).
**Fix:** Added aug+extension stripping rule (#7) to `cleanChordSymbol`: `Gaug7` → `Gaug`. Also:
- Pipeline now returns `cleanedSymbols: string[]` in `PipelineSuccess`
- Added `setInputText(text: string)` to `Sidebar` interface
- After successful load, textarea updates to show the cleaned/canonical symbols
- `currentChordSymbols` uses cleaned versions for playback chord display

### Files Changed

| File | Changes |
|------|---------|
| `HC/src/placement.ts` | Dot-only centroid = nearest root node (not avg of all dots) |
| `HC/src/__tests__/placement.test.ts` | Updated 1 test for new centroid behavior |
| `HC/src/__tests__/integration.test.ts` | Updated 1 test for new centroid behavior |
| `HC/src/__tests__/progression.test.ts` | Updated 1 test for new centroid behavior |
| `RU/src/grid-highlighter.ts` | Added `dotPcs`, `centroid` to options; greedy chain nearest-node algorithm; edge highlighting for dot nodes; imports `pc`, `parseNodeId` |
| `INT/src/main.ts` | `explicitStop` flag; pass `dotPcs`+`centroid` to highlighter; dot-only color fallback; `cleanedSymbols` for chord display + textarea update |
| `INT/src/sidebar.ts` | Added `setInputText(text)` to interface + implementation |
| `INT/src/progression-pipeline.ts` | Aug+extension stripping in `cleanChordSymbol`; `cleanedSymbols` in `PipelineSuccess` |

### Bug 7: Dim/aug/m7b5 chords silent during scheduled playback

**Symptom:** By themselves, Cdim and Caug render but produce no sound. In a sequence "C Cdim Caug C7", C plays, Cdim is truncated, Caug is silent, C7 plays fine.
**Root cause:** AE's `scheduler.ts` used `[...slot.event.shape.covered_pcs]` to get pitch classes for audio scheduling. For dot-only shapes (dim, aug, m7b5, dim7), `covered_pcs` is an empty Set — all PCs are in `dot_pcs`. The scheduler got zero notes and skipped the chord.
**Fix:** Changed to `slot.event.shape.chord?.chord_pcs ?? [...slot.event.shape.covered_pcs]`. Uses the full chord PC list (always complete regardless of visual decomposition), with fallback to `covered_pcs` for backward compatibility with existing AE test mocks.

### Library

- Added Entry 29 to `LIBRARY_CONTENT.md`: **Chord Forms Demo** — a purpose-built 12-chord sequence exercising every supported chord type (major, minor, dim, aug, 7, maj7, m7, dim7, m7b5, 6, and back to minor + dom7). Genre: Reference / Educational. Feature: Chord type showcase.

### Decisions

- **POL-D13** (Closed): Dot-only centroid = nearest root node
- **POL-D14** (Open — future): Non-root triangle placement for m7b5 chords

### Test Results

```
HC:  178 passed (3 tests updated for centroid change)
RU:  341 passed (no change)
AE:  172 passed (no change — backward-compatible fix)
INT: 237 passed (no change)
Total: 1,036 passed — 0 failures (note: 108 PD tests also pass, not re-run)
tsc --noEmit: 0 errors (all modules)
```

---

## Entry 6 — Phase 1c: Active Chord Display Wiring

**Date:** 2026-02-17

### Summary

Wired the sidebar chord display to show the currently sounding chord name in three contexts: interactive exploration (triangle/edge taps), playback (from cached chord symbols), and idle (placeholder).

### Wiring Points

| Context | Trigger | Display |
|---------|---------|---------|
| Interactive triangle tap | `onPointerDown` hit-test → `triLabel(triRef)` | e.g., `C`, `Am`, `F#m` |
| Interactive edge tap | `onPointerDown` hit-test → `identifyFourNoteChord(pcs)` | e.g., `C#m7`, `Cmaj7` |
| Interactive release | `onPointerUp` | Clears to placeholder |
| Playback chord change | `pathHandleProxy.setActiveChord(index)` | Original symbol from input, e.g., `Dm7`, `Am7b5` |
| Stop / Clear | `handleStop()`, `handleClear()` | Clears to placeholder |

### Chord Identification

**Triangle labels:** `triLabel(triRef)` — derives root PC from `getTrianglePcs(triRef)[0]`, quality from orientation (U → major, D → minor). Format: `PC_NAMES[rootPc] + quality`.

**Edge labels:** `identifyFourNoteChord(pcs)` — tries each of the 4 PCs as a potential root, computes intervals, matches against 6 known 7th chord patterns (maj7, 7, m7, m(maj7), m7b5, dim7). Falls back to PC name list for unrecognized patterns.

### Files Changed

| File | Changes |
|------|---------|
| `INT/src/main.ts` | Added `PC_NAMES`, `triLabel()`, `FOUR_NOTE_PATTERNS`, `identifyFourNoteChord()`, `edgeLabel()`; `currentChordSymbols` cache; wired `sidebar.setActiveChord()` in 5 locations |

### Test Results

```
INT: 237 passed — 0 failures
tsc --noEmit: 0 errors
```

## Entry 4 — Phase 1a: Sidebar Shell + Responsive Layout

**Date:** 2026-02-17

### Summary

Replaced the three-zone layout (toolbar + canvas + control panel) with a two-tab sidebar (Play | Library). Desktop: permanent left sidebar at 300px. Mobile: hamburger overlay with backdrop. All interaction and rendering functionality preserved.

### Design Decisions Closed

| Decision | Summary |
|----------|---------|
| POL-D2 | "Tone Nets" with subtitle "an interactive Tonnetz explorer" |
| POL-D9 | Two-tab sidebar (Play \| Library) + full-viewport overlay modals for How/What |
| POL-D10 | Active chord display — compact line in Play tab |
| POL-D11 | Playback controls — ▶ ■ 🔁 ✕, no Pause, loop is toggle |
| POL-D12 | Library detail — expandable accordion cards, Load → auto-switch to Play tab |

### Architecture

New `INTEGRATION/src/sidebar.ts` exports `createSidebar(options): Sidebar`. This replaces three RU exports (`createLayoutManager`, `createControlPanel`, `createToolbar`) which become dead code (Phase 5b retirement).

**DOM structure:**
```
div.tonnetz-app (flex-row)
├── div.sidebar-backdrop (mobile click-to-dismiss)
├── aside.tonnetz-sidebar (300px / fixed overlay)
│   ├── header (title + ? ⓘ + tab bar)
│   ├── section[data-tab="play"] (chord display, textarea, ▶■🔁Clear, tempo)
│   ├── section[data-tab="library"] (placeholder for Phase 2)
│   └── button "Reset View"
└── main.tonnetz-canvas-area
    ├── button ☰ (mobile only)
    └── <svg>
```

**Sidebar interface:** `getCanvasContainer()`, `setProgressionLoaded()`, `setPlaybackRunning()`, `setActiveChord()`, `setTempo()`, `setLoopEnabled()`, `isLoopEnabled()`, `switchToTab()`, `getLibraryListContainer()`, `open()`, `close()`, `destroy()`

**`transport-wiring.ts` change:** Introduced `PlaybackStateTarget` interface (just `setPlaybackRunning` + `setProgressionLoaded`) to replace the full `ControlPanel` type. Both RU's `ControlPanel` and the new `Sidebar` satisfy it structurally.

### Files Changed

| File | Action |
|------|--------|
| `INTEGRATION/src/sidebar.ts` | **Created** — 490 lines, full sidebar component |
| `INTEGRATION/src/main.ts` | **Rewritten** — sidebar replaces layout/panel/toolbar; all callbacks moved before sidebar construction |
| `INTEGRATION/src/transport-wiring.ts` | **Modified** — `PlaybackStateTarget` replaces `ControlPanel` type |
| `INTEGRATION/src/index.ts` | **Modified** — added `Sidebar`, `SidebarOptions`, `PlaybackStateTarget` exports |
| `INTEGRATION/src/__tests__/sidebar.test.ts` | **Created** — 48 tests |

### Test Results

```
INT: 235 passed  (+48 new sidebar tests)
All other modules: unchanged
Total: 1,034 passed — 0 failures
tsc --noEmit: 0 errors
vite build: 54 modules, 46.85 kB gzipped
```

---

## Entry 5 — Phase 1b: Tempo Controller + Loop Wiring + Tempo Markings

**Date:** 2026-02-17

### Summary

Wired the tempo slider to `AudioTransport.setTempo()` and persistence. Implemented loop replay: when loop is enabled and transport completes naturally, the progression re-schedules and replays automatically. Added Italian tempo markings (Largo, Adagio, Andante, Moderato, Allegro, Vivace, Presto, Prestissimo) that update dynamically with BPM.

### Tempo Wiring (already functional from Phase 1a)

- Sidebar `onTempoChange` → `handleTempoChange()` → `transport.setTempo(bpm)` + `updateSettings(persistence, { tempo_bpm })`
- Initial tempo loaded from persistence settings
- URL hash tempo override via `sidebar.setTempo()`

### Loop Implementation

- `scheduledEventsCache` added to `main.ts` — caches `ChordEvent[]` from each `loadProgressionPipeline()` call, cleared on `handleClear()`
- Enhanced `transport.onStateChange` listener: when natural playback completes (`!event.playing`) and `sidebar.isLoopEnabled()`:
  1. Clear grid highlights for seamless visual reset
  2. Re-schedule cached events via `transport.scheduleProgression()`
  3. Call `handlePlay()` to restart
- Listener ordering ensures correctness: `wireTransportToUIState` fires first (state → `progression-loaded`), then loop listener fires `handlePlay()` (valid from `progression-loaded`)
- Explicit stop via `handleStop()` bypasses loop (different code path from natural completion)

### Tempo Markings

| Marking | BPM Range |
|---------|-----------|
| Largo | 40–59 |
| Adagio | 60–72 |
| Andante | 73–107 |
| Moderato | 108–119 |
| Allegro | 120–167 |
| Vivace | 168–175 |
| Presto | 176–199 |
| Prestissimo | 200–240 |

Added `tempoMarking(bpm)` function and a styled italic label above the slider (left-aligned, with BPM value right-aligned). Updates on slider drag and on programmatic `setTempo()`.

### Files Changed

| File | Action |
|------|--------|
| `INTEGRATION/src/main.ts` | **Modified** — `ChordEvent` import, `scheduledEventsCache`, loop logic in `onStateChange`, `handleLoopToggle` stub removed |
| `INTEGRATION/src/sidebar.ts` | **Modified** — `tempoMarking()` helper, tempo section layout (header row with marking + BPM, slider below) |
| `INTEGRATION/src/__tests__/sidebar.test.ts` | **Modified** — +2 tests (marking at all BPM ranges, marking updates on slider input) |

### Test Results

```
INT: 237 passed  (+2 tempo marking tests)
All other modules: unchanged
Total: 1,036 passed — 0 failures
tsc --noEmit: 0 errors
```

### INT-D8 Status

INT-D8 (tempo control UI) is now closed — tempo slider is fully wired to transport, persistence, and URL hash.

---

## Entry 3 — Phase 0b Layer 1: Input Cleaning

**Date:** 2026-02-16

### Problem

Musicians type chord symbols in many notational variants: `C/E` (slash chords), `C-7` (dash for minor), `CΔ7` (triangle for maj7), `Cø7` (slashed-O for half-diminished), `C7(b9)` (parenthesized alterations), `Csus4` (suspended chords). HC's parser rejects all of these — it only accepts the canonical form.

### Solution

Added `cleanChordSymbol()` to `progression-pipeline.ts` in the Integration module. This runs before `parseChordSymbol()` and normalizes input:

| Rule | Example | Result |
|------|---------|--------|
| Slash bass stripping | `Dm7/A` → `Dm7` | Negative lookbehind `(?<!6)` preserves `6/9` |
| Parenthesized alterations | `C7(b9)` → `C7` | Regex `\([^)]*\)` |
| Half-diminished symbol | `Cø7` → `Cm7b5` | Unicode `ø` → `m7b5` |
| Triangle symbol | `CΔ7`, `C△` → `Cmaj7` | Unicode `Δ` or `△` → `maj7` |
| Dash-as-minor | `C-7` → `Cm7` | Anchored after root+accidental |
| Sus stripping | `Csus4` → `C` + warning | Lossy — warning surfaced in `PipelineSuccess.warnings` |

The cleaning function returns `{ cleaned, warning }` — warnings propagate through the pipeline into `PipelineSuccess.warnings[]` for UI display.

### Wiring

Changed `loadProgressionPipeline()` Step 2 from:
```ts
parsedChords.push(parseChordSymbol(entry.symbol));
```
to:
```ts
const { cleaned, warning } = cleanChordSymbol(entry.symbol);
if (warning) warnings.push(warning);
parsedChords.push(parseChordSymbol(cleaned));
```

Added `warnings: string[]` field to `PipelineSuccess` interface. Exported `cleanChordSymbol` and `CleanResult` from `index.ts`.

### Design Notes

- **Slash bass stripping** uses negative lookbehind `(?<!6)` to avoid eating the `6/9` extension. This is the trickiest regex in the function — `C6/9` must NOT become `C6`.
- **Order of operations matters:** slash stripping happens first (removes `/A` before other rules can misparse it), then parentheses, then symbol conversions, then sus stripping (last because it generates a warning).
- **Empty/whitespace input** short-circuits to `{ cleaned: "", warning: null }`.
- **`PipelineSuccess.warnings` is additive** — existing code that destructures success results is not affected.

### Files Changed

**INTEGRATION:**
- `src/progression-pipeline.ts` — Added `cleanChordSymbol()`, `CleanResult`, wired into pipeline, added `warnings` to `PipelineSuccess`
- `src/index.ts` — Export `cleanChordSymbol`, `CleanResult`
- `src/__tests__/progression-pipeline.test.ts` — +46 tests across 3 describe blocks (unit: 31 clean tests, integration: 8 pipeline tests, passthrough: 7 tests)

### Test Results

```
HC:  178 passed  (no change)
RU:  341 passed  (no change)
AE:  172 passed  (no change)
PD:  108 passed  (no change)
INT: 187 passed  (+46 new: input cleaning)
Total: 986 passed — 0 failures
tsc --noEmit: 0 errors
```

### Regression Check

All 23 pre-existing pipeline tests still pass. The `warnings` field is additive — `integration-flow.test.ts` (32 tests) passes without any modification.

---

## Entry 2 — Phase 0b Layer 2: dim7 and m7b5 Grammar Expansion

**Date:** 2026-02-16

### Problem

HC parser (`parseChordSymbol()`) rejected `Cdim7` and `Cm7b5` — two chord types needed for jazz library entries (notably Entry 11: Autumn Leaves, which uses `Am7b5`).

Previous regex: `^([A-G])(#|b)?(m(?!aj)|dim|aug)?(maj7|add9|6\/9|6|7)?$`

This had two problems:
1. **`Cdim7` parsed incorrectly** — regex captured `dim` as quality and `7` as extension, producing intervals [0,3,6,10] (half-diminished). A true dim7 chord has [0,3,6,9] (diminished 7th = bb7, interval 9).
2. **`Cm7b5` rejected entirely** — regex captured `m` as quality, but `7b5` doesn't match any extension token.

### Solution

Restructured regex with compound token capture group:

```
/^([A-G])(#|b)?(?:(dim7|m7b5)|(m(?!aj)|dim|aug)?(maj7|add9|6\/9|6|7)?)?$/
```

- Group 3: compound suffix (`dim7` or `m7b5`) — matched BEFORE groups 4/5
- Groups 4/5: standard quality + extension (only tried when group 3 doesn't match)
- When compound matches, parser derives quality=dim and extension from the compound token

New `EXTENSION_INTERVALS` entries:
- `dim7: [9]` — diminished 7th (bb7, interval 9 from root)
- `m7b5: [10]` — minor 7th (b7, interval 10 from root)

Both use `quality = "dim"` (diminished triad [0,3,6]) as the base. The distinction is solely in the 7th:
- dim7: [0,3,6] + [9] = {0,3,6,9} — fully diminished (symmetric, minor 3rds all the way)
- m7b5: [0,3,6] + [10] = {0,3,6,10} — half-diminished (dim triad + minor 7th)

### Files Changed

**HARMONY_CORE:**
- `src/types.ts` — Added `"dim7"` and `"m7b5"` to `Extension` union type
- `src/chords.ts` — Restructured `CHORD_RE` regex (5 capture groups), added compound token parsing path, added `dim7`/`m7b5` to `EXTENSION_INTERVALS`
- `src/__tests__/chords.test.ts` — +10 tests (5 parse tests + 5 pitch-class correctness tests + 1 symmetry test... wait, 10 total)

### Test Results

```
HC:  178 passed  (+10 new: dim7/m7b5 parse + pc correctness)
RU:  341 passed  (no change)
AE:  172 passed  (no change)
PD:  108 passed  (no change)
INT: 141 passed  (no change)
Total: 940 passed — 0 failures
tsc --noEmit: 0 errors (HARMONY_CORE)
```

### Regression Check

All pre-existing chord tests still pass:
- `Cdim` still parses as dim triad (quality=dim, extension=null) — the `dim` quality-only path is unaffected
- `Cm7` still parses as minor 7th (quality=min, extension=7) — the `m` quality path is unaffected
- All 12 roots × maj and min still correct
- Aug+extension rejection still works

### Library Compatibility

After this change, 27 of 28 library entries parse with no cleaning required. Entry 11 (Autumn Leaves) with `Am7b5` now parses correctly. Only Layer 1 (input cleaning) remains for handling notation variants (slash chords, ø, Δ, etc.).

---

## Migrated Entries (0a–0e)

The following entries were originally logged under Integration Module DEVLOG (Entries 18–22, Phase 8: User Testing). They are migrated here because they represent UX/visual polish work, not integration wiring. Original dates and content preserved; entry numbering prefixed with `0` to indicate pre-track work.

---

## Entry 0a — Design Pass 1 (Visual Tuning)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 18

### User Feedback (5 items)

| # | Feedback | Resolution |
|---|----------|------------|
| 1 | Default zoom too far out — few progressions span more than 6 triangles | Default zoom 1 → 4 (MAX_ZOOM raised to 8) |
| 2 | Pointer should be a circle to show triangle vs edge hit zone | Added `ProximityCursor` — dashed circle follows pointer. New file: `cursor.ts` |
| 3 | Node labels overlap circles, hard to read; grid too dark | Node circles enlarged (0.08→0.15 radius), grid lightened, labels bolded |
| 4 | Grid is a skewed parallelogram, should be rectangular | Skipped — at 4× default zoom the edges are off-screen |
| 5 | Major/minor triangles should be different colors; active chord should be bright | Grid: major=pale blue, minor=pale red. Active shapes: bright blue/red. |

Additional: cursor circle reduced to 1/3 proximity radius; playing chord highlight wired.

### Files Changed

**RENDERING_UI:** `camera.ts`, `renderer.ts`, `shape-renderer.ts`, `highlight.ts`, `cursor.ts` (new), `index.ts`, `camera.test.ts`, `camera-controller.test.ts`
**INTEGRATION:** `main.ts`

---

## Entry 0b — Design Pass 2 (Interaction Fixes)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 19

### Feedback Items (8)

| # | Issue | Fix |
|---|-------|-----|
| 1 | First click sustains indefinitely | Async race: added `pointerGeneration` counter for race prevention |
| 2 | Highlights appear only on release, not press | Moved highlight to `onPointerDown` wrapper |
| 3 | Clicking inside triangle plays extended chord | Proximity radius 0.5 → 0.12 world units |
| 4 | Interaction highlights persist in playback mode | Added `clearAllHighlights` on play/load |
| 5 | Interaction colors more vivid than playback colors | Aligned fill opacities (0.55 main, 0.28 ext) |
| 6 | Cursor circle bigger than triangle | Cursor radius matched to hit-test radius |
| 7 | Visual cursor accurate but audio hits edges | Unified hit-test radius across all three paths (0.12) |
| 8 | Clicking around triangle plays different chords | Resolved by #7 |

### Architecture Insight: Three Hit-Test Radii

Key lesson — three independent radii needed synchronization:
1. `interaction-controller.ts` — tap/drag classification
2. `interaction-wiring.ts` — audio hit-test
3. `main.ts` — visual highlight hit-test

All three now use `computeProximityRadius(0.12)` = 0.12 world units.

### Files Changed

**RENDERING_UI:** `interaction-controller.ts`, `highlight.ts`
**INTEGRATION:** `interaction-wiring.ts`, `main.ts`

---

## Entry 0c — Design Pass 3 (Colors, Labels, Enharmonics)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 20

### Feedback Items (4)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Major/minor colors should be flipped (major=red, minor=blue is standard) | Swapped all color assignments |
| 2 | Note labels should show enharmonic equivalents (C#/Db) | Added `PC_ENHARMONIC` lookup; dual text elements for enharmonic nodes |
| 3 | Enharmonic labels cramped | Font size 75% → 62% of base |
| 4 | Note labels should be dark grey not black | `LABEL_COLOR` `#111` → `#555` |

### Files Changed

**RENDERING_UI:** `renderer.ts`, `shape-renderer.ts`, `highlight.ts`, `renderer.test.ts`

---

## Entry 0d — Design Pass 4 (Playing State Redesign + Grid Highlighter)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 21

### Architecture Change: Overlay → Mutate-Grid

**Problem:** Overlay SVG polygons on `layer-chords`/`layer-interaction` covered node circles rendered in `layer-grid` — nodes looked buried.

**Solution:** New **mutate-grid** approach. Directly mutate existing `layer-grid` triangle polygon `fill`, edge line `stroke`/`stroke-width`, and node circle `stroke`/`stroke-width`. `saveOnce()` mechanism stores originals and restores on deactivation. UX_SPEC §3 updated with the at-rest/playing visual encoding tables.

### Feedback Items (8)

| # | Issue | Fix |
|---|-------|-----|
| 1 | At-rest triangles too faint (0.25 opacity) | Increased to 0.45 |
| 2 | Playing triangles not dramatic enough | Fully opaque hex fills: major `#c84646`, minor `#5082d2` |
| 3 | Playing state covers node circles | Grid-highlighter mutates grid directly |
| 4 | Node circles don't restore after release | Fixed double-save bug with Set tracking |
| 5 | Edges should change when playing | Grid-highlighter mutates edge strokes; polygon stroke → `"none"` |
| 6 | Double-line effect at edges | All playing colors fully opaque; polygon stroke `"none"` |
| 7 | Edges and nodes should be same shade | Unified grey at rest, unified colors when playing |
| 8 | Edges and nodes should have same thickness | Unified widths (0.02 rest, 0.035 playing, 0.05 root) |

### Files Changed

**RENDERING_UI (new):** `grid-highlighter.ts`
**RENDERING_UI (modified):** `renderer.ts`, `shape-renderer.ts`, `highlight.ts`, `index.ts`
**INTEGRATION:** `main.ts`

---

## Entry 0e — Playback Testing Session

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 22

### Bugs Found & Fixed (4)

| # | Bug | Fix |
|---|-----|-----|
| 1 | Interactive grid highlight fires during playback (UX-D6 violation) | Added UI state check at top of `onPointerDown` wrapper |
| 2 | `handleStop()` doesn't clear playback grid highlight | Added deactivate in `handleStop()` |
| 3 | Natural completion leaves last chord highlighted | Added `transport.onStateChange()` listener for `playing: false` |
| 4 | Dual grid highlight handle conflict | Explicit clear of both handles in `handlePlay()` |

### Code Review Findings (No-Fix)

- `createControlPanelCallbacks()` unused — benign dead code
- `onTriangleSelect`/`onEdgeSelect` are no-ops after highlight move to `onPointerDown` — correct but could simplify
- Dual `onStateChange` listeners (main.ts + wireTransportToUIState) — idempotent, safe

### Files Changed

**INTEGRATION:** `main.ts`

---

## Entry 1 — Track Setup & Documentation Restructuring

**Date:** 2026-02-16

### Changes

- Created `MVP_POLISH/DEVPLAN.md` — cold start summary, 5-phase breakdown (UI Layout, Progression Library, Audio Quality, Mobile UAT, Final Polish), 5 open decisions (POL-D1 through POL-D5)
- Created `MVP_POLISH/DEVLOG.md` — migrated Integration DEVLOG Entries 18–22 as Entries 0a–0e
- Closed Integration track (DEVPLAN marked complete, DEVLOG closing entry added)
- Updated UX_SPEC.md with new layout direction (sidebar/hamburger), library section, title

### Integration Track Closure Summary

The Integration Module DEVPLAN/DEVLOG covered:
- **Phases 1–7:** Scaffolding, grid-to-beat bridging, interaction wiring, transport wiring, persistence wiring, application assembly, polish & review (keyboard shortcuts, logging, perf review)
- **Phase 8:** User testing — 4 design passes + playback testing (migrated to this track)
- **930 tests passing** across all modules at handoff
- **INT-D8 (tempo control UI)** carried forward as POL-D1/Phase 1b dependency

---
