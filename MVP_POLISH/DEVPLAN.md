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

**Phase:** Phases 3a–3c shipped. Placement heuristics refined (centroid focus + cluster gravity blend). Next: header redesign (POL-D18, pending design decision), then Phase 3d (synthesis exploration), then Phase 4 (mobile UAT).
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

Ordered by dependency: envelope cleanup first (fixes crackling independently), then shared VoiceHandle infrastructure (`cancelRelease`), then sustained repeats (identical-chord gate), then per-voice continuation (full voice-diff with mode toggle). Each step is independently shippable.

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

#### Shared Infrastructure: VoiceHandle.cancelRelease() (Build)

3b and 3c both require carrying voices across chord boundaries. The current `VoiceHandle` in `synth.ts` prevents this because:

1. **`release()` is one-shot** — the `released` flag prevents a second call, so a voice whose release was scheduled at `slot.endTime` cannot be rescheduled to a later time.
2. **`release()` calls `osc.stop(t + releaseTime)`** — `OscillatorNode.stop()` is irreversible in the Web Audio API. Once scheduled, the oscillator will stop at that time regardless.

**Fix — two changes to `synth.ts`:**

**A. Remove `osc.stop()` from `release()`**. Instead, schedule a `setTimeout` to disconnect all nodes after the release tail completes (same pattern `stop()` already uses):
```ts
release(releaseWhen?: number): void {
  if (released || stopped) return;
  released = true;
  const t = releaseWhen ?? ctx.currentTime;
  envGain.gain.cancelScheduledValues(t);
  envGain.gain.setValueAtTime(envGain.gain.value, t);
  envGain.gain.linearRampToValueAtTime(0, t + releaseTime);
  // Do NOT call osc.stop() — oscillators must stay alive for cancelRelease().
  // Schedule cleanup after release tail completes.
  setTimeout(() => {
    if (!stopped) handle.stop();
  }, ((t - ctx.currentTime) + releaseTime + 0.05) * 1000);
},
```

**B. Add `cancelRelease()` method**. Resets the `released` flag, cancels the scheduled envelope ramp, and restores the sustain level:
```ts
cancelRelease(): void {
  if (!released || stopped) return;
  released = false;
  const t = ctx.currentTime;
  envGain.gain.cancelScheduledValues(t);
  envGain.gain.setValueAtTime(peakGain * sustainLevel, t);
},
```

**C. Update `VoiceHandle` interface** to expose `cancelRelease():void`.

**Test spec:**

| Test | Assertion |
|------|-----------|
| `release()` does not call `osc.stop()` | After `release()`, oscillator `stop` not called synchronously |
| `cancelRelease()` resets released flag | After `release()` + `cancelRelease()`, a second `release()` fires normally |
| `cancelRelease()` restores sustain level | `envGain.gain.value` equals `peakGain * sustainLevel` after cancel |
| `cancelRelease()` no-op if not released | Calling without prior `release()` does nothing |
| `cancelRelease()` no-op if stopped | Calling after `stop()` does nothing |
| `release()` cleanup still fires if not cancelled | Voice self-cleans after release tail via setTimeout |

**Files:** `AE/src/synth.ts`, tests in `AE/src/__tests__/synth.test.ts`

---

#### 3b: Sustained Repeated Chords (Build)

**Baseline for both modes (POL-D19).** At chord boundary, compare new chord's pitch classes to current chord's pitch classes. If identical (strict — same `chord_pcs` set) → carry voices forward, skip stop/restart entirely. Applies in both Piano and Pad modes.

**Depends on:** 3a (clean boundary behavior) + shared infrastructure (`cancelRelease`).

**Helper — `samePitchClasses()`:**
```ts
function samePitchClasses(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}
```
Duplicated in `scheduler.ts` and `immediate-playback.ts` (5 lines each, not worth a shared module).

**Scheduled playback (`scheduler.ts` → `scheduleChordVoices`):**

