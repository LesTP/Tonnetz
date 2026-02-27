# DEVLOG — Sidebar Redesign

Module: MVP Polish / Sidebar Redesign
Started: 2026-02-27

---

---

---

---

## Entry 8 — Library Content Enrichment: Pop/Rock + Jazz (Code)

**Date:** 2026-02-27

### Summary

Enriched all Pop/Rock (10 entries) and Jazz (11 entries) library card comments with full analysis, other examples, and HTML-formatted lists from `prog names.md`. Combined with Entry 7 (Blues/Trad/Folk + Turnaround), 27 of 28 library entries now have expanded content. Classical entries left as-is (harmonic feature tags need accuracy review first).

### Pop/Rock entries updated (10)

| Entry | Content Added |
|-------|--------------|
| Twist And Shout (I-IV-V) | Rock Progression analysis + 6 examples |
| Let It Be (I-V-vi-IV) | "Sensitive female" origin + 6 examples incl. rotations |
| Stand by Me (I-vi-IV-V) | Bass-in-thirds analysis + 6 examples incl. Grease self-parody |
| Walk, Don't Run (Descending Tetrachord) | Andalusian cadence history + 7 examples incl. flamenco keys |
| Hit The Road Jack (Aeolian Descent) | Modal perspective + cross-reference to Descending Tetrachord |
| On Broadway (Dorian Vamp) | Double tonic in world music + 4 examples |
| Gloria (Mixolydian Rock) | 4 common variations charted + 2 examples |
| In My Life (Modal Interchange) | Cole Porter lyric reference + 5 examples incl. backdoor |
| Because (Neapolitan Sixth) | Voice leading detail + 3 classical + 4 pop examples |
| Lady Madonna (Mario Cadence) | V-I vs IV-I vs ♭VII-I cadence comparison + 4 examples |

### Jazz entries updated (11)

| Entry | Content Added |
|-------|--------------|
| Satin Doll (ii-V-I) | Voice-leading detail + 5 examples incl. Bach |
| All The Things You Are (Descending Fifths) | "Winning formula" quote + 5 examples incl. Autumn Leaves |
| Sweet Georgia Brown (Circle of Dominants) | Ragtime chromatic lines + 5 examples incl. Liszt |
| Ain't Misbehavin' (Ascending Chromatic Bass) | Diminished cliché + Joplin + 5 examples |
| My Funny Valentine (Descending Chromatic Bass) | Minor cliché textures + 6 examples incl. Pachelbel |
| Have You Met Miss Jones? (Chromatic Mediant) | Equidistancy / tonal destabilization + 3 examples |
| Giant Steps (Coltrane Changes) | Slonimsky + Miss Jones inspiration + 5 contrafacts |
| Lazy Bird (Tritone Substitution) | Tritone sharing + "diabolus in musica" + 4 patterns |
| Cherokee (Backdoor Progression) | Front door vs backdoor + 5 examples |
| I Got Rhythm (Rhythm Changes) | Sears Roebuck bridge + 6 contrafacts |
| All The Things You Are — Modulation (Rosalia) | Sequence definition + circle of fifths traversal |

### Files Changed

| File | Changes |
|------|---------|
| `INTEGRATION/src/library/library-data.ts` | 21 entries: expanded comments with HTML lists |

### Test Results

- INT: 235 passed, 0 failures

---

## Entry 7 — Library Content Enrichment + Genre Merge + Share URL Cleanup (Code)

**Date:** 2026-02-27

### Summary

Three improvements: (1) expanded library card comments for blues + trad/folk entries with full analysis, lists, and examples from `prog names.md`; (2) merged Blues and Traditional/Folk genres into single "Blues / Trad / Folk" tag; (3) simplified share URLs by removing legacy `&g=` (grid) and `&v=` (schema version) parameters.

### 1. Library card comment enrichment

Switched comment rendering from `textContent` to `innerHTML` to support HTML formatting. Added CSS for lists (`ul`, `li`, `b`) inside comment divs. Updated 6 entries with full content:

| Entry | Content Added |
|-------|--------------|
| I Got Rhythm (Turnaround) | 9 turnaround types charted as list + 4 other examples |
| Johnny B. Goode (12-Bar Blues) | Standard form chart + 6 other examples |
| Greensleeves (Lament Bass) | 3 form variants (passamezzo, La Folia, romanesca) + 5 other examples |
| Amazing Grace | I-IV-V harmonic structure breakdown + 4 folk hymn examples |
| House of the Rising Sun | Dorian inflection analysis + 3 Am examples |
| Scarborough Fair | Dorian modal characteristics + 3 Dorian examples |

