# DEVPLAN — MVP Polish Track

Module: MVP Polish (cross-cutting)
Version: 0.2
Date: 2026-02-19
References: SPEC.md, UX_SPEC.md, ARCH_AUDIO_ENGINE.md, ARCH_RENDERING_UI.md

---

## Cold Start Summary

**What this is:**
Product-level polish track for the Tonnetz Interactive Harmonic Explorer. All four subsystems are integrated and functional. This track covers UI layout, progression library, audio quality, and mobile UAT.

**Predecessor:** `INTEGRATION/DEVPLAN.md` (closed). Design Passes 1–4 migrated to this DEVLOG as Entries 0a–0e.

**Key constraints:**
- No new subsystem modules — changes touch RU, AE, Integration, PD
- Sidebar: permanent on desktop, hamburger overlay on mobile
- Library: bundled static data, not user-generated
- Audio changes must not break existing tests
- Mobile UAT is a distinct phase, not a checkbox

**Gotchas:**
- `grid-highlighter.ts` mutates `layer-grid` directly — layout changes must not break this
- Library data uses `LibraryEntry` type (extends PD schema with metadata)
- Mobile proximity radius 0.12 world units tuned on desktop — may need mobile adjustment (POL-D5)

---

## Current Status

**Phase:** 0–2 complete. Next: header redesign (POL-D18), auto-center (POL-D20), audio quality (Phase 3).
**Blocked/Broken:** Drag jitter on pan (previously attempted, unresolved). Audio crackling at chord transitions.
**Open decisions:** POL-D3, D4 (audio — superseded by D19), D5 (mobile radius), D14 (m7b5 triangles — deferred post-MVP).

---

## Completed Phases (summary — see DEVLOG for details)

### Phase 0: Pre-Polish Bug Fixes ✅

- **0a: Interactive press extension display** — Resolved as non-bug (POL-D6): idle press = triad only, playback = full Shape. No code change.
- **0b: Chord grammar expansion** — Layer 1: input cleaning in integration (slash bass, ø, Δ, -, sus stripping). Layer 2: HC parser expanded with dim7 + m7b5 (POL-D7).

### Phase 1: UI Layout Redesign ✅

Replaced three-zone layout with two-tab sidebar (Play | Library) in `INTEGRATION/src/sidebar.ts`.

- **1a:** Sidebar shell + responsive layout + hamburger overlay (POL-D1, D9)
- **1b:** Playback controls ▶ ■ 🔁 ✕ + loop toggle (POL-D11)
- **1c:** Tempo controller — slider 20–960 BPM (resolved INT-D8, then POL-D17)
- **1d:** Active chord display — moved to path marker in Entry 12 (POL-D10 → superseded)
- **1e:** Title "Tone Nets" + subtitle (POL-D2)
- **1f:** Info overlay modals — How to Use + What This Is (POL-D8)
- **1g:** Button visual redesign — transport icons, touch sizing, disabled states

Post-Phase 1 improvements:
- POL-D13: Dot-only centroid = root node
- POL-D15: All shape centroids = root vertex position
- POL-D16: Root Motion / Tonal Centroid path toggle with `tonal_centroid_uv` field
- POL-D17: Duration simplification (4 beats/chord, no collapsing, Load merged into Play)
- Entry 12: Chord label on active path marker + white note-name labels on centroid dots + sidebar chord display removed

### Phase 2: Progression Library ✅

~25 curated progressions in `INTEGRATION/src/library/`. Three browsing views (All, By Genre, By Harmonic Feature). Expandable accordion cards (POL-D12). Library load → auto-switch to Play tab.

### Supported Chord Reference

**Directly supported:** maj, min, dim, aug, 7, m7, maj7, 6, add9, 6/9, dim7, m7b5

**Accepted via input cleaning:** slash bass (`C/E` → `C`), dash-minor (`C-7` → `Cm7`), triangle (`CΔ7` → `Cmaj7`), slashed-O (`Cø7` → `Cm7b5`), parenthesized alterations (stripped), sus (stripped with warning)

**Not supported:** aug extended chords, 9/11/13 tensions

---

## Upcoming Work

### Header Redesign (POL-D18)

- Info buttons (`?`, `ⓘ`) → upper-right corner of canvas as overlay icons (semi-transparent at rest, opaque on hover)
- Sidebar header → title-only, larger, no interactive elements
- Library tab icon: `📚` → `♫` (monochromatic, matches `▶`)
- Reset View: stays in sidebar, darker grey font

