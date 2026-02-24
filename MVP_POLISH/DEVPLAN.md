# DEVPLAN — MVP Polish Track

Module: MVP Polish (cross-cutting)
Version: 0.5
Date: 2026-02-24
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

**Next:** 4d-2, 4d-3 (iOS Safari label fixes)

**Completed:**
- 0 (pre-polish bug fixes)
- 1 (UI layout redesign)
- 2 (progression library)
- 3a/3b/3c (audio quality)
- Header redesign (POL-D18)
- Placement heuristics
- Chord input improvements
- 4a (mobile touch + responsive)
- 4d-1 (iOS audio)
- 4e-1/2/3 (node interaction)

**Deferred:**
- 4e-4 (orange disc highlight) — implement if current highlight feels insufficient
- 4e-5 (node size increase) — optional, current touch targets adequate

**Upcoming:** 3d (synthesis) → 4b/4c (mobile UAT) → 5 (final polish)

**Blocked/Broken:** None

**Open decisions:** D14 (m7b5 triangles — deferred post-MVP)

**Known limitations:**
- Mobile audio crackling on budget tablets (see Entry 21)
- Giant Steps / Tristan chord placement (post-MVP)

---

## Completed Phases (summaries — see DEVLOG for detail)

| Phase | Summary | DEVLOG |
|-------|---------|--------|
| 0 | Pre-polish bug fixes: interactive press = triad only (D6), chord grammar expansion (D7) | Entries 2–3 |
| 1 | UI layout: two-tab sidebar, transport controls, tempo slider, info modals | Entries 4–12 |
| 2 | Progression library: 26 entries, 3 views, accordion cards (D12) | Entry 16 |
| 3a/b/c | Audio quality: envelope cleanup, sustained repeats, legato mode | Entries 15, 17 |
| Header | Title redesign (D18), info buttons at bottom, Clear absorbs Reset View (D21) | Entry 19 |
| Placement | Centroid focus + cluster gravity blend, distance-gated root reuse | Entries 16, 18 |
| Chord input | 9th aliases, silent strip of unrecognized symbols | Entry 19 |
| 4a | Mobile touch: pinch-zoom, breakpoint 1024px, floating transport, share button | Entry 20 |
| 4d-1 | iOS Safari audio: synchronous AudioContext creation | Entry 27 |
| 4e-1/2/3 | Node interaction: policy revision (D28), hit-test, dispatch | Entries 28–29 |

**Forward references retained:**
- Supported chord table: see §Supported Chord Reference below
- Mobile proximity radius 0.12 world units (D5) — adequate on tested devices

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

**Detailed plan:** `AUDIO_ENGINE/DEVPLAN_3D.md`
**Progress log:** `AUDIO_ENGINE/DEVLOG_3D.md`
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

#### 4d-2: SVG label positioning — `dominant-baseline` → `dy` (Issue 1)

**Status:** Confirmed on physical devices (iPhone 12 mini iOS 18.6.2, second iPhone). Labels vertically mispositioned within node circles.

**Root cause:** Safari/WebKit doesn't reliably support `dominant-baseline: "central"` on SVG `<text>` elements. Chrome/Firefox use it to vertically center text; Safari ignores or misinterprets it, causing labels to sit at the baseline instead of centered.

**Affected locations (5 total):**

| File | Line | Label Type | Current | Fix |
|------|------|------------|---------|-----|
| `renderer.ts` | 209 | Enharmonic top (sharp) | `dominant-baseline: "central"` | `dy="-0.1em"` |
| `renderer.ts` | 224 | Enharmonic bottom (flat) | `dominant-baseline: "central"` | `dy="0.85em"` |
| `renderer.ts` | 240 | Single note label | `dominant-baseline: "central"` | `dy="0.35em"` |
| `path-renderer.ts` | 231 | Centroid note label | `dominant-baseline: "central"` | `dy="0.35em"` |
| `path-renderer.ts` | 266 | Active chord label | `dominant-baseline: "central"` | `dy="0.35em"` |

**`dy` values explained:**
- `0.35em` = shift down 35% of font height, centering cap-height vertically
- Enharmonic top: negative `dy` shifts up from the already-offset `y` position
- Enharmonic bottom: larger positive `dy` shifts down from the already-offset `y` position
- Values are starting points — may need visual tuning on device

