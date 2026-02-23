# DEVPLAN — MVP Polish Track

Module: MVP Polish (cross-cutting)
Version: 0.4
Date: 2026-02-21
References: SPEC.md, UX_SPEC.md, ARCH_AUDIO_ENGINE.md, ARCH_RENDERING_UI.md

---

## Cold Start Summary

**What this is:**
Product-level polish track for the Tonnetz Interactive Harmonic Explorer. All four subsystems are integrated and functional. This track covers UI layout, progression library, audio quality, placement heuristics, and mobile UAT.

**Predecessor:** `INTEGRATION/DEVPLAN.md` (closed). Design Passes 1–4 migrated to DEVLOG as Entries 0a–0e.

**Key constraints:**
- No new subsystem modules — changes touch RU, AE, HC, Integration, PD
- Sidebar: permanent on desktop, hamburger overlay on mobile
- Library: bundled static data, not user-generated
- Max 4 simultaneous voices; per-voice gain fixed at 0.24 (no dynamic normalization)
- Mobile UAT is a distinct phase, not a checkbox

**Gotchas:**
- `grid-highlighter.ts` mutates `layer-grid` directly — layout changes must not break this
- `injectCSS()` deduplicates by style ID — CSS changes require full page reload (not just HMR)
- Library data uses `LibraryEntry` type (extends PD schema with metadata)
- Mobile proximity radius 0.12 world units tuned on desktop — may need mobile adjustment (POL-D5)

---

## Current Status

**Phase:** Phases 0–3, header redesign, Phase 4a, Phase 4d-1 (iOS audio), and Phase 4e-1/2/3 (node interaction: policy + hit-test + dispatch) complete. 4e-4 (orange disc) deferred; 4e-5 (node size) optional. Next: Phase 3d (synthesis exploration), then Phase 4b–4c (mobile UAT), then Phase 5.
**Blocked/Broken:** None.
**Open decisions:** D14 (m7b5 triangles — deferred post-MVP).
**Known limitations:** Mobile audio crackling on budget tablets (see Entry 21). iOS Safari cosmetic issues (labels, colors) unconfirmed on iOS 14.x — conditional on physical device verification. Giant Steps and Tristan chord placement deferred post-MVP.

---

## Completed Phases

### Phase 0: Pre-Polish Bug Fixes ✅

- **0a:** Interactive press = triad only, playback = full Shape (resolved as non-bug, POL-D6)
- **0b:** Chord grammar expansion — input cleaning (slash bass, ø, Δ, -, sus) + HC dim7/m7b5 (POL-D7)

### Phase 1: UI Layout Redesign ✅

Replaced three-zone layout with two-tab sidebar (Play | Library) in `INTEGRATION/src/sidebar.ts`. Transport controls ▶ ■ 🔁 ✕, tempo slider 20–960 BPM, info overlay modals. Title "Tone Nets". Active chord labels on path markers.

Key decisions: POL-D1 (sidebar), D9 (two tabs), D11 (transport), D15 (root vertex centroid), D16 (Root Motion / Tonal Centroid toggle), D17 (4 beats/chord, no collapsing).

### Phase 2: Progression Library ✅

26 curated progressions in `INTEGRATION/src/library/`. Three browsing views (All, By Genre, By Harmonic Feature). Expandable accordion cards (POL-D12). Library load → auto-switch to Play tab.

### Phase 3: Audio Quality ✅

**3a — Envelope Cleanup:** Hard-stop previous voices before new attack with 10ms fade-out. Fixed crackling at chord transitions.

**Shared Infrastructure — VoiceHandle.cancelRelease():** Resets released flag, clears pending cleanup timer, restores sustain level. `release()` no longer calls `osc.stop()`. Enables voice carry-forward for 3b/3c.

**3b — Sustained Repeated Chords:** Pitch-class equality gate at chord boundaries. Identical consecutive chords carry voices forward. Both modes.