### 2. Genre merge

Consolidated `"Blues"` (1 entry) and `"Traditional / Folk"` (4 entries) into `"Blues / Trad / Folk"` (5 entries). Genre filter tab now shows them as a single group.

### 3. Share URL simplification

**Before:** `#p=Am-C-D-F&t=120&g=4&v=1`
**After:** `#p=Am-C-D-F&t=120`

- Removed `&g=` (grid denominator) — legacy from pre-POL-D17 duration model, always `4`
- Removed `&v=` (schema version) — always `1`, no released users to maintain compat for
- `SharePayload` type simplified to `{ tempo_bpm, chords }` (moved from `types.ts` to `sharing.ts`)
- `encodeShareUrl` / `decodeShareUrl` simplified — no grid/version encoding/decoding
- Grid conversion maps (`GRID_TO_DENOM`, `DENOM_TO_GRID`) removed from `sharing.ts`
- `decodeShareUrl` now ignores unknown parameters (graceful forward compat)

### Files Changed

| File | Changes |
|------|---------|
| `INTEGRATION/src/library/library-data.ts` | 6 entries: expanded comments with HTML, genre "Blues"/"Traditional / Folk" → "Blues / Trad / Folk" |
| `INTEGRATION/src/library/library-ui.ts` | Comment rendering: `textContent` → `innerHTML`; CSS: `ul`/`li`/`b` styling in comments |
| `INTEGRATION/src/main.ts` | Removed `grid: "1/4"` from `generateShareUrl` call |
| `PERSISTENCE_DATA/src/sharing.ts` | Rewritten: `SharePayload` simplified, grid/version removed from encode/decode |
| `PERSISTENCE_DATA/src/types.ts` | `SharePayload` interface removed (now in `sharing.ts`) |
| `PERSISTENCE_DATA/src/index.ts` | `SharePayload` re-exported from `sharing.js` instead of `types.js` |
| `PERSISTENCE_DATA/src/__tests__/sharing.test.ts` | Rewritten for simplified API (13 tests) |
| `PERSISTENCE_DATA/src/__tests__/integration-e2e.test.ts` | Removed grid round-trip tests, updated SharePayload type check |
| `INTEGRATION/src/__tests__/persistence-wiring.test.ts` | Removed `.grid` assertions from share URL tests |
| `INTEGRATION/src/__tests__/integration-flow.test.ts` | Removed `.grid` assertion from URL hash test |
| `INTEGRATION/src/__tests__/smoke.test.ts` | Updated share URL round-trip test (no grid) |

### Test Results

- PD: 102 passed
- INT: 235 passed
- Total: 337 passed, 0 failures

---

## Entry 6 — Pass 3 + Polish: Tab Merge, Alignment, Scrollbar (Code)

**Date:** 2026-02-27

### Summary

Merged library into the Play tab as a single scrollable view. Removed the tab bar entirely. Added separator lines for visual structure. Fixed right-edge alignment issues caused by the native scrollbar stealing layout width — replaced with thin custom scrollbar. Fixed info footer button alignment.

### Changes

**1. Tab merge: library inline in Play panel**
- Library list (`libraryList`) moved into the play panel, below a separator `<hr>`
- Separate library panel (`libraryPanel`) removed
- Tab bar DOM removed (play/library tab buttons)
- Tab switching logic removed (`switchTab`, `handleTabClick`, `activeTab` state)
- `switchToTab()` preserved as no-op for backward compat

**2. Root/Tonal path mode toggle removed**
- `pathModeBtn` removed from settings row and DOM
- `handlePathModeToggle`, `pathMode` state removed from sidebar.ts
- `onPathModeChange` removed from `SidebarOptions` interface
- `getPathMode()` removed from `Sidebar` interface
- `handlePathModeChange` function and `onPathModeChange` callback removed from main.ts
- Path mode hardcoded to "root" in `loadProgressionFromChords()` (always root motion)

**3. Sound dropdown + Staccato/Legato on one row**
- Preset dropdown and playback mode toggle share the settings row
- "Sound" label removed; dropdown styled to match toggle button (same font size, border, color)
- Old `presetSection`, `presetLabel` CSS classes removed