**Tests:**
- [ ] All 5 `dominant-baseline` usages replaced with `dy`
- [ ] Existing RU tests pass (text elements still created with correct attributes)
- [ ] Device: iOS Safari — labels centered in node circles
- [ ] Regression: Chrome desktop — labels still centered (no visible shift)

#### 4d-3: Grid label occlusion by path centroid labels (Issue 2)

**Status:** Confirmed on physical devices. Labels turn white only when a progression is loaded, and only for nodes included in the progression.

**Root cause:** `path-renderer.ts` renders white (`#fff`) centroid note labels at root vertex positions. When a centroid label occupies the same `(x, y)` as a grid label, Safari's SVG compositor renders the white path label on top, occluding the dark `#555` grid label. Chrome handles z-order differently, keeping grid labels visible.

**Diagnosis confirmed:**
- ✓ Happens only when progression loaded (not on interactive taps alone)
- ✓ Affects only nodes in the progression path (root vertices with centroid labels)

**Fix approach — Option A (suppress redundant labels):**
Centroid labels already show the note name at root vertices. The grid label underneath is redundant information. Suppress grid label rendering when a centroid label will occupy the same position.

Implementation: In `path-renderer.ts`, after placing centroid labels, collect the set of node positions with labels. Pass this to a new `hideGridLabels(nodeIds)` function that sets `visibility="hidden"` on the corresponding grid `<text>` elements. On `PathHandle.clear()`, restore visibility.

**Fix approach — Option B (offset centroid labels):**
Offset centroid labels slightly (e.g., `dy` adjustment or small `x/y` shift) so they don't exactly overlap grid labels. Both labels remain visible.

**Recommended:** Option A — cleaner visually, no double-labeling at the same position.

**Changes (Option A):**

| File | Change |
|------|--------|
| `path-renderer.ts` | Collect `Set<NodeId>` of nodes with centroid labels during path rendering |
| `path-renderer.ts` | New helper `hideGridLabels(gridLayer, nodeIds)` — sets `visibility="hidden"` on grid `<text data-id="label-{nodeId}">` elements |
| `path-renderer.ts` | `PathHandle.clear()` calls `restoreGridLabels()` to reset visibility |
| `renderer.ts` | Ensure all grid labels have queryable `data-id` attribute (already present: `data-id="label-{nid}"`) |

**Tests:**
- [ ] Grid labels hidden at centroid positions when path rendered
- [ ] Grid labels restored on `PathHandle.clear()`
- [ ] Device: iOS Safari — no white labels after loading progression
- [ ] Regression: Chrome desktop — grid labels still visible at non-centroid nodes

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
| iOS Safari: label positioning | **Confirmed** | `dominant-baseline: "central"` ignored by Safari. Labels mispositioned in node circles. Fix: replace with `dy` attribute. See 4d-2. |
| iOS Safari: label occlusion | **Confirmed** | White centroid labels (`#fff`) occlude dark grid labels (`#555`) at progression nodes. Safari z-order differs from Chrome. Fix: hide grid labels at centroid positions. See 4d-3. |
| Android: long-press haptic feedback | **Won't fix (web)** | OS-level vibration, cannot suppress from web app. `touch-action: manipulation` tested — broke drag, haptic still fired. See Entry 30. |
| Mobile audio crackling (budget tablets) | Deferred to Phase 3d/4c | Stale `ctx.currentTime` on large-buffer devices. `safeOffset` fix helped Pixel 6, not Galaxy Tab A7 Lite. Need device diagnostic data + brute-force offset test. See Entry 21 |

## Post-MVP

| Issue | Notes |
|-------|-------|
| Giant Steps symmetric jumps | Requires two-pass global optimizer. Local greedy algorithm cannot resolve symmetric tritone jumps. |
| Tristan chord Am placement | Local algorithm picks geometrically nearest Am; no `CHAIN_BLEND` value fixes it. Needs global optimizer. |
| m7b5 non-root triangle placement | POL-D14 (deferred) |
| **Root-in-bass voicing (AE-D19)** | Ensure chord root is lowest note in progression playback. ~2-3h effort. See ARCH_AUDIO_ENGINE.md §3. |

## Resolved Issues

| Issue | Resolution |
|-------|------------|
| iOS Safari: no audio | Sync AudioContext creation (Entry 27, 4d-1). Confirmed working on iOS 14.6 emulators + physical devices. |
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
| D30 | 02-24 | Root-in-bass voicing rule (AE-D19) | Open — see §Post-MVP |