**3c — Per-Voice Continuation (Legato Mode):** Voice-diff at chord boundaries: common tones sustain, departing tones release (500ms tail), arriving tones fresh attack. Staccato/Legato toggle in sidebar.

**Crackling fixes:** Per-voice `mixGain = 0.24`; `release()` uses known sustain level; graceful end-of-progression cleanup.

**Tests:** AE 202 (was 172).

### Header Redesign (POL-D18) ✅

- Title enlarged (30px) with subtitle (17px), centered, full-width, visually separated from tabs
- Info buttons moved from header to sidebar bottom: "How / to use" (pink) + "What / this is" (blue)
- Clear button absorbs Reset View (D21): resets camera + clears textarea + dismisses progression
- Library tab icon: ● (circle, replaces 📚 emoji)
- Loop button: geometric SVG cycle icon (replaces ⟳ Unicode)
- Staccato/Legato labels (replaces Piano/Pad)

### Placement Heuristics (HC) ✅

**Entry 16:** World-coordinate `dist2()` in placement.ts. Distance-gated root reuse (`REUSE_THRESHOLD = 1.5`).

**Entry 18:** Triangle centroid focus (not root vertex). Blended focus: `CHAIN_BLEND = 0.61` × previous tri centroid + 0.39 × running cluster center. World-coordinate `dist2()` in progression.ts.

**Tests:** HC 178.

### Chord Input Improvements ✅

9th chord aliases (`X9`, `X+9` → `Xadd9`). Unrecognized chord symbols silently stripped (progression plays whatever parsed). Pipeline always returns `ok: true`.

### Phase 4a: Mobile Touch + Responsive Layout ✅

- **Pinch-to-zoom:** Two-finger gesture tracking in gesture-controller.ts; computes scale factor from inter-pointer distance change; wires to `cameraController.zoom()` via new `onPinchZoom` callback. Audio stops on pinch start (same as drag).
- **Grid size:** `MIN_TRI_SIZE_PX` lowered from 40 to 25 — roughly doubles the lattice on tablets.
- **Context menu prevention:** `contextmenu` event + `-webkit-touch-callout: none` on SVG — suppresses Android tablet long-press "Download/Share" dialog.
- **Breakpoint raised:** 768px → 1024px — sidebar is always hamburger-overlay on phones and tablets (both orientations).
- **Floating transport strip:** Play/Stop, Loop, Share, Clear buttons below hamburger on mobile. Visible when progression loaded + sidebar closed. Auto-syncs with sidebar button states.
- **Auto-hide on Play:** Sidebar closes automatically on mobile when Play is tapped.
- **Scrollable sidebar:** Content (title, tabs, panels) scrolls; info footer buttons stay pinned at bottom.
- **Default tempo:** 150 BPM on page load and Clear (was 120).
- **Share button:** Link SVG icon in transport row + floating strip. Generates full URL from `window.location` + `encodeShareUrl(chords, tempo, grid)`. Copies to clipboard with textarea+execCommand fallback for non-HTTPS. Brief ✓ feedback on button.

**Files:** `RU/src/gesture-controller.ts`, `camera-controller.ts`, `interaction-controller.ts`, `resize-controller.ts`, `renderer.ts`; `INT/src/sidebar.ts`, `main.ts`, `index.ts`, `progression-pipeline.ts`; `AE/src/audio-context.ts`; `PD/src/types.ts`.
**Tests:** RU 367, INT 239.

### Supported Chord Reference

**Directly parsed:** maj, min, dim, aug, 7, m7, maj7, 6, add9, 6/9, dim7, m7b5

**Accepted via input cleaning (aliases):**

