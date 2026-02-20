# DEVLOG — MVP Polish Track

Module: MVP Polish (cross-cutting)
Started: 2026-02-16

---

## Entry 17 — Phase 3b/3c: Sustained Repeats + Piano/Pad Mode

**Date:** 2026-02-20

### Summary

Implemented shared VoiceHandle infrastructure (`cancelRelease`), sustained repeated chords (3b), and per-voice continuation with Piano/Pad mode toggle (3c). Three-phase build with each step independently shippable. Also consolidated superseded API annotations across SPEC.md and UX_SPEC.md into appendices.

### Shared Infrastructure: VoiceHandle.cancelRelease()

**Problem:** Both 3b and 3c require carrying voices across chord boundaries, but `release()` was one-shot (guarded by `released` flag) and called `osc.stop()` which is irreversible in the Web Audio API.

**Fix (synth.ts):**
- Removed `osc.stop()` from `release()` — oscillators stay alive; cleanup deferred via `setTimeout → handle.stop()`
- Added `cancelRelease()` — resets `released` flag, clears pending cleanup timer, cancels envelope ramp, restores sustain level (`peakGain * sustainLevel`)
- Tracked `releaseCleanupId` so `cancelRelease()` can `clearTimeout()` the pending cleanup (initial version missed this — voices died mid-sustain because the old timer fired)

### Phase 3b: Sustained Repeated Chords

**Approach:** Pitch-class equality gate at the top of both playback paths. If consecutive chords have identical `chord_pcs` sets → carry all voices forward, skip stop/restart. Applies in both Piano and Pad modes.

**Scheduler (`scheduleChordVoices`):** After extracting pcs, if `idx > 0` and `samePitchClasses(prevPcs, pcs)` → per-voice carry loop: `cancelRelease()` → `release(newEndTime)` → move to current slot. Early return.

**Immediate (`playPitchClasses`):** Derive current pcs from `prevVoicing % 12`, compare with incoming sorted pcs. If identical → return early.

**Bug found and fixed:** Initial implementation didn't clear the `setTimeout` from `release()` in `cancelRelease()`. Voices died at the original slot's end time because the cleanup timer fired. Fixed by tracking `releaseCleanupId` and calling `clearTimeout()` in `cancelRelease()`.

### Phase 3c: Per-Voice Continuation (Pad Mode)

**Approach:** When pitch classes differ at a chord boundary and `padMode` is true, diff MIDI note sets instead of hard-stopping everything:
- Common tones (same MIDI in old and new voicing) → `cancelRelease()` + reschedule `release()`
- Departing tones (in old, not in new) → `voice.release()` with musical 500ms tail
- Arriving tones (in new, not in old) → `createVoice()` fresh attack

**Decision tree at each boundary:**
```
if samePitchClasses(prev, curr) → carry all (3b, both modes)
else if padMode → voice-diff (3c, pad only)
else → hard stop + fresh attack (3a, piano only)
```

**padMode plumbing:**
- `SchedulerState.padMode: boolean` (set at creation via `CreateSchedulerOptions`)
- `ImmediatePlaybackState.padMode: boolean` (mutable, flipped by sidebar toggle)
- `AudioTransport.setPadMode(enabled)` / `getPadMode()` — stored in transport closure, passed to `createScheduler()`
- Sidebar: 🎹 Piano / ♫ Pad toggle (reuses path-toggle CSS), wired in `main.ts`

**New types exported:** `PlaybackMode = "piano" | "pad"` from `audio-engine`

### Documentation Cleanup

Consolidated superseded API annotations (`createLayoutManager`, `createControlPanel`, `createToolbar` + associated types) from 10 inline mentions across SPEC.md and UX_SPEC.md into a single **Appendix: Superseded APIs** at the end of each document. Body tables now contain only active APIs.

### Files Changed

| File | Changes |
|------|---------|
| `AE/src/synth.ts` | `VoiceHandle.cancelRelease()`, `release()` no longer calls `osc.stop()`, `releaseCleanupId` tracking |
| `AE/src/scheduler.ts` | `samePitchClasses()`, 3b carry gate, 3c pad voice-diff, `padMode` on state/options |
| `AE/src/immediate-playback.ts` | `samePitchClasses()`, 3b early-return gate, 3c pad voice-diff, `padMode` on state |
| `AE/src/types.ts` | `setPadMode`/`getPadMode` on `AudioTransport`, `PlaybackMode` type |
| `AE/src/audio-context.ts` | `padMode` storage, passed to `createScheduler()`, `setPadMode`/`getPadMode` impl |
| `AE/src/index.ts` | Export `PlaybackMode` |
| `INT/src/sidebar.ts` | Piano/Pad toggle DOM + handler + `onPlaybackModeChange` callback |
| `INT/src/main.ts` | Wire `onPlaybackModeChange` → `transport.setPadMode()` + `immediatePlayback.padMode` |
| `SPEC.md` | Superseded APIs → appendix |
| `UX_SPEC.md` | Superseded APIs → appendix |
| `MVP_POLISH/DEVPLAN.md` | 3b/3c specs finalized, current status updated, open issue added |