After extracting `pcs` for the current slot:
1. If `idx > 0`, extract previous slot's pcs the same way
2. If `samePitchClasses(prevPcs, pcs)`:
   - Per-voice carry: for each voice in `prevSlot.voices`, call `voice.cancelRelease()`, then `voice.release(slot.endTime)`. Move handle to `slot.voices`.
   - Empty `prevSlot.voices` (prevents double-stop in `stopScheduler`)
   - Preserve `state.prevVoicing` (unchanged)
   - Mark `slot.scheduled = true`, return early
3. If different: proceed with 3a behavior (hard-stop previous, voice-lead, create new)

Per-voice carry loop (not array swap) so 3c extends naturally:
```ts
for (const voice of prevSlot.voices) {
  voice.cancelRelease();
  voice.release(slot.endTime);
  slot.voices.push(voice);
}
prevSlot.voices = [];
```

**Immediate playback (`immediate-playback.ts` → `playPitchClasses`):**

Before the hard-stop block:
1. Derive current pitch classes: `[...new Set(state.prevVoicing.map(m => m % 12))].sort((a,b) => a - b)`
2. Sort incoming pcs the same way
3. If `samePitchClasses(currentPcs, sortedIncoming)` → return early (voices keep sounding, no state changes)

**Test spec:**

| Test | Assertion |
|------|-----------|
| Identical chords: no new voices created | `Dm7 Dm7 Dm7` — `createVoice` called once (first chord only) |
| Identical chords: voices carry across slots | After scheduling slot 1, `slot[1].voices.length > 0` and `slot[0].voices.length === 0` |
| Identical chords: `cancelRelease()` called | Each carried voice has `cancelRelease` invoked |
| Identical chords: release rescheduled | Each carried voice has `release(newSlot.endTime)` |
| Different chord after repeats: clean transition | `Dm7 Dm7 G7` — G7 slot hard-stops Dm7 voices, creates new |
| `prevVoicing` preserved across identical chords | After `Dm7 Dm7`, `state.prevVoicing` unchanged from first Dm7 |
| Immediate: identical pcs → no stop/restart | `playPitchClasses(state, [2,5,9])` twice → `voice.stop()` not called on second |
| Immediate: different pcs → normal 3a behavior | `[0,4,7]` then `[2,5,9]` → stop + new voices |
| `samePitchClasses` order-independent | `[0,4,7]` vs `[7,0,4]` → true |
| `samePitchClasses` different lengths → false | `[0,4,7]` vs `[0,4,7,11]` → false |

**Files:** `AE/src/scheduler.ts`, `AE/src/immediate-playback.ts`, tests in `AE/src/__tests__/`

**Acceptance:** Play `Dm7 Dm7 Dm7 G7` — first three chords produce one continuous sound, transition to G7 is a clean cut.

---

#### 3c: Per-Voice Continuation — Pad Mode (Build + Refine)

**POL-D19 toggle.** When pitch classes differ at a chord boundary, diff the MIDI note sets instead of hard-stopping everything:
- **Common tones** (same MIDI note in old and new voicings) → `cancelRelease()` + reschedule release (sustain through boundary)
- **Departing tones** (in old, not in new) → `voice.release()` with musical 500ms tail
- **Arriving tones** (in new, not in old) → `createVoice()` (fresh attack)

Uses existing `voiceLead(prevVoicing, newPcs)` to produce the new MIDI mapping. The diff is: compare `prevVoicing` MIDI notes against `voiceLead` result MIDI notes.

**Depends on:** 3a (clean boundary) + shared infrastructure (`cancelRelease`) + 3b (identical-chord fast path).

**Decision tree at each chord boundary:**
```
if samePitchClasses(prev, curr):
    carry all voices forward                      // 3b — both modes
else if padMode:
    voice-diff: carry common, release departing,
                attack arriving                   // 3c — pad only
else:
    hard stop all + fresh attack                  // 3a — piano only
```

**Scheduled playback (`scheduler.ts` → `scheduleChordVoices`):**