| Input | Cleaned to | Notes |
|-------|-----------|-------|
| `C9`, `C+9` | `Cadd9` | 9th chord shorthand |
| `Cø7`, `Cø` | `Cm7b5` | Half-diminished |
| `CΔ7`, `CΔ`, `C△7`, `C△` | `Cmaj7` | Triangle symbol |
| `C-7`, `C-` | `Cm7`, `Cm` | Dash-as-minor |
| `C/E` | `C` | Slash bass stripped |
| `C(b9)` | `C` | Parenthesized alterations stripped |
| `Csus4`, `Csus2`, `Csus` | `C` | Sus stripped |
| `Caug7` | `Caug` | Aug extension stripped (excluded from MVP) |

**Unrecognized symbols** are silently stripped — the progression plays with whatever parsed successfully.

**Not supported:** aug extended chords (aug7, augMaj7), 11/13 tensions

---

## Upcoming Work

### Phase 3d: Synthesis Exploration (Refine)

**Objective:** Build a preset-toggle system with 6 baked sound presets. User A/B tests all presets, picks favorites to keep. Losers are discarded in a cleanup step.

**Regime:** Refine. Step 1 (infrastructure + presets) is Build. Step 2 (listening) is the Refine feedback loop. Step 3 (cleanup) is Build.

**Reference:** `AUDIO_ENGINE/SOUND_SCULPTING.md` (pad synthesis), `AUDIO_ENGINE/SOUND_SCULPTING_1.md` (organ emulation + PeriodicWave).

**Constraints:**
- No changes to `VoiceHandle` interface or transport API
- Node budget: ≤8 nodes per voice × 4 voices = 32 per-voice + ≤8 global
- Per-voice gain stays ≤0.24 (AE-D16 principle: 4 voices < 1.0)
- Presets are baked parameter objects — no user-adjustable knobs

#### Step 1: Preset Infrastructure + All Presets (Build)

**New files:**
- `AUDIO_ENGINE/src/presets.ts` — `SynthPreset` type + 6 preset definitions + PeriodicWave builders
- `AUDIO_ENGINE/src/effects.ts` — global delay/effects chain, configurable per preset

**Modified files:**
- `AUDIO_ENGINE/src/synth.ts` — `createVoice()` accepts `SynthPreset` parameter (falls back to `SYNTH_DEFAULTS` for backward compat)
- `AUDIO_ENGINE/src/immediate-playback.ts` — `ImmediatePlaybackState.preset` field; pass to `createVoice()`
- `AUDIO_ENGINE/src/scheduler.ts` — `CreateSchedulerOptions.preset`; pass to `createVoice()`
- `AUDIO_ENGINE/src/index.ts` — export `SynthPreset`, preset objects, effects API
- `INTEGRATION/src/sidebar.ts` — preset `<select>` dropdown (below Staccato/Legato toggle)
- `INTEGRATION/src/main.ts` — wire dropdown to `ImmediatePlaybackState.preset` + `AudioTransport`

**6 Presets:**

| # | Name | Character | Oscillators | Filter | Envelope | LFO | Delay |
|---|------|-----------|-------------|--------|----------|-----|-------|
| 1 | `"classic"` | Current sound (baseline) | triangle+sine, ±3¢ | LP 1500Hz | A 120ms, R 500ms | none | none |
| 2 | `"warm-pad"` | Warm subtractive pad | saw+tri, ±5¢ | LP 900Hz + bloom | A 350ms, R 1.4s | none | single 55ms |
| 3 | `"breathing-pad"` | Animated pad with movement | saw+tri, ±5¢ | LP 900Hz + bloom | A 350ms, R 1.4s | filter 0.09Hz ±120Hz | single 55ms |
| 4 | `"cathedral"` | Pipe organ + bloom | PeriodicWave principals + sine sub | LP 4200Hz | A 12ms, R 80ms | none | dual 61ms/89ms |
| 5 | `"electric-organ"` | B3/Leslie drawbar organ | PeriodicWave drawbars (noteHz/2) | LP 3200Hz | A 6ms, R 30ms | pitch 0.8Hz (rotary) | none |
| 6 | `"glass"` | Glass harmonica / ethereal | sine+sine, ±8¢ | LP 3600Hz | A 280ms, R 1.6s | pitch 0.25Hz ±3¢ | single 38ms |

