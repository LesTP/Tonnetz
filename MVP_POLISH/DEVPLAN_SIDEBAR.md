# DEVPLAN — Sidebar Redesign

Module: MVP Polish / Sidebar Redesign
Version: 0.1
Date: 2026-02-27
Parent track: MVP_POLISH/DEVPLAN.md
References: UX_SPEC.md §4, SPEC.md §Integration Module, INTEGRATION/src/sidebar.ts

---

## Cold Start Summary

**What this is:**
Multi-pass sidebar redesign for the Tonnetz Interactive Harmonic Explorer. Goal: reduce click count for the most common workflow (load a progression from the library → play it → load a different one). Currently requires switching between two tabs; the end state is a single-tab view with both controls and library.

**Key constraints:**
- Sidebar width fixed at 320px (14px padding each side = 292px usable)
- Floating transport strip (mobile) already has the compact icon vocabulary we're adopting
- All changes are CSS/DOM in `INTEGRATION/src/sidebar.ts` — no subsystem API changes
- This is Refine work — each pass shown to human for evaluation before proceeding

**Gotchas:**
- `injectCSS()` deduplicates by style ID — CSS changes require full page reload
- Floating transport strip auto-syncs with sidebar button states — changes to sidebar button structure must preserve sync wiring
- Transport button enable/disable logic depends on `setProgressionLoaded()` and `setPlaybackRunning()` — DOM restructuring must preserve these methods' element references

**Documents in scope:**
- UX_SPEC.md §4 (sidebar content order)
- SPEC.md §Integration Module (sidebar description)
- MVP_POLISH/DEVPLAN.md (current status cross-reference)

---

## Current Status

**Phase:** All three passes complete + content enrichment + share URL cleanup.
**Focus:** Ready for commit amend
**Blocked/Broken:** None

---

## Problem Statement

Loading a new progression from the library currently requires:
1. Switch to Library tab
2. (Optionally) select a filter (genre, feature)
3. Scroll to find entry
4. Expand the accordion card
5. Click Load (auto-switches to Play tab)
6. Click Play

That's 4–6 interactions for the most common user action. The root cause is the two-tab split: controls and library live in separate views, forcing tab switches.

**Target:** Single scrollable view where controls and library coexist. User scrolls down from controls to library, taps a progression, and it loads + plays with minimal interaction.

---

## Approach: Three Passes

### Pass 1: Play Tab Compaction ✅

Reduced the Play tab's vertical footprint by ~100px. Compact control layout established.

### Pass 2: Library Card Redesign ✅

Teal ▶ triangle on collapsed cards for one-click load + play. Load button removed. Expand is informational only. See SB-D5.

### Pass 3: Tab Merge ✅

Tab bar removed. Single scrollable view: compact controls at top, library entries below. Separator lines for structure. See SB-D7.

---

## Pass 1: Play Tab Compaction

**Regime:** Refine (human evaluates each change visually)

**Goal:** Reclaim ~100px of vertical space in the Play tab without losing any functionality.

### Changes

#### 1. Remove "Progression:" label
- Delete the `<label>` element from the input group
- Textarea placeholder text ("Enter chords...") serves the same purpose
- **Saves:** ~18px (label height + gap)

#### 2. Combine Play/Stop into a single toggle button
- One button that shows ▶ when stopped, ■ when playing
- Matches floating transport strip behavior (which already does this)
- `setPlaybackRunning(playing)` swaps the icon/text
- **Saves:** ~50px (one 44px button + 6px gap)

#### 3. Replace Clear text button with ✕ icon button
- Change from text "CLEAR" (with 14px horizontal padding) to ✕ icon in a standard 44×44 transport button
- Matches floating transport strip's Clear button
- Loses text discoverability but gains consistency with mobile experience
- **Saves:** ~20px horizontal (narrower button)