**4. Separator lines**
- `<hr>` separator between controls and library (`.tonnetz-sidebar-separator`)
- `border-bottom` on header (between title and content)
- `border-top` on info footer (between library and about buttons)

**5. Thin custom scrollbar**
- Native ~15px scrollbar replaced with 6px thumb on both `.sidebarScroll` and `.tabPanel`
- WebKit: `::-webkit-scrollbar` (width 6px, transparent track, subtle thumb)
- Firefox: `scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.12) transparent`
- Tempo group made flexible (`flex-shrink: 1; min-width: 0`) to absorb the 6px when needed

**6. Info footer alignment**
- Right padding increased from 14px to 20px (14px base + 6px scrollbar) so footer content width matches the scrollbar-reduced panel content width
- Added `box-sizing: border-box; width: 100%`

**7. Transport row no-wrap**
- Removed `flex-wrap: wrap` from transport row to prevent line breaks when scrollbar appears

### Decisions

- **SB-D5** (Closed): Option D — teal triangle play button on library cards, no Load button, expand is informational only
- **SB-D6** (new, Closed): Root/Tonal toggle removed — nobody uses it, hardcode root motion
- **SB-D7** (new, Closed): Tab bar removed — single scrollable panel replaces two-tab layout
- **SB-D8** (new, Closed): Thin custom scrollbar (6px) to prevent layout width shifts

### Files Changed

| File | Changes |
|------|---------|
| `INTEGRATION/src/sidebar.ts` | Tab bar removed, library inline, path toggle removed, settings row merged, scrollbar CSS, separator lines, footer alignment, transport no-wrap |
| `INTEGRATION/src/main.ts` | `handlePathModeChange` removed, `onPathModeChange` removed from sidebar options, path mode hardcoded to root, library `onLoad` adds `handlePlay()` + `sidebar.close()` |
| `INTEGRATION/src/library/library-ui.ts` | Teal triangle play button on cards, Load button removed, duplicate chords section removed, card summary restructured |
| `INTEGRATION/src/__tests__/sidebar.test.ts` | Tab tests replaced with single-panel tests, library-in-panel test, separator test |

### Test Results

- INT: 235 passed, 0 failures

### Contract Changes
- UX_SPEC.md §4: tab bar removed, library inline in single panel, path mode toggle removed, separator lines added

## Entry 4 — Pass 2 Implementation: Library Card Redesign (Code)

**Date:** 2026-02-27

### Summary

Implemented library card redesign (SB-D5, Option D). Added teal triangle play button to collapsed card headers. Removed Load button and duplicate chords section from expanded cards. Triangle click = load + play + close sidebar on mobile. Card header click = expand/collapse (purely informational).

### Changes

**1. Teal triangle play button on collapsed card**
- Right-aligned in summary row (flex layout: text column + triangle button)
- SVG triangle: 18×18, teal fill (`#2a9d8f`), pointing right
- Hover: light teal background (`#e8f6f4`)
- 32×32 tap target, `aria-label="Play {title}"`
- `stopPropagation()` prevents card expand on triangle click

**2. Removed Load button from expanded cards**
- No `loadBtn` element created
- Detail section is purely informational: comment + tempo/feature info

**3. Removed duplicate chords from expanded card bottom**
- `chordsEl` (monospace chord list) removed from detail
- Chords are already shown as preview in the collapsed summary

**4. Auto-play on library load**
- `onLoad` callback in `main.ts` now calls `handlePlay()` after loading
- `sidebar.close()` called to dismiss sidebar on mobile
- Existing stop-if-playing + tempo-set + textarea-update behavior preserved

**5. Summary layout restructured**
- Summary row: `display: flex; align-items: center` (was `flex-direction: column`)
- Text content wrapped in a flex-1 column div (title, meta, preview)
- Triangle button sits right-aligned outside the text column

### CSS Changes

| Removed | Added |
|---------|-------|
| `.tonnetz-lib-load-btn` | `.tonnetz-lib-play-btn` (triangle button) |
| `.tonnetz-lib-chords` | — |

### Files Changed

| File | Changes |
|------|---------|
| `INTEGRATION/src/library/library-ui.ts` | Card restructure: summary layout, play triangle, removed Load button + chords section |
| `INTEGRATION/src/main.ts` | Library `onLoad`: added `handlePlay()` + `sidebar.close()` for auto-play |

### Test Results

- INT: 238 passed, 0 failures

### Decision