**PeriodicWave definitions (built once at init, reused across voices):**

Cathedral principals: `partials: [0, 1.00, 0.42, 0.18, 0.10, 0.06, 0.05, 0, 0.03]`

Electric organ drawbars (freq = noteHz/2): `partials: [0, 0.58, 0.95, 0.55, 0.62, 0, 0.28, 0, 0.24, 0, 0.16, 0, 0.12, 0, 0, 0, 0.08]`

#### Step 2: Listen & Refine

Play test progressions (ii–V–I, Adagio, 12-Bar Blues, Giant Steps) through each preset in both Staccato and Legato modes. Also test interactive taps and single-note node taps. User feedback → keep / discard / adjust parameters.

#### Step 3: Lock & Clean

Remove discarded presets. If one winner → remove dropdown, lock into `SYNTH_DEFAULTS`. If 2+ → keep dropdown. Update `ARCH_AUDIO_ENGINE.md §2b`.

### Phase 4: Mobile UAT (remaining)

**4b:** Responsive layout — mobile keyboard interaction with textarea, library scrolling, button tap targets ≥44×44px.
**4c:** Performance — 60fps, <100ms audio latency, SVG element count.
**4d:** iOS Safari remediation (see expanded section below).

### Phase 4d: iOS Safari Remediation (Build)

**Objective:** Fix iOS Safari audio init (app-breaking, confirmed across devices) and verify two cosmetic issues that may be version-specific.

**Testing data:**

| Device / Environment | Audio (Issue 3) | Labels (Issue 1) | Colors (Issue 2) |
|---------------------|-----------------|-------------------|-------------------|
| iPhone 12 mini, iOS 18.6.2 (physical) | ✗ No audio | ✗ Mispositioned | ✗ White after load |
| iPhone 11/12/13, iOS 14.6 (Firefox emulator) | ✗ No audio | ✓ OK | ✓ OK |

**Interpretation:** The audio issue is confirmed across all iOS devices and versions — it's a fundamental WebKit autoplay policy problem. The label positioning (Issue 1) and color bleed (Issue 2) were observed only on physical iOS 18.6.2 and **not reproduced** in the iOS 14.6 emulator. Two possibilities: (a) these are iOS 18.x regressions in WebKit's SVG renderer, or (b) the Firefox emulator doesn't faithfully reproduce Safari's SVG rendering quirks. Either way, they are lower priority than the audio fix and should be verified on a physical device after 4d-1.

**Device matrix:** Primary: Firefox iOS emulator (iPhone 11/12/13, iOS 14.6). Verification: physical iPhone 12 mini (iOS 18.6.2) if available. Regression-check: Chrome desktop + Android after each step.

**Step ordering:** 4d-1 is the only confirmed blocker. 4d-2 and 4d-3 are conditional — execute only if reproduced on a physical device after 4d-1 is complete.

#### 4d-1: Synchronous AudioContext creation (Issue 3 + Issue 4) ✅

Implemented. Synchronous `initAudioSync()` + synchronous `ensureAudio()`. iOS Safari audio confirmed working on emulators (iPhone 11/12/13, iOS 14.6). Pending physical device verification. See DEVLOG Entry 27.

#### 4d-2: SVG label positioning — `dominant-baseline` → `dy` (Issue 1) — CONDITIONAL

**Status:** Not reproduced in iOS 14.6 emulator. Execute only if confirmed on physical iOS 18.6.2+ device after 4d-1.

Safari/WebKit may ignore or misinterpret `dominant-baseline: "central"` on SVG `<text>` elements, causing vertical misalignment of note name labels relative to node circles. Observed on iOS 18.6.2 physical device only. The `dy` fix is low-risk and could be applied preemptively as a cross-browser hardening measure, but is not a confirmed regression on iOS 14.x.

**Changes:**