#### 4. Replace tempo slider with inline numeric field
- Remove the tempo section (label row + slider = ~50px)
- Add a compact BPM input field to the transport button row
- Field: ~60–70px wide, numeric input, shows current BPM
- Small "BPM" suffix label or placeholder
- User types a value or uses arrow keys to adjust
- Default: 150 BPM (unchanged)
- Range: 20–960 (unchanged)
- **Saves:** ~50px vertical (entire tempo section removed, field absorbed into transport row)

#### 5. Replace Root Motion / Tonal Centroid segmented toggle with a single toggle button
- One button showing current mode text (e.g., "Root" or "Tonal")
- Click toggles between modes
- Compact: fits in a settings row
- **Saves:** ~35px (entire toggle row removed, button absorbed into settings row)

#### 6. Replace Staccato / Legato segmented toggle with a single toggle button
- Same pattern: one button showing "Staccato" or "Legato"
- Click toggles between modes
- **Saves:** ~35px (entire toggle row removed, button absorbed into settings row)

#### 7. Place both toggle buttons on a single settings row
- Horizontal flex row with the two toggle buttons, visually separated
- Below the transport row, above the Sound dropdown
- **Adds:** ~35px (one new row)

### Resulting Layout

```
┌─────────────────────────────────────┐
│  HEADER (unchanged)                 │
│  Tone Nets                          │
│  an interactive Tonnetz explorer    │
│  ┌─────────────────────────────────┐│
│  │ ▶ Play    | Library             ││  (tabs — removed in Pass 3)
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  [textarea — no label]              │
│                                     │
│  [▶/■] [🔁] [🔗] [✕]  [150▕BPM]   │  (transport + tempo field)
│                                     │
│  [Root ↔ Tonal]   [Stacc ↔ Legato] │  (settings row)
│                                     │
│  Sound [Cathedral Organ ▼]          │  (preset dropdown — unchanged)
│                                     │
│  (freed vertical space: ~100px)     │
│                                     │
├─────────────────────────────────────┤
│  [How to use] [What this is]        │  (info footer — unchanged)
└─────────────────────────────────────┘
```

### Transport Row Detail

After Play/Stop merge and Clear icon change, the transport row contains:

| Position | Element | Width | Notes |
|----------|---------|-------|-------|
| 1 | ▶/■ Play/Stop toggle | 44px | Icon swaps on state change |
| 2 | 🔁 Loop | 44px | Unchanged |
| 3 | 🔗 Share | 44px | Unchanged |
| 4 | ✕ Clear | 44px | Was text "CLEAR", now icon |
| 5 | BPM field | ~70px | Numeric input + "BPM" label |

Total: 4×44 + 3×6 (gaps) + 70 = 264px. Fits within 292px usable width with 28px margin.

### Settings Row Detail

| Position | Element | Approx Width | Notes |
|----------|---------|-------------|-------|
| 1 | Path mode toggle | ~60–80px | Text: "Root" or "Tonal" |
| gap | Visual separator | ~40–60px | Flex space-between or gap |
| 2 | Playback mode toggle | ~70–90px | Text: "Staccato" or "Legato" |

### Implementation Scope

All changes in `INTEGRATION/src/sidebar.ts`:
- DOM builder modifications (remove label, restructure transport, add BPM field, add settings row)
- CSS changes (transport row layout, BPM field styling, toggle button styling, settings row)
- Sidebar interface: `setTempo()` now updates field value, not slider
- Tempo change: `input` event on field (with validation/clamping) replaces slider `input` event
- Floating transport strip: no changes needed (already has the compact icons)

Tests in `INTEGRATION/src/__tests__/sidebar.test.ts`:
- Update button count/query expectations
- Update tempo control tests (field vs slider)
- Update toggle tests (single button vs segmented pair)

---

## Pass 2: Library Card Redesign

**Regime:** Refine (human evaluates visual result)

**Goal:** Reduce the click count for loading a progression from the library. Current flow requires expand card → Load → Play (3 clicks). Target: one click to load + play.

### Core Tension

Two distinct user intents share the same surface:
- **Play intent:** "I want to hear this progression" → fewest clicks possible
- **Browse intent:** "I want to read about this progression" → see comment, roman numerals, tempo