SB-D5 (Closed): Option D — triangle play button, no Load button, expand is informational only.

## Entry 1 — Pass 1 Planning: Play Tab Compaction (Discuss)

**Date:** 2026-02-27

### Summary

Design session for sidebar redesign. Identified the core UX problem: loading a new progression from the library requires 4–6 clicks across two tabs. Planned a three-pass approach: (1) compact the Play tab, (2) simplify library cards, (3) merge tabs into single view.

### Problem

Most common workflow — load progression → play → load a different one — requires: Library tab switch → filter/scroll → expand card → Load → Play. Too many steps.

### Pass 1 Plan: 7 Changes

1. Remove "Progression:" label (redundant with placeholder text)
2. Combine Play/Stop into a single toggle button (matches floating strip)
3. Replace "CLEAR" text with ✕ icon button (matches floating strip)
4. Replace tempo slider with inline numeric BPM field in transport row
5. Root Motion / Tonal Centroid → single toggle button
6. Staccato / Legato → single toggle button
7. Both toggles on a shared settings row

**Estimated vertical savings:** ~100px — enough for 2–3 library cards in the eventual merged view.

### Layout After Pass 1

```
[textarea — no label]
[▶/■] [🔁] [🔗] [✕]  [150▕BPM]
[Root ↔ Tonal]   [Stacc ↔ Legato]
Sound [Cathedral Organ ▼]
```

### Decisions Opened

| # | Decision | Status |
|---|----------|--------|
| SB-D1 | Play/Stop toggle replaces separate buttons | Closed |
| SB-D2 | Tempo numeric field replaces slider | Closed |
| SB-D3 | Single-button toggles for binary settings | Closed |
| SB-D4 | Clear button uses ✕ icon | Closed |

### Deferred

- Sound preset dropdown — left as-is for now; revisit after Pass 1 visual evaluation
- Tab bar removal — Pass 3
- Library card redesign — Pass 2

### No Files Changed

Planning-only entry. DEVPLAN_SIDEBAR.md created.

---

## Entry 2 — Pass 2 Planning: Library Card Redesign (Discuss)

**Date:** 2026-02-27

### Summary

Design session for library card interaction. Identified the core tension: play intent (fewest clicks) vs. browse intent (read details) share the same card surface. Evaluated four options (A–D). Selected Option A: ▶ button on collapsed card.

### Problem

Current library flow requires 3 clicks to load + play: expand card → Load → Play. Additionally, if a progression is playing and the user wants to identify it, they must navigate back to the Library tab — a problem that dissolves once tabs are merged (Pass 3).

### Options Evaluated

| Option | Mechanism | Pro | Con |
|--------|-----------|-----|-----|
| A (selected) | ▶ on collapsed card; tap body = expand | Cleanly separates browse/play; familiar pattern | ▶ target small-ish on mobile |
| B | Tap card = load only; ▶ = play | Tap-to-preview useful | Card tap has side effect; no browse-without-load |
| C | Flat two-line dense list with ▶ | Highest density | Cramped; less visual distinction |
| D | ▶ only, no Load button anywhere | Simplest mental model | No load-without-playing path |

### Decision

SB-D5 (Open): evaluating Option A (▶ + accordion) vs Option D (▶ only, no Load button). Will decide after Pass 1 visual evaluation.

### No Files Changed

Planning-only entry. DEVPLAN_SIDEBAR.md updated with Pass 2 spec and SB-D5 (Open).

---

## Entry 3 — Pass 1 Implementation: Play Tab Compaction (Code)

**Date:** 2026-02-27

### Summary

Implemented all 7 Pass 1 changes plus 3 refinements discovered during Refine feedback. The Play tab is now significantly more compact: label removed, transport row consolidated (Play/Stop toggle, Loop, Share, ✕ Clear, bordered BPM field), binary toggles reduced to single buttons on a shared settings row.

### Changes Implemented

#### Show 1 (changes 1–4): Transport area compaction

**1. Removed "Progression:" label**
- Deleted `<label>` from input group. Textarea placeholder text is sufficient.

**2. Combined Play/Stop into single toggle button**
- One button: shows ▶ when stopped, ■ when playing
- `handlePlayStop()` dispatches to `handlePlay()` or `handleStop()` based on `playbackRunning`
- `aria-label` swaps between "Play" and "Stop" for accessibility
- Separate `stopBtn` element removed entirely