| File | Lines | Change |
|------|-------|--------|
| `RENDERING_UI/src/renderer.ts` | 208 | Single note label: remove `dominant-baseline`, add `dy="0.35em"` |
| `RENDERING_UI/src/renderer.ts` | 223 | Enharmonic sharp label (top): remove `dominant-baseline`, add `dy="-0.1em"` (shifted up from center) |
| `RENDERING_UI/src/renderer.ts` | 239 | Enharmonic flat label (bottom): remove `dominant-baseline`, add `dy="0.85em"` (shifted down from center) |
| `RENDERING_UI/src/path-renderer.ts` | 230 | Centroid note label: remove `dominant-baseline`, add `dy="0.35em"` |
| `RENDERING_UI/src/path-renderer.ts` | 265 | Active chord label: remove `dominant-baseline`, add `dy="0.35em"` |

**Enharmonic label note:** The sharp (top) and flat (bottom) labels are positioned via `y` offsets from the node center. The `dy` values above are starting points — the split labels need visual tuning so both names are readable within the circle. Single-name labels use the standard `0.35em` centering constant.

**Tests:**
- [ ] All 5 `dominant-baseline` usages replaced with `dy`
- [ ] Existing RU tests pass (text elements still created with correct attributes)
- [ ] Device: iOS Safari — labels centered in node circles
- [ ] Regression: Chrome desktop — labels still centered (no visible shift)

#### 4d-3: Grid label color bleed after progression load (Issue 2) — CONDITIONAL

**Status:** Not reproduced in iOS 14.6 emulator. Execute only if confirmed on physical iOS 18.6.2+ device after 4d-1.

After loading a progression, grid node labels turn white instead of dark grey (`#555`). Observed on iOS 18.6.2 physical device only. Two likely causes:

**(A) Fill inheritance from grid-highlighter:** `activateGridHighlight()` in `grid-highlighter.ts` mutates `fill` on circle elements. If `<text>` labels are children of the same `<g>` group and inherit `fill`, the highlight color (or the `deactivate()` restore value) may bleed into text. Alternatively, `deactivate()` may not restore text `fill` at all if text elements are not in its mutation list.

**(B) Path renderer z-order:** `path-renderer.ts` renders white note-name labels on centroid markers (`layer-path`). If Safari composites `layer-path` text on top of `layer-grid` text differently than Chrome, the white centroid label could occlude the dark grid label at the same node position.

**Diagnosis steps (before fixing):**
1. In `grid-highlighter.ts`, log which elements `deactivate()` restores — check if `<text>` elements are included
2. Add `fill="#555"` explicitly on grid `<text>` elements in `renderer.ts` (breaks inheritance chain regardless of parent mutations)
3. Check if `layer-path` centroid labels overlap `layer-grid` labels at the same `(x, y)` — if so, either offset or suppress the grid label when a centroid label is present

**Changes (preliminary — may expand after diagnosis):**

| File | Change |
|------|--------|
| `RENDERING_UI/src/renderer.ts` | Set `fill="#555"` explicitly on all grid `<text>` elements (currently may be inherited from parent or CSS) |
| `RENDERING_UI/src/grid-highlighter.ts` | Audit `deactivate()` restore list — if text elements are children of mutated groups, either exclude them from mutation or add them to the restore list with their original fill |
| `RENDERING_UI/src/path-renderer.ts` | If centroid labels overlap grid labels: add `pointer-events="none"` and verify z-order, or suppress grid label rendering at centroid positions |

**Tests:**
- [ ] Grid `<text>` elements have explicit `fill` attribute (not inherited)
- [ ] `deactivate()` restores all grid elements including text (if mutated)
- [ ] Device: iOS Safari — load progression → labels remain dark grey
- [ ] Regression: Chrome desktop — label colors unchanged at rest and during playback

### Phase 4e: Node Interaction — Single-Note Playback (Build + Refine)