### Test Results

AE 202 (was 172), INT 241 — all passing, 0 type errors (AE); 3 pre-existing unrelated errors (INT).

### Open Issues

- ~~Audible crackle at first chord onset~~ — Fixed (see below)

### Crackling Fix: Fixed Per-Voice Gain

**Root cause:** `mixGain.gain.value` was 0.5 per voice, and `masterGain` normalization (`1/√n`) was set *after* voice creation. During the creation loop, voices attacked into an un-normalized master gain (value 1.0), so 3 voices briefly summed to `3 × 0.5 × 0.787 ≈ 1.18` — clipping. Single-voice changes were clean because `0.5 × 0.787 = 0.39`.

**Fix:** Set `mixGain.gain.value = 0.24` per voice (max 4 voices: `4 × 0.24 × 1.0 = 0.96`, always under 1.0). Removed all dynamic `masterGain` normalization (`1/√n` logic, `updateMasterGain()` function, and all call sites). Master gain stays at 1.0 permanently.

### End-of-Progression Crackling Fix

**Root cause (three layers):**

1. **`release()` called at scheduling time with future `when`**: `envGain.gain.value` returns 0 (initial value at scheduling time), not the sustain level the voice will be at when `when` arrives. This scheduled `setValueAtTime(0, endTime)` — an instant snap to zero at chord end, audible as a click. **Fix:** use `peakGain * sustainLevel` (the known sustain value) instead of reading `gain.value`.

2. **`stopScheduler()` hard-stopped voices during release tail**: The completion check fired at `endTime`, calling `stopScheduler()` → `voice.stop()` which cancelled the smooth 500ms release ramp mid-flight. **Fix:** delay completion check by `releaseTime + 0.05s`, and don't call `stopScheduler` on natural end — just clear the timer and fire `onComplete`. Voices self-clean via their release setTimeout.

3. **Release cleanup called `handle.stop()` redundantly**: After the release ramp finished, the cleanup setTimeout called `stop()`, which did `cancelScheduledValues` + `setValueAtTime(gain.value)` + 10ms fade on an already-silent signal — creating a micro-spike. **Fix:** cleanup now silently stops oscillators and disconnects nodes without touching the envelope.

---

## Entry 16 — Placement Heuristics + Library Finalization

**Date:** 2026-02-19

### Summary

Improved progression path placement with two changes: world-coordinate distance metric in `placeMainTriad` (fixes visual distortion from lattice-coordinate math) and distance-gated root reuse in `mapProgressionToShapes` (repeated chords snap to their prior position when nearby). Finalized library at 26 entries. Explored and rejected compactness-anchor approach for Giant Steps.

### World-Coordinate Distance (placement.ts)

**Problem:** `dist2()` computed squared distance in lattice coordinates (`du² + dv²`), but the Tonnetz uses an equilateral layout where world coordinates are `x = u + v*0.5`, `y = v * √3/2`. Two candidates equidistant on screen had different lattice distances, causing visually confusing placements.

**Fix:** Changed `dist2()` to world-coordinate distance:
```ts
const dx = (a.u - b.u) + (a.v - b.v) * 0.5;
const dy = (a.v - b.v) * SQRT3_2;
return dx * dx + dy * dy;
```

This is a one-line conceptual fix that makes all placement decisions match visual perception.

### Distance-Gated Root Reuse (progression.ts)

**Problem:** Whole-step motion (e.g., G → A in Canon in D) placed the second chord at a different octave of the same root, creating a visually confusing leap when a nearer instance of that chord existed from earlier in the progression.

**Fix:** `mapProgressionToShapes` maintains a `placedRoots: Map<number, NodeCoord>` remembering the first placement of each root PC. When the same root recurs, both candidates are scored:
- `proximityTri` — nearest to chain focus (old behavior)
- `reuseTri` — nearest to prior placement

