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

**Phase:** Phase 3a shipped. Library complete (26 entries). Placement heuristics refined. Next: header redesign (POL-D18), then Phase 3b (sustained repeats).
**Blocked/Broken:** None.
**Open decisions:** POL-D5 (mobile radius), D14 (m7b5 triangles — deferred post-MVP).
**Known limitations:** Giant Steps' symmetric tritone jumps resolve inconsistently — requires two-pass global optimizer (future).

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

### Phase 3: Audio Quality

Ordered by dependency: envelope cleanup first (fixes crackling independently), then sustained repeats (simple gate), then per-voice continuation (full voice-diff). Each step is independently shippable.

#### 3a: Envelope Cleanup — Fix Crackling at Chord Transitions (Build)

**Root cause:** `scheduleChordVoices()` in `scheduler.ts` creates new voices at `slot.startTime` while the previous chord's voices are still in their 0.5s release tail (`SYNTH_DEFAULTS.releaseTime`). Two sets of oscillators overlap — the decaying release envelope and the rising attack envelope sum to >1.0, causing clipping.

The same pattern exists in `playPitchClasses()` in `immediate-playback.ts`: `voice.release()` starts a 0.5s tail, then new voices attack immediately on top.

**Fix (scheduled playback — `scheduler.ts`):**

In `scheduleChordVoices(state, idx)`, before creating new voices:
1. If `idx > 0`, get the previous slot `state.chords[idx - 1]`
2. Hard-stop (`voice.stop()`) all previous slot's voices at the new slot's `startTime`
   - Cannot use `release()` here — the release tail is what causes the overlap
   - `stop()` disconnects immediately, no tail
3. This means each chord gets exclusive use of the audio output — clean cut

**Concretely, insert before line 184 (`// Create voices scheduled at the chord start time`):**
```ts
// Hard-stop previous chord's voices at this chord's start time
// to prevent release-tail overlap (crackling fix)
if (idx > 0) {
  const prevSlot = state.chords[idx - 1];
  for (const voice of prevSlot.voices) {
    voice.stop();
  }
  prevSlot.voices = [];
}
```

**Fix (immediate playback — `immediate-playback.ts`):**

In `playPitchClasses()`, change `voice.release()` to `voice.stop()`:
```ts
// Before (crackling — 0.5s release tail overlaps new attack):
for (const voice of state.voices) {
  voice.release();
}

// After (clean cut — no overlap):
for (const voice of state.voices) {
  voice.stop();
}
```

**Tradeoff:** Hard stop produces a click at the boundary (instantaneous amplitude discontinuity). Mitigate with a very short fade-out (5–10ms ramp to zero before disconnect) in `VoiceHandle.stop()`. This is shorter than `releaseTime` (500ms) but long enough to avoid a DC click:
```ts
// In synth.ts, stop() method:
const fadeOut = 0.01; // 10ms
envGain.gain.cancelScheduledValues(ctx.currentTime);
envGain.gain.setValueAtTime(envGain.gain.value, ctx.currentTime);
envGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
osc1.stop(ctx.currentTime + fadeOut + 0.01);
osc2.stop(ctx.currentTime + fadeOut + 0.01);
```

**Test spec:**

| Test | Assertion |
|------|-----------|
| Previous chord voices stopped at boundary | After scheduling chord 1, `prevSlot.voices` is empty |
| No voice overlap in 2-chord progression | At any point, only one chord's voices are active |
| Hard stop uses short fade | `envGain.gain.linearRampToValueAtTime` called with ~10ms window |
| Immediate playback uses stop not release | `voice.stop()` called, not `voice.release()` |
| Existing release behavior preserved for pointer-up | Interactive `stopAll()` still calls `stop()` (no change) |
| Backward compat: single-chord progression | No previous slot → no stop call, voices play normally |

**Files:** `AE/src/scheduler.ts`, `AE/src/synth.ts`, `AE/src/immediate-playback.ts`, tests in `AE/src/__tests__/`

**Acceptance:** Play a 4-chord progression (e.g., Dm7 → G7 → Cmaj7 → Am7) — no crackling, clicks, or audible artifacts at transitions.

#### 3b: Sustained Repeated Chords (Build)

**Baseline for both modes (POL-D19).** At chord boundary, compare new chord's pitch classes to current chord's pitch classes. If identical → skip voice stop/restart entirely, let existing voices keep sounding.

**Where:** Gate at the top of `scheduleChordVoices()` and `playPitchClasses()`. Compare as sorted pitch-class arrays (order-independent).

**Depends on:** 3a (clean boundary behavior must be established first).

**Test spec:** `Dm7 Dm7 Dm7 G7` — first three chords produce one continuous sound, transition to G7 is a clean cut.

#### 3c: Per-Voice Continuation — Pad Mode (Build + Refine)

**POL-D19 toggle.** At chord boundary, diff old MIDI notes vs new MIDI notes:
- Common tones → sustain (no stop, no re-attack)
- Departing tones → release (with envelope tail)
- Arriving tones → attack (new voice)

Uses existing `voiceLead()` to produce the MIDI mapping; the diff falls out from comparing `prevVoicing` to `newVoicing`.

**Depends on:** 3a (clean boundary) + 3b (sustained repeats as special case of zero-diff).

**Sidebar toggle:** Piano 🎹 / Pad ♫ control. Piano = 3a behavior (hard stop + fresh attack). Pad = voice-diff continuation.

#### 3d: Synthesis & Voicing Exploration (Refine)

Waveform combinations, reverb, filter tuning, envelope tweaks, voicing comparison (greedy minimal-motion vs root-bottom), register & blend. Iterative listening sessions — goals and constraints only, values emerge from feedback.

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
| Giant Steps symmetric jumps | Known limitation | Requires two-pass global optimizer (future) |

## Resolved Issues

| Issue | Resolution |
|-------|-----------|
| Audio crackling at chord transitions | Fixed: hard-stop previous voices before new attack + 10ms fade-out (Entry 15) |
| Drag jitter on pan | Fixed: switched from world-space differencing to screen-space deltas (Entry 13) |
| Chord continues during drag | Fixed: `onDragStart` callback stops audio when drag threshold exceeded (UX-D4, Entry 13) |

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
| D20 | 02-19 | Auto-center viewport on progression load via fitToBounds(bbox) — Entry 14 |
| D3 | 02-16 | Synthesis model — closed, subsumed by D19 (Phase 3a) |
| D4 | 02-16 | Voicing strategy — closed, subsumed by D19 (Phase 3b) |

### Open

| # | Date | Decision | Status |
|---|------|----------|--------|
| D5 | 02-16 | Mobile proximity radius | Deferred to Phase 4a |
| D14 | 02-17 | m7b5 non-root triangle placement | Deferred post-MVP |