In the `else` branch (pitch classes differ), if `padMode`:
1. Compute `midiNotes = voiceLead(state.prevVoicing, pcs)`
2. Build `Map<number, VoiceHandle>` from `prevSlot.voices` keyed by `voice.midi`
3. For each MIDI in `midiNotes`:
   - If map has a voice for that MIDI → `cancelRelease()`, `release(slot.endTime)`, move to `slot.voices`, delete from map
   - Else → `createVoice(...)`, `release(slot.endTime)`, push to `slot.voices`
4. Remaining voices in map (departing) → `voice.release(slot.startTime)` (musical tail), remove from `prevSlot.voices`
5. Empty `prevSlot.voices`
6. Update `state.prevVoicing = midiNotes`
7. Recalculate `masterGain` for new voice count

**Immediate playback (`immediate-playback.ts` → `playPitchClasses`):**

Same diff logic, simpler — no pre-scheduled releases to cancel:
1. Compute `midiNotes = voiceLead(state.prevVoicing, pcs)`
2. Build `Map<number, VoiceHandle>` from `state.voices` keyed by `voice.midi`
3. Common tones → keep in set. Departing → `voice.release()` (musical tail), remove from set. Arriving → `createVoice()`, add to set.
4. Update `state.prevVoicing = midiNotes`, recalculate master gain

**`padMode` flag plumbing:**

- `SchedulerState`: add `readonly padMode: boolean` (set at creation via `CreateSchedulerOptions`)
- `ImmediatePlaybackState`: add `padMode: boolean` (mutable — integration module flips it via sidebar toggle)
- Integration module: wire sidebar Piano/Pad toggle to set `padMode` on both states

**Edge cases:**

| Case | Handling |
|------|----------|
| MIDI collision (two pitch classes voice-led to same note) | Treat as create-new (Map lookup finds first, second gets fresh voice) |
| Voice count change (`C → Cmaj7`, 3→4 voices) | Master gain recalculated after diff applied |
| Empty `prevVoicing` (first chord) | No diff possible — falls through to normal voice creation |
| `padMode` toggled mid-progression | Takes effect at next chord boundary (no retroactive change) |

**Sidebar toggle:** Piano 🎹 / Pad ♫ control in Play tab. Piano = 3a behavior (hard stop + fresh attack). Pad = voice-diff continuation. Default: Piano (preserves current behavior).

**Test spec:**

| Test | Assertion |
|------|-----------|
| Pad mode: common tone sustains | `C → Am` — voice on E4 (MIDI 64) not stopped, `cancelRelease` called |
| Pad mode: departing tone releases | `C → Am` — voice on G4 `release()` called (not `stop()`) |
| Pad mode: arriving tone attacks | `C → Am` — new voice created for A |
| Pad mode: master gain updated | After diff, `masterGain.gain.value` = `1/√(newCount)` |
| Piano mode: full hard-stop | `C → Am` in piano mode — all C voices stopped, all Am voices fresh |
| 3b fast path still fires in pad mode | `C → C` in pad mode — all voices carry, no diff needed |
| MIDI collision | Two pcs map to same MIDI — both get fresh voices, no crash |
| Toggle mid-progression | Switch piano→pad between chords 2 and 3 — chord 3 uses pad behavior |

**Files:** `AE/src/scheduler.ts`, `AE/src/immediate-playback.ts`, `AE/src/synth.ts` (VoiceHandle interface), `INT/src/sidebar.ts` (toggle), tests in `AE/src/__tests__/`

**Acceptance:** Play `C Am F G` in Pad mode — common tones sustain audibly, departing tones fade out, arriving tones fade in. Toggle to Piano — same progression plays with hard cuts. Toggle back — pad behavior resumes.

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
|-------|------------|
| End-of-progression crackling | Fixed (3 layers): (1) `release()` used `gain.value` (returns 0 at scheduling time) instead of known sustain level → snap to zero; (2) `stopScheduler` hard-stopped voices mid-release-tail; (3) release cleanup called `stop()` redundantly. See Entry 17. |
| Multi-voice attack crackling | Fixed: per-voice mix gain lowered from 0.5 to 0.24 so 4 simultaneous voices never exceed 1.0; removed dynamic masterGain normalization that raced with voice creation (Entry 17) |
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