### Auto-Center Viewport (POL-D20)

After loading a progression (manual or library), auto-fit camera to show the entire path.
1. Compute bounding box of all shape centroids in world coordinates
2. `fitToBounds(bbox)` on CameraController — center + zoom from bbox vs viewport
3. Call after `renderProgressionPath()` in `loadProgressionFromChords()`
4. Snap initially; smooth animation as future refinement

### Phase 3: Audio Quality

**Baseline fix (both modes):** Consecutive identical chords sustain as one continuous sound — detect identical pitch classes at chord boundary, skip voice stop/restart. This is default behavior, not mode-dependent (POL-D19).

**Piano/Pad toggle (POL-D19):** Two playback modes as sidebar toggle:

🎹 **Piano (discrete):** Different chords = full stop + fresh attack. Short attack, clean release (fixes crackling). Identical chords sustain.

♫ **Pad (continuous):** Per-voice continuation — common tones sustain, only changing voices crossfade. Voice-diff at chord boundary using existing `voiceLead()`. Longer envelopes. Identical chords sustain.

**3a: Synthesis exploration** — Waveform combinations, reverb, filter tuning, envelope tweaks. Iterative listening. (POL-D3 superseded by D19 toggle approach.)

**3b: Voicing comparison** — Current greedy minimal-motion vs root-bottom voicing. A/B listening test. (POL-D4 superseded by D19.)

**3c: Register & blend** — Default register tuning, voice-count normalization, release overlap.

### Phase 4: Mobile UAT

**4a: Touch interaction** — Tap, hold, drag, pinch. Proximity radius adequacy (POL-D5). No accidental edge selections.

**4b: Responsive layout** — Hamburger menu, sidebar overlay, textarea on mobile keyboard, library scrolling, button tap targets ≥44×44px.

**4c: Performance** — 60fps target during playback, <100ms audio latency, SVG element count, memory.

**4d: Cross-device** — iOS Safari, Android Chrome, desktop regression. URL sharing cross-device.

### Phase 5: Final Polish & Review

- End-to-end walkthrough
- Dead code removal, architecture alignment
- Close all open decisions, documentation pass

---

## Open Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Drag jitter on pan | Unresolved | Previously attempted. Needs investigation. |
| Audio crackling at chord transitions | Open | Fixed by D19 envelope cleanup + sustained repeats |

---

## Decision Log

Decisions are listed once. See DEVLOG entries for implementation details.

### Closed

| # | Date | Decision |
|---|------|----------|
| D1 | 02-16 | Sidebar in Integration module (replaces RU layout/panel) |
| D2 | 02-16 | Title: "Tone Nets" / "an interactive Tonnetz explorer" |
| D6 | 02-16 | Interactive press = triad only; playback = full Shape (not a bug) |
| D7 | 02-16 | Chord grammar: input cleaning + HC dim7/m7b5 |
| D8 | 02-17 | Two info overlays (How to Use, What This Is) as full-viewport modals |
| D9 | 02-17 | Two-tab sidebar (Play \| Library) with persistent header |
| D10 | 02-17 | Active chord display (superseded — moved to path marker, Entry 12) |
| D11 | 02-17 | Playback controls: ▶ ■ 🔁 ✕, no Pause |
| D12 | 02-17 | Library: expandable accordion cards, auto-switch to Play on load |
| D13 | 02-17 | Dot-only centroid = root node position |
| D15 | 02-18 | All shape centroids = root vertex position |
| D16 | 02-18 | Root Motion / Tonal Centroid toggle (display-only, chain focus always uses root) |
| D17 | 02-18 | 4 beats/chord, no collapsing, Load merged into Play, 20–960 BPM, rootPc unification |
| D18 | 02-19 | Header redesign: info icons → canvas overlay, larger title, ♫ Library icon, darker Reset View |
| D19 | 02-19 | Piano/Pad toggle + sustained repeated chords as baseline for both modes |
| D20 | 02-19 | Auto-center viewport on progression load via fitToBounds(bbox) |

### Open

| # | Date | Decision | Status |
|---|------|----------|--------|
| D3 | 02-16 | Synthesis model | Superseded by D19 toggle; retained as sub-task of Phase 3a |
| D4 | 02-16 | Voicing strategy (root position) | Superseded by D19; retained as sub-task of Phase 3b |
| D5 | 02-16 | Mobile proximity radius | Deferred to Phase 4a |
| D14 | 02-17 | m7b5 non-root triangle placement | Deferred post-MVP |