These must be separated into distinct interaction paths.

### Options Considered

**Option A: ▶ button on collapsed card (selected)**

```
┌─────────────────────────────────────┐
│  Autumn Leaves  [Jazz]          [▶] │  ← tap ▶ = load + play
│  Kosma · Cm7 F7 Bbmaj7 ...         │  ← tap card body = expand
└─────────────────────────────────────┘
```

- Tap card body → expands to show comment, roman numerals, full chords (browse intent)
- Tap ▶ → load + play immediately, no expand needed (play intent)
- ▶ works on both collapsed and expanded states
- Pro: cleanly separates browse from play; familiar pattern (Spotify, Apple Music)
- Con: ▶ target small-ish on mobile (44×44 minimum achievable)

**Option B: Tap card = load only (no play), ▶ to play**

- Tap card body → loads progression (renders path, fills textarea, doesn't play)
- Tap ▶ → load + play in one step
- No accordion at all; details via tooltip or ⓘ icon
- Pro: tap-to-preview useful — user sees path without audio commitment
- Con: tapping a card has a side effect (loads into textarea, changes lattice); loses browse-without-loading path; details have no clear home

**Option C: Flat dense two-line list with ▶**

- Each entry is two compact lines: title + composer + badge on line 1, chord preview on line 2
- Tap card body → expands for details; tap ▶ → load + play
- Pro: highest density — more entries visible without scrolling
- Con: two-line entries feel cramped; less visual distinction between entries

**Option D: ▶ on card, no separate Load button anywhere**

- Remove Load from expanded cards entirely; ▶ is the only action
- Tap card → expand for details (purely informational)
- Pro: simplest mental model
- Con: no "load without playing" path (user can stop immediately, but it's not clean)

### Decision

Option D selected. See SB-D5 (Closed).

### Changes

#### 1. Add ▶ button to collapsed library card
- Right-aligned, 44×44 minimum tap target
- Standard transport button styling (border, border-radius, teal hover)
- Click handler: load progression + auto-switch to Play tab + start playback
- Button click stops event propagation (does not trigger card expand)

#### 2. Preserve existing expand behavior
- Card body tap still expands/collapses the accordion
- Expanded view still shows comment, roman numerals, full chords
- Existing Load button remains in expanded view for "load without playing" use case

### Implementation Scope

`INTEGRATION/src/sidebar.ts` (or library card builder):
- Add ▶ button element to each collapsed card row
- Wire click → load + play pipeline (reuse existing `onLoadProgression` + `handlePlay`)
- CSS for button positioning (flex row, button right-aligned)
- `stopPropagation()` on button click to prevent card expand

Tests:
- ▶ button present on each card
- Click ▶ fires load + play callbacks
- Click ▶ does not expand card
- Existing expand/load behavior unchanged

---

## Decision Log

```
SB-D1: Play/Stop toggle replaces separate buttons
Date: 2026-02-27
Status: Closed
Priority: Important
Decision:
Combine Play and Stop into a single toggle button that swaps icon based on
playback state. Matches the floating transport strip pattern.
Rationale:
Saves horizontal space in transport row. Users already understand the toggle
pattern from the mobile floating strip. No functional change — same
callbacks, same state transitions.
Revisit if: Users report confusion about the combined button.
```

```
SB-D2: Tempo numeric field replaces slider
Date: 2026-02-27
Status: Closed
Priority: Important
Decision:
Replace the tempo slider (range input + BPM label) with a compact numeric
input field placed inline in the transport button row. User types BPM value
directly. Arrow keys increment/decrement. Range 20–960, default 150.
Rationale:
Slider was imprecise across the wide 20–960 BPM range. Musicians think in
BPM numbers. Inline placement saves ~50px vertical space.
Revisit if: Users miss the drag-to-discover affordance of the slider.
```

```
SB-D3: Single-button toggles for binary settings
Date: 2026-02-27
Status: Closed
Priority: Important
Decision:
Replace the two-button segmented toggles (Root Motion / Tonal Centroid and
Staccato / Legato) with single buttons that show current mode and toggle on
click. Both placed on a shared settings row.
Rationale:
Segmented toggles each consumed a full row (~35px) for a binary choice.
Single buttons are equally clear and fit two-per-row.
Revisit if: A third option is added to either setting (would need a dropdown
or return to segmented control).
```

```
SB-D4: Clear button uses ✕ icon
Date: 2026-02-27
Status: Closed
Priority: Normal
Decision:
Replace the text "CLEAR" button with a ✕ icon button matching the floating
transport strip's clear button. Standard 44×44 transport button styling.
Rationale:
Consistency with mobile floating strip. Saves horizontal space. The ✕ icon
is a widely understood "dismiss/clear" affordance.
Revisit if: Users don't discover that ✕ also resets camera and clears textarea
(the expanded scope from POL-D21). Could add a tooltip.
```

```
SB-D5: Library card interaction model
Date: 2026-02-27
Status: Closed
Priority: Important
Decision:
Option D — teal triangle play button on collapsed card, no Load button
anywhere. Triangle click = load + play + close sidebar on mobile. Card
header click = expand/collapse for details (purely informational). Duplicate
chords section removed from expanded detail.
Rationale:
Simplest mental model — triangle is the only action, card body is purely
informational. Musicians want to hear progressions quickly; "load without
playing" is a rare use case that doesn't justify a separate button.
The triangle icon (teal, matching app accent color) is a universally
understood play affordance.
Alternatives rejected:
- Option A (▶ + accordion with Load): extra Load button adds complexity
  for a rarely-used path
- Option B (tap card = load only, ▶ = play): side-effect on card tap
  surprising; loses browse-without-loading path
- Option C (flat two-line list): highest density but cramped
Revisit if: Users need to study a progression path without hearing it.
Could add a "preview" action that loads without playing.
```

```
SB-D6: Root/Tonal path mode toggle removed
Date: 2026-02-27
Status: Closed
Priority: Normal
Decision:
Remove the Root Motion / Tonal Centroid toggle entirely. Path mode
hardcoded to root motion. Toggle removed from sidebar DOM, handlers,
interface, and main.ts wiring.
Rationale:
Feature had no user demand. Root motion (centroid = root vertex) is the
musically intuitive default. Tonal centroid (geometric mean of chord
tones) produced floating markers between nodes — confusing. Removing
saves a settings row slot and simplifies the code.
Revisit if: A future visualization mode needs tonal centroid paths.
```

```
SB-D7: Tab bar removed — single scrollable panel
Date: 2026-02-27
Status: Closed
Priority: Important
Decision:
Remove the Play/Library tab bar. Controls and library share a single
scrollable panel separated by a thin grey line. Library filter tabs
(All/Genre/Feature) appear below the separator.
Rationale:
The tab split was the root cause of the original UX problem — loading a
new progression required switching between tabs. With controls compacted
(Pass 1) and library cards simplified (Pass 2), both fit in one view.
Users can scroll from controls to library without context switching.
Revisit if: The sidebar becomes too long and users lose orientation.
Could add a sticky controls section that doesn't scroll.
```

```
SB-D8: Thin custom scrollbar (6px)
Date: 2026-02-27
Status: Closed
Priority: Normal
Decision:
Replace native browser scrollbar (~15px) with a thin 6px custom
scrollbar on both the scroll wrapper and the tab panel. WebKit via
::-webkit-scrollbar, Firefox via scrollbar-width: thin. Info footer
right padding increased by 6px to compensate (footer is outside the
scroll container).
Rationale:
Native scrollbar stole 15px of layout width, causing the transport
row (with fixed min-width buttons) to overflow past fluid elements.
Thin scrollbar reduces the stolen space to 6px, absorbed by the
tempo group (flex-shrink: 1, min-width: 0).
Revisit if: Custom scrollbar looks wrong on specific platforms.
```