Reuse wins if `reuseDist <= proxDist * 1.5` (within 50% of the proximity distance). Otherwise proximity wins, preventing long visual leaps (Rhythm Changes' Bb).

### Explored and Rejected: Compactness Anchor

Attempted to add a cluster-center compactness pull to `placeMainTriad` to resolve Giant Steps' symmetric tritone jumps consistently. Tried: strict tie-break, near-equality threshold (1%), blended scoring (10%, 25%), running centroid, unique-root centroid. None solved Giant Steps — the algorithm is fundamentally local (places one chord at a time) while the problem is global (symmetric pattern requires knowledge of the full layout). Stripped all compactness code to avoid complexity for no payoff. Giant Steps tagged as known limitation requiring future two-pass optimizer.

### Library Finalization

Added 26 entries from LIBRARY_CONTENT.md (3 existed previously). Final count: 26 entries across 7 genres.

- De-duplicated all 4× repetitions per POL-D17 (one token per bar)
- Entries with 2 chords/bar use doubled tempo: Rhythm Changes (336), Giant Steps (572), Blue Bossa (288), Misty (144), Greensleeves (192)
- Replaced Don't Stop Believin' with Let It Be
- Removed Sweet Home Alabama, Wonderwall, Take Five (Cb chord fails HC parser)
- Updated Все идет по плану: Cyrillic-only title/composer, Pop/Rock genre, corrected chords (Am F C E)

### Files Changed

| File | Changes |
|------|---------|
| `HC/src/placement.ts` | `dist2()` → world-coordinate distance; `placeMainTriad` cleaned (no compactnessAnchor) |
| `HC/src/progression.ts` | Distance-gated root reuse (`placedRoots` + `REUSE_THRESHOLD`); compactness anchor stripped |
| `INT/src/library/library-data.ts` | 26 library entries (final content) |

### Test Results

HC 178, INT 241 — all passing, 0 type errors.

---

## Entry 15 — Phase 3a: Envelope Cleanup + Synth Tuning

**Date:** 2026-02-19

### Summary

Fixed audio crackling at chord transitions and tuned the synthesis parameters for a warmer, less abrupt sound. Three files in Audio Engine changed; no new APIs, no architecture changes.

### Root Cause (Crackling)

`scheduleChordVoices()` in `scheduler.ts` created new voices at `slot.startTime` while the previous chord's voices were still in their 0.5s release tail (`SYNTH_DEFAULTS.releaseTime`). Two sets of oscillators overlapped — the decaying release envelope and the rising attack envelope summed to >1.0, causing clipping. Same pattern in `playPitchClasses()` in `immediate-playback.ts`.

### Fix: Hard-Stop at Chord Boundary

**`scheduler.ts`:** Before creating new voices in `scheduleChordVoices(state, idx)`, hard-stop all previous chord's voices:
```ts
if (idx > 0) {
  for (const voice of prevSlot.voices) { voice.stop(); }
  prevSlot.voices = [];
}
```

**`immediate-playback.ts`:** Changed `voice.release()` to `voice.stop()` in `playPitchClasses()`. Previous voices now cut cleanly instead of leaving a 500ms release tail.

**`synth.ts` — `stop()` method redesigned:** Replaced instant disconnect with a 10ms envelope fade-out (`linearRampToValueAtTime(0, t + 0.01)`) before stopping oscillators. Nodes disconnect via `setTimeout` after the fade completes. This prevents the DC click that a raw instant-disconnect would cause, while being 50× shorter than the release tail that caused crackling.

### Synth Tuning (Options B + D)

| Parameter | Before | After | Rationale |
|-----------|--------|-------|-----------|
| `attackTime` | 0.05 (50ms) | **0.12 (120ms)** | Softer fade-in; chord transitions feel less percussive |
| `filterCutoff` | 2000 Hz | **1500 Hz** | Warmer tone; removes upper harmonics that made the sound edgy |

### Attempted and Reverted: Overlap Window (Option A)

Tried a 30ms overlap where previous voices faded out while new voices faded in (`setTimeout(() => voice.stop(), 30)`). This reintroduced crackling — two sets of voices at combined >1.0 amplitude, same fundamental problem as the original release-tail overlap. `setTimeout` is also unreliable for audio timing. Reverted to clean hard-stop at boundary. The improved 120ms attack time makes the clean cut far less noticeable than it was at 50ms.

### Further Sound Quality

Deferred to Phase 3d (Synthesis & Voicing Exploration) as a Refine pass — goals and constraints defined, values emerge from iterative listening. Current sound is functional but not final.

### Files Changed

| File | Changes |
|------|---------|
| `AE/src/synth.ts` | `stop()` redesigned: 10ms fade-out + deferred disconnect. `attackTime` 0.05→0.12, `filterCutoff` 2000→1500 |
| `AE/src/scheduler.ts` | `scheduleChordVoices()`: hard-stop previous chord's voices before creating new ones |
| `AE/src/immediate-playback.ts` | `playPitchClasses()`: `voice.release()` → `voice.stop()` |

### Test Results

AE 172, RU 367 (incl. 19 AE contract), HC 178, INT 241 — all passing, 0 type errors.

---

## Entry 14 — POL-D20: Auto-Center Viewport on Progression Load

**Date:** 2026-02-19

### Summary

After loading a progression (manual paste, library, or URL hash), the camera now auto-fits to frame the entire path. Added `pointsWorldExtent()` utility, `computeBaseExtent()` helper (DRYs the aspect-fit logic shared with `computeViewBox`), and `fitToBounds()` on `CameraController`.

### New APIs

**`pointsWorldExtent(points): WorldExtent | null`** (`camera.ts`)
Computes world-space bounding box from an array of `{x, y}` points. Peer to `windowWorldExtent` — same return type, arbitrary point input. Returns `null` for empty input.

**`computeBaseExtent(gridExtent, containerWidth, containerHeight): { baseW, baseH }`** (`camera.ts`)
Extracted aspect-fit base dimension logic previously duplicated in `computeViewBox` and `fitToBounds`. Single source of truth for the zoom-to-viewBox-size relationship.

**`CameraController.fitToBounds(extent, padding?): void`** (`camera-controller.ts`)
Centers camera on the extent midpoint and computes zoom to frame the padded extent. Features:
- Hybrid padding: `margin = max(rawExtent * padding, 1.5)` — fractional 20% for large progressions, absolute floor (1.5 world units) for short ones where 20% is smaller than one triangle
- Degenerate bbox (single chord) falls back to `DEFAULT_ZOOM`
- Zoom clamped to `[MIN_ZOOM, MAX_ZOOM]`

### Wiring

In `loadProgressionFromChords()` (`main.ts`), after `renderProgressionPath()`:
1. Map shape centroids to world coordinates via `latticeToWorld()`
2. Compute extent via `pointsWorldExtent()`
3. Bias extent rightward by 1.0 world unit (chord shapes extend right of root centroids)
4. Call `camera.fitToBounds(biasedExtent)`

### Padding Refinement

Initial 20% fractional padding clipped short progressions (2–4 chords) because 20% of a small bbox is less than one triangle edge. Added absolute floor of 1.5 world units per side (triangle edge + active marker radius 0.32). The floor dominates for progressions narrower than ~7.5 world units; fractional padding dominates for longer ones.

Rightward bias (1.0 world unit added to `maxX`) compensates for chord shapes extending right of their root centroids in the equilateral layout.

### Zoom Constants

Exported `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_ZOOM` from `camera.ts` (were module-private). Needed by `fitToBounds` in `camera-controller.ts` for clamping and fallback.

### Files Changed

| File | Changes |
|------|---------|
| `RU/src/camera.ts` | Added `pointsWorldExtent()`, `computeBaseExtent()`; exported zoom constants; refactored `computeViewBox` to use `computeBaseExtent` |
| `RU/src/camera-controller.ts` | Added `fitToBounds()` to interface + implementation; uses `computeBaseExtent` |
| `RU/src/index.ts` | Added exports: `pointsWorldExtent`, `computeBaseExtent`, `MIN_ZOOM`, `MAX_ZOOM`, `DEFAULT_ZOOM` |
| `INT/src/main.ts` | Added `latticeToWorld`, `pointsWorldExtent` imports; fitToBounds wiring after `renderProgressionPath()` with rightward bias |

### Decisions

- **POL-D20** (Closed): Auto-center viewport on progression load via `fitToBounds(bbox)`. Snap (no animation). Smooth animation deferred as future refinement.

### Test Results

RU 367, INT 241 — all passing, 0 type errors.

---

## Entry 13 — Fix drag jitter + chord-stops-on-drag (UX-D4)

**Date:** 2026-02-19

### Summary

Fixed two long-standing interaction bugs: drag jitter (visual oscillation during pan) and chord audio continuing to play during drag instead of stopping at drag threshold.

### Drag Jitter Fix

**Root cause:** `onDragMove` in `interaction-controller.ts` computed two world-coordinate positions from a shifting viewBox and differenced them. Each `panMove()` call changed the viewBox, so the next `onDragMove` converted the same screen position to a different world position — a feedback loop causing oscillation.

**Fix:** Gesture controller now passes **screen-pixel deltas** (`screenDx`, `screenDy`) alongside world coordinates. Interaction controller converts screen deltas to world deltas using viewBox scale ratio (`screenDx * vb.width / rect.width`), which is stable regardless of viewBox position.

### Chord Stops on Drag (UX-D4)

**Root cause:** `InteractionCallbacks` had no `onDragStart` callback. Audio was only stopped in `onPointerUp`, so a hold-then-drag kept the chord sounding for the entire drag duration.

**Fix:** Added `onDragStart` to `InteractionCallbacks`. Interaction controller fires it when drag threshold is exceeded. Integration `main.ts` wires it to `stopAll()` + deactivate grid highlight.

### Files Changed

| File | Changes |
|------|---------|
| `RU/src/gesture-controller.ts` | Track `lastScreenX/Y`, pass `screenDx/screenDy` in `onDragMove` callback |
| `RU/src/interaction-controller.ts` | `onDragStart` fires `callbacks.onDragStart?.()`, `onDragMove` uses screen-to-world delta conversion, removed `lastDragWorld` state |
| `INT/src/main.ts` | Wire `onDragStart` → `stopAll()` + `deactivateGridHighlight()` |

### Test Results

RU 367, INT 241 — all passing, 0 type errors.

---

## Entry 12 — Active chord label on path marker

**Date:** 2026-02-19

### Summary

Moved chord symbol display from the sidebar onto the active-chord path marker (orange circle) during progression playback. The user now tracks one place on screen instead of two. Added white note-name labels on centroid markers (root motion mode) so grid labels remain readable under opaque dots.

### Changes

**Path renderer** (`RU/src/path-renderer.ts`):
- Active marker changed from `<circle>` to `<g>` group containing circle + `<text>` label
- Active marker radius enlarged from 0.18 → 0.32 world units to fit text
- `setActiveChord()` positions via `transform="translate(x,y)"` and updates label text
- New `PathRenderOptions.chordLabels?: string[]` — passes chord symbols into renderer
- New `PathRenderOptions.showCentroidLabels?: boolean` — controls note-name labels on centroid dots (default: true)
- New exported `formatShortChordLabel()` — compact chord notation for tight SVG space
- White note-name labels rendered on top of opaque centroid markers using `PREFERRED_ROOT[root_pc]`
- Two-character names (Eb, Bb, F#, Ab, Db) use smaller font (0.14) vs single-character (0.18)

**Compact chord notation** (`formatShortChordLabel`):
| Input | Output | Rationale |
|-------|--------|-----------|
| `dim` | `o` | Visual consistency with `ø` |
| `dim7` | `o7` | Visual consistency with `ø7` |
| `m7b5` | `ø7` | Standard half-diminished |
| `maj7` | `△7` | Standard triangle symbol |
| `add9` | `+9` | Shorter, avoids 6-char labels |
| `aug` | `+` | Standard augmented |
| `A#` | `Bb` | Preferred enharmonic (Bb, Eb, Ab, Db; keep F#) |

**Sidebar cleanup** (`INT/src/sidebar.ts`, `INT/src/main.ts`):
- Removed chord display section from sidebar (DOM, CSS, `setActiveChord` method, `CHORD_PLACEHOLDER`)
- Removed ~90 lines of dead chord-label helpers from main.ts (`triLabel`, `edgeLabel`, `chordName`, etc.)
- Trimmed unused imports (`EdgeId`, `getTrianglePcs`, `getEdgeUnionPcs`)

**Integration wiring** (`INT/src/main.ts`):
- Both `renderProgressionPath()` call sites pass `{ chordLabels, showCentroidLabels }`
- Root motion mode: `showCentroidLabels: true` (white note names on dots)
- Tonal centroid mode: `showCentroidLabels: false` (plain dots — centroid floats between nodes)

### Files Changed

| File | Changes |
|------|---------|
| `RU/src/path-renderer.ts` | Active marker group, `formatShortChordLabel()`, centroid note labels, `showCentroidLabels` option, two-char font sizing |
| `RU/src/index.ts` | Added `formatShortChordLabel` to public exports |
| `INT/src/main.ts` | Pass `chordLabels` + `showCentroidLabels` to path renderer, remove sidebar chord display calls + dead helpers |
| `INT/src/sidebar.ts` | Remove chord display DOM/CSS/method/constant |
| `INT/src/__tests__/sidebar.test.ts` | Remove chord display tests (3 tests removed) |
| `RU/src/__tests__/path-renderer.test.ts` | Updated active marker queries, added tests for labels, shortening, centroid labels, showCentroidLabels |
| `UX_SPEC.md` | Added active chord path label + centroid note label encoding rules to §3 |

### Test Results

RU 363, INT 244 — all passing, 0 type errors.

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
- `src/__tests__/chords.test.ts` — +10 tests (parse, pitch-class correctness, symmetry)

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