**3. Replaced Clear "CLEAR" text with ✕ icon**
- Standard 44×44 transport button (was wider text button with `padding: 0 14px`)
- Added `aria-label="Clear"`. Red hover accent preserved.

**4. Replaced tempo slider with inline BPM field**
- Numeric `<input type="number">` (42px wide) + "BPM" suffix label
- Placed in transport row after the four buttons
- Range 20–960, default 150 (unchanged)
- Clamps on blur via `handleTempoBlur()`
- Arrow keys work for increment/decrement
- Spinner buttons hidden via CSS (`-webkit-appearance: none`, `-moz-appearance: textfield`)

#### Show 2 (changes 5–7): Settings row

**5. Root Motion / Tonal Centroid → single toggle button**
- One button labeled "Root" (toggles to "Tonal" on click)
- `handlePathModeToggle()` cycles between modes and updates label

**6. Staccato / Legato → single toggle button**
- One button labeled "Staccato" (toggles to "Legato" on click)
- `handlePlaybackModeToggle()` cycles between modes and updates label

**7. Both on shared settings row**
- Flex row with `justify-content: space-between`
- Bordered buttons with hover/transition styling

#### Refinements (from Refine feedback)

**8. Tempo group container border**
- Field + "BPM" suffix wrapped in a bordered container (`tempoGroup`)
- Container matches transport button height (44px min-height, 1.5px border, 6px radius)
- Focus-within highlights container border in teal

**9. Inner field border**
- Field has its own `1px solid #ccc` inner border (matches textarea styling)
- Makes the field clearly interactive — visually distinct from plain text
- Focus highlights inner border in teal independently

**10. Disabled state wiring**
- Tempo field + Clear enable when text is typed OR progression loaded (`hasContent`)
- Loop + Share enable only when progression loaded (`progressionLoaded`)
- Play enables when playing OR `hasContent`
- Tempo group starts disabled on page creation (matching button pattern)
- Group container gets `.disabled` class (opacity 0.3, lighter borders)

### CSS Changes

| Removed | Added |
|---------|-------|
| `.tonnetz-sidebar-tempo` (section) | `.tonnetz-sidebar-tempo-group` (bordered container) |
| `.tonnetz-sidebar-tempo-header` | `.tonnetz-sidebar-tempo-field` (inner bordered input) |
| `.tonnetz-sidebar-tempo-marking` | `.tonnetz-sidebar-tempo-suffix` (BPM label) |
| `.tonnetz-sidebar-tempo-slider` | `.tonnetz-sidebar-settings-row` (flex row) |
| `.tonnetz-sidebar-tempo-label` | `.tonnetz-sidebar-settings-toggle` (single toggle button) |
| `.tonnetz-sidebar-path-toggle` (segmented) | `.tonnetz-sidebar-settings-toggle--active` (teal state) |
| `.tonnetz-sidebar-path-toggle-btn` | |
| `.tonnetz-sidebar-path-toggle-btn--active` | |
| `.tonnetz-sidebar-clear-btn` (text style) | `.tonnetz-sidebar-clear-btn` (icon style) |

### Files Changed

| File | Changes |
|------|---------|
| `INTEGRATION/src/sidebar.ts` | All CSS + DOM + handler + public interface changes described above |
| `INTEGRATION/src/__tests__/sidebar.test.ts` | 12 tests updated for new DOM structure, 1 added (tempo clamp on blur) |

### Test Results

- INT: 238 passed (was 239 — 5 old tempo tests → 4 new, 1 stop-btn test removed)
- 0 type errors in sidebar.ts (only pre-existing audio-engine import errors)

### Resulting Layout

```
┌─────────────────────────────────────┐
│  HEADER (unchanged)                 │
│  Tone Nets                          │
│  an interactive Tonnetz explorer    │
│  ┌─────────────────────────────────┐│
│  │ ▶ Play    | Library             ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  [textarea — no label]              │
│                                     │
│  [▶/■] [🔁] [🔗] [✕]  [|150| BPM] │
│                                     │
│  [Root]                  [Staccato] │
│                                     │
│  Sound [Cathedral Organ ▼]          │
├─────────────────────────────────────┤
│  [How to use] [What this is]        │
└─────────────────────────────────────┘
```

### Contract Changes
- UX_SPEC.md §4: sidebar Play tab content order updated — transport row consolidated (Play/Stop toggle, tempo field inline), settings row replaces two segmented toggles
