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

**Phase:** Phases 0–3 and header redesign complete. Next: Phase 3d (synthesis exploration), then Phase 4 (mobile UAT).
**Blocked/Broken:** None.
**Open decisions:** POL-D5 (mobile radius), D14 (m7b5 triangles — deferred post-MVP).
**Known limitations:** Giant Steps symmetric jumps; Tristan chord Am placement (both require global optimizer).

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

### Phase 3d: Synthesis & Voicing Exploration (Refine)

Waveform combinations, reverb, filter tuning, envelope tweaks, voicing comparison. Iterative listening sessions — goals and constraints only, values emerge from feedback.

### Phase 4: Mobile UAT

**4a:** Touch interaction — tap, hold, drag, pinch. Proximity radius (POL-D5).
**4b:** Responsive layout — hamburger, sidebar overlay, mobile keyboard, tap targets ≥44×44px.
**4c:** Performance — 60fps, <100ms audio latency, SVG element count.
**4d:** Cross-device — iOS Safari, Android Chrome, URL sharing.

### Phase 5: Final Polish & Review

End-to-end walkthrough, dead code removal, architecture alignment, close all open decisions, documentation pass.

---

## Open Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Giant Steps symmetric jumps | Known limitation | Requires two-pass global optimizer (future) |
| Tristan chord Am placement | Known limitation | Local algorithm picks left Am; no CHAIN_BLEND value fixes it |

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

### Open

| # | Date | Decision | Status |
|---|------|----------|--------|
| D5 | 02-16 | Mobile proximity radius | Deferred to Phase 4a |
| D14 | 02-17 | m7b5 non-root triangle placement | Deferred post-MVP |