**Objective:** Tapping a lattice node plays that single pitch. Nodes are enlarged for comfortable touch targets. Visual feedback reuses the orange active-chord marker from path playback. Interaction policy revised: exploration (tap triangle/edge/node + audio) is allowed when a progression is loaded but not playing.

**Decisions:**
- POL-D28: Relax interaction suppression in `progression-loaded` state (allow audio + highlight; suppress only during `playback-running`)
- POL-D29: Node selection highlight = orange disc (same as active chord path marker, `ACTIVE_MARKER_FILL` #e76f51, radius `ACTIVE_MARKER_RADIUS` 0.32) positioned on the tapped node, with note name label inside

#### 4e-1: Interaction policy revision (POL-D28) ✅

Implemented. Three guards removed `"progression-loaded"` from suppression: `isPlaybackSuppressed()`, `selectChord()`, and `main.ts` onPointerDown highlight wrapper. Audio + visual highlighting both work in `progression-loaded`. See DEVLOG Entry 28.

#### 4e-2: HitNode in hit-test (Build) ✅

Implemented. `HitNode` type (`type, nodeId, pc, u, v`) added to `HitResult` union. Node proximity check (NODE_HIT_RADIUS = 0.20) runs before edge check. 8 new tests. See DEVLOG Entry 29.

#### 4e-3: Interaction dispatch for nodes (Build) ✅

Implemented. `onNodeSelect` callback in `InteractionCallbacks`. `hit.type === "node"` → `playPitchClasses([pc])` in `onPointerDown()`. Node grid highlighting via dot-only `activateGridHighlight()` with node lattice coords. See DEVLOG Entry 29.

#### 4e-4: Node selection highlight — orange disc (Build)

Deferred. Current grid-highlighter dot-only highlight (colored stroke on node circle) is functional. Orange disc overlay (POL-D29) is a visual enhancement — implement if the current highlight feels insufficient after user testing.

#### 4e-5: Node size increase (Refine) — OPTIONAL

Deferred. NODE_HIT_RADIUS (0.20) already provides a comfortable touch target larger than the visual node radius (0.15). User testing confirmed current size feels fine. Revisit only if mobile testing reveals touch target issues.

### Phase 5: Final Polish & Review

End-to-end walkthrough, dead code removal, architecture alignment, close all open decisions, documentation pass.

---

## Open Issues

| Issue | Status | Notes |
|-------|--------|-------|
| iOS Safari: no audio, no playback | Tentatively closed | Fixed by 4d-1 (sync AudioContext). Verified on iOS 14.6 emulators. Pending physical device confirmation (iPhone 12 mini, iOS 18.6.2). See Entry 27. |
| iOS Safari: labels, colors | Unconfirmed on iOS 14.x | `dominant-baseline` label positioning + highlight fill bleeding — observed on iOS 18.6.2 physical device only, NOT reproduced in iOS 14.6 emulator. May be iOS 18.x-specific or emulator limitation. Conditional: 4d-2, 4d-3. |
| Mobile audio crackling (budget tablets) | Deferred to Phase 3d/4c | Stale `ctx.currentTime` on large-buffer devices. `safeOffset` fix helped Pixel 6, not Galaxy Tab A7 Lite. Need device diagnostic data + brute-force offset test. See Entry 21 |

## Post-MVP

| Issue | Notes |
|-------|-------|
| Giant Steps symmetric jumps | Requires two-pass global optimizer. Local greedy algorithm cannot resolve symmetric tritone jumps. |
| Tristan chord Am placement | Local algorithm picks geometrically nearest Am; no `CHAIN_BLEND` value fixes it. Needs global optimizer. |
| m7b5 non-root triangle placement | POL-D14 (deferred) |

## Resolved Issues

| Issue | Resolution |
|-------|------------|
| Chain-focus drift | Centroid focus + cluster gravity blend (Entry 18) |
| End-of-progression crackling | Sustain-level release scheduling + graceful completion (Entry 17) |
| Multi-voice attack crackling | Per-voice mixGain 0.24, removed dynamic normalization (Entry 17) |
| Chord transition crackling | Hard-stop previous voices + 10ms fade-out (Entry 15) |
| Placement jumps | Centroid focus + cluster gravity (Entry 18) |
| Drag jitter | Screen-space deltas (Entry 13) |
| Chord continues during drag | `onDragStart` stops audio (Entry 13) |
| Progression viewport clipping on small screens | Rightward focus bias (25% of grid width), MIN_ZOOM 0.25→0.15, MIN_TRI_SIZE_PX 25→18 (Entry 23) |
| safeOffset audio regression on mobile | safeOffset removed from stop/release/cancelRelease, kept only in createVoice; stop fadeOut 10→50ms (Entry 23) |
| Loop last-chord duration asymmetry | Loop mode: scheduler hard-stops at endTime instead of waiting for release tail; `setLoop`/`getLoop` on AudioTransport (Entry 24) |

---

## Decision Log

### Closed

| # | Date | Decision |
|---|------|----------|
| D1 | 02-16 | Sidebar in Integration module (replaces RU layout/panel) |
| D2 | 02-16 | Title: "Tone Nets" / "an interactive Tonnetz explorer" |
| D3 | 02-16 | Synthesis model — subsumed by D19 |
| D4 | 02-16 | Voicing strategy — subsumed by D19 |
| D6 | 02-16 | Interactive press = triad only; playback = full Shape |
| D7 | 02-16 | Chord grammar: input cleaning + HC dim7/m7b5 |
| D8 | 02-17 | Two info overlays (How to Use, What This Is) as full-viewport modals |
| D9 | 02-17 | Two-tab sidebar (Play \| Library) with persistent header |
| D10 | 02-17 | Active chord display → path marker |
| D11 | 02-17 | Playback controls: ▶ ■ 🔁 ✕, no Pause |
| D12 | 02-17 | Library: expandable accordion cards, auto-switch to Play on load |
| D13 | 02-17 | Dot-only centroid = root node position |
| D15 | 02-18 | Shape centroid = root vertex position (path rendering) |
| D16 | 02-18 | Root Motion / Tonal Centroid toggle |
| D17 | 02-18 | 4 beats/chord, no collapsing, 20–960 BPM |
| D18 | 02-21 | Header redesign: larger title, info buttons at sidebar bottom, ● Library icon, SVG loop icon |
| D19 | 02-19 | Staccato/Legato toggle + sustained repeated chords as baseline |
| D20 | 02-19 | Auto-center viewport on progression load |
| D21 | 02-21 | Clear absorbs Reset View (camera + textarea + progression) |
| D22 | 02-21 | 9th chord aliases (X9, X+9 → Xadd9) + silent strip of unrecognized chords |
| D23 | 02-21 | Mobile breakpoint 1024px — sidebar always hamburger-overlay on phones + tablets |
| D24 | 02-21 | Floating transport strip on mobile (below hamburger) when progression loaded + sidebar closed |
| D25 | 02-21 | Auto-hide sidebar on Play (mobile); sidebar open/close manual via hamburger only |
| D26 | 02-21 | Default tempo 150 BPM (page load + Clear) |
| D27 | 02-22 | Share button: URL from window.location + encodeShareUrl, clipboard copy with fallback, ✓ feedback |
| D5 | 02-16 | Mobile proximity radius 0.12 world units — confirmed adequate on Pixel 6, Galaxy Tab A7 Lite, iPhone 12 mini |
| D28 | 02-23 | Relax interaction suppression: allow audio + highlight in `progression-loaded`, suppress only `playback-running` (revises INT-D6) |
| D29 | 02-23 | Node selection highlight: reuse orange active-chord marker disc (#e76f51, r=0.32) with note name label |

### Open

| # | Date | Decision | Status |
|---|------|----------|--------|
| D14 | 02-17 | m7b5 non-root triangle placement | Deferred post-MVP |
