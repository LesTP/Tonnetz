# DEVPLAN — MVP Polish Track

Module: MVP Polish (cross-cutting)
Version: 0.6
Date: 2026-02-25
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

**Next:** 4c (performance) → 5 (final polish)

**Active sub-track:** `MVP_POLISH/DEVPLAN_SIDEBAR.md` — multi-pass sidebar redesign (compact → library rework → tab merge)

**Completed:**
- 0 (pre-polish bug fixes)
- 1 (UI layout redesign)
- 2 (progression library)
- 3a/3b/3c (audio quality)
- Header redesign (POL-D18)
- Placement heuristics
- Chord input improvements
- 4a (mobile touch + responsive)
- 4b (responsive layout — user confirmed on physical devices)
- 4d-1 (iOS audio)
- 4e-1/2/3 (node interaction)
- 3d (synthesis presets: 4 presets ship, dropdown UI, limiter)
- 4d-2 (iOS Safari SVG label positioning)
- 4d-3 (grid label occlusion — resolved by 4d-2)
- Sidebar: width 320px, mobile background fix, iOS mute switch UX copy

**Deferred:**
- 4e-4 (orange disc highlight) — implement if current highlight feels insufficient
- 4e-5 (node size increase) — optional, current touch targets adequate

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
| 4b | Responsive layout: mobile keyboard interaction, library scrolling, button tap targets — user confirmed on physical devices | Entry 33 |
| 4d-1 | iOS Safari audio: synchronous AudioContext creation | Entry 27 |
| 4e-1/2/3 | Node interaction: policy revision (D28), hit-test, dispatch | Entries 28–29 |
| 3d Step 1 | Synthesis presets: infrastructure, 6 presets, effects chain, limiter (AE-D17), integration wiring, 332 AE tests | DEVLOG_3D Entries 1–6 |
| 3d | Synthesis closed: 4 presets ship (Soft Pad, Warm Pad, Cathedral, Electric Organ). Breathing Pad + Glass Harmonica removed, Classic→Soft Pad. | DEVLOG_3D Entries 7–8 |
| 4d-2 | iOS Safari SVG labels: `dominant-baseline` → `dy` (5 locations) | Entry 31 |
| 4d-3 | Grid label occlusion: resolved by 4d-2 fix | Entry 31 |
| Sidebar | Width 300→320px, mobile background fix, iOS mute switch UX copy | Entry 31 |

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

### Phase 3d: Synthesis Exploration ✅

Completed. 4 presets ship. See `AUDIO_ENGINE/DEVPLAN_3D.md` (closed) and `AUDIO_ENGINE/DEVLOG_3D.md` Entries 1–8.

### Phase 4d: iOS Safari Remediation ✅

Completed. 4d-1 (audio init), 4d-2 (SVG labels), 4d-3 (label occlusion). See DEVLOG Entries 27, 31.

### Phase 4e: Node Interaction ✅ (core) + deferred enhancements

Completed (4e-1/2/3). See DEVLOG Entries 28–29. Deferred:

- **4e-4:** Orange disc node highlight — implement if current dot-only highlight feels insufficient
- **4e-5:** Node size increase — NODE_HIT_RADIUS (0.20) already adequate; revisit if mobile testing reveals issues

### Phase 4: Mobile UAT (remaining)

**4c:** Performance — 60fps, <100ms audio latency, SVG element count.

### Phase 5: Final Polish & Review

End-to-end walkthrough, dead code removal, architecture alignment, close all open decisions, documentation pass.

---

## Open Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Android: long-press haptic feedback | **Won't fix (web)** | OS-level vibration, cannot suppress from web app. `touch-action: manipulation` tested — broke drag, haptic still fired. See Entry 30. |
| Mobile audio crackling (budget tablets) | Deferred to Phase 4c | Stale `ctx.currentTime` on large-buffer devices. `safeOffset` fix helped Pixel 6, not Galaxy Tab A7 Lite. Need device diagnostic data + brute-force offset test. See Entry 21 |

## Post-MVP

| Issue | Notes |
|-------|-------|
| Giant Steps symmetric jumps | Requires two-pass global optimizer. Local greedy algorithm cannot resolve symmetric tritone jumps. |
| Tristan chord Am placement | Local algorithm picks geometrically nearest Am; no `CHAIN_BLEND` value fixes it. Needs global optimizer. |
| m7b5 non-root triangle placement | POL-D14 (deferred) |
| **Root-in-bass voicing (AE-D19)** | Ensure chord root is lowest note in progression playback. ~2-3h effort. See ARCH_AUDIO_ENGINE.md §3. |
| **Synthesis preset tuning** | 4 presets ship. Revisitable if future listening reveals parameter issues during normal use. |

## Resolved Issues

| Issue | Resolution |
|-------|------------|
| iOS Safari: label positioning | `dominant-baseline: "central"` → `dy: "0.35em"` at 5 locations (Entry 31, 4d-2) |
| iOS Safari: label occlusion | Resolved by 4d-2 fix — baseline correction eliminated the overlap (Entry 31, 4d-3) |
| iOS Safari: no audio | Sync AudioContext creation (Entry 27, 4d-1). Confirmed working on iOS 14.6 emulators + physical devices. |
| Loop start crackling | DynamicsCompressorNode limiter (AE-D17, DEVLOG_3D Entry 6) |
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
