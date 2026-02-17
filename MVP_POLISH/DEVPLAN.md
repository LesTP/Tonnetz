# DEVPLAN — MVP Polish Track

Module: MVP Polish (cross-cutting)
Version: 0.1
Date: 2026-02-16
References: SPEC.md, UX_SPEC.md, ARCH_AUDIO_ENGINE.md §2b/§3, ARCH_RENDERING_UI.md §8/§11

---

## Cold Start Summary

**What this is:**
Product-level polish track for the Tonnetz Interactive Harmonic Explorer. The technical implementation is complete — all four subsystems (Harmony Core, Rendering/UI, Audio Engine, Persistence/Data) are integrated and functional. This track covers UI layout redesign, content (progression library), audio quality tuning, and mobile UAT. It is cross-cutting: changes may touch RU, AE, Integration, and PD, but the organizing concern is finishing the product experience, not wiring modules.

**Predecessor:** `INTEGRATION/DEVPLAN.md` / `INTEGRATION/DEVLOG.md` (Phases 1–8). Integration is closed as a wiring concern. Design Passes 1–4 and the Playback Testing session from Integration Phase 8 are migrated to this track's DEVLOG as Entries 0a–0e (pre-existing work).

**Key constraints:**
- No new subsystem modules — changes are to existing RU, AE, Integration, and PD code
- Sidebar/panel must work as permanent panel on desktop and hamburger dropdown on mobile
- Progression library is bundled static data, not user-generated content (that's PD's existing save/load)
- Audio changes must not break existing test suites (936 tests across all modules)
- Mobile UAT is a distinct testing phase, not just "check it works on phone"

**Gotchas:**
- INT-D8 (tempo control UI) is still open from integration track — resolved here in Phase 1
- `grid-highlighter.ts` mutates `layer-grid` attributes directly (Design Pass 4 trade-off) — any sidebar/panel work touching grid layout must not break this
- `createControlPanel()` in RU creates its own DOM structure — redesigning the panel means either modifying this function or replacing it. Modifying is preferable (keeps test coverage valid)
- Library data must use the same PD `ProgressionRecord` schema (`{ schema_version, id, title, tempo_bpm, grid, chords, notes }`) so load pipeline works unchanged
- Mobile touch: proximity radius 0.12 world units was tuned on desktop (Design Pass 2) — may need adjustment for finger-sized targets

---

## Current Status

**Phase:** 1 complete. Ready for Phase 2 (Library) or further testing.
**Focus:** All Phase 1 sub-phases (1a–1g) complete: sidebar layout, tempo/loop, chord display, info overlays, button redesign.
**Blocked/Broken:** Nothing
**Known visual TODO:** Header triangle buttons extend slightly past the separator line — needs CSS investigation (triangle SVGs are wider than the border-bottom boundary). Low priority.
**Open design TODO:** Library → textarea chord display format (see below).
**Decisions closed:** POL-D2, D9, D10, D11, D12, D13. POL-D14 open (m7b5 triangle placement — deferred).

### Open TODO: Library Textarea Display Format

**Problem:** Chord durations are encoded by repetition (PD-D2). A chord lasting 4 beats at `grid="1/4"` appears 4 times: `["Cm7", "Cm7", "Cm7", "Cm7"]`. The pipeline's `collapseRepeatedChords()` groups these into `{ symbol: "Cm7", count: 4 }` → 4 beats.

When loading from the library, the textarea needs to display the chords. Two options:

**Option A (current implementation): Show full repetitions grouped by bar.**
```
Cm7 Cm7 Cm7 Cm7 | F7 F7 F7 F7 | Bbmaj7 Bbmaj7 Bbmaj7 Bbmaj7 | ...
```
- ✅ Round-trip safe: user can click Load on the textarea and get identical durations
- ✅ Accurate: shows exactly what the pipeline receives
- ❌ Verbose and noisy — looks like data, not music
- ❌ Fills the textarea with repetitive content

**Option B: Show unique symbols only (collapsed).**
```
Cm7 | F7 | Bbmaj7 | Ebmaj7 | Am7b5 | D7 | Gm
```
- ✅ Clean and readable — looks like a chord chart
- ❌ Not round-trip safe: re-loading gives 1 beat per chord (4× too fast)
- Could be made round-trip safe if the pipeline assumed "1 symbol = 1 bar" when no repetitions are present, but this changes the input semantics

**Option C: Show unique symbols, but store the library entry ID so re-load uses original data.**
- ✅ Clean display + correct re-load
- ❌ More complex: requires tracking "this textarea content came from library entry X"
- ❌ Breaks if user edits the textarea (hybrid state: library entry + manual edits)

**Option D: Show unique symbols with explicit duration notation.**
```
Cm7 x4 | F7 x4 | Bbmaj7 x4 | Ebmaj7 x4 | Am7b5 x4 | D7 x4 | Gm x8
```
- ✅ Compact and informative
- ❌ Requires parser changes to understand `x4` notation
- Could be a nice future enhancement

**Current state:** Option A is implemented. Decision deferred — user to review and choose.

---

## Test Baseline

```
HC:  178 passed  (was 168 — +10 dim7/m7b5 tests)
RU:  341 passed
AE:  172 passed
PD:  108 passed
INT: 187 passed  (was 141 — +46 input cleaning tests)
Total: 986 passed — 0 failures
tsc --noEmit: 0 errors
```

---

## Phase Breakdown

### Phase 0: Pre-Polish Bug Fixes

**Objective:** Fix known bugs discovered during review before starting new feature work.

#### 0a: Interactive press — extension notes not displayed

**Bug:** When pressing a triangle interactively, only the main triangle highlights — extension triangles (e.g., the 7th in Cmaj7) and dot_pcs are not shown. During scheduled playback, extensions display correctly.

**Root cause:** `onPointerDown` in `main.ts` (~line 358) passes only `hit.triId` as `mainTriId` to `activateGridHighlight()` and never populates `extTriIds`. The hit-test returns one triangle; the code doesn't decompose the chord to find extensions.

**Fix approach:** On interactive press, after hit-test returns a triangle:
1. Get the triangle's pitch classes via `getTrianglePcs(triRef)`
2. Parse those pitch classes into a chord (or use a reverse-lookup)
3. Build or look up the full Shape (main_tri + ext_tris + dot_pcs)
4. Pass complete shape info to `activateGridHighlight()` including `extTriIds`

Alternative simpler approach: since the user is pressing a single triangle (triad), the extension is only relevant when a progression is loaded and the pressed triangle matches a loaded Shape. In idle exploration mode, a bare triangle press IS just a triad — extensions are progression context. **Needs decision:**

```
POL-D6: Interactive press extension display
Date: 2026-02-16
Status: Closed — Option C
Priority: Important
Options:
A) Always decompose — on press, compute a chord from the triangle's 3 PCs,
   find adjacent extension candidates, display the richest possible shape.
B) Progression-aware only — if a progression is loaded and the pressed triangle
   matches a loaded Shape's main_tri, show that Shape's extensions.
C) Always show triad on press; show full Shape on progression playback. ← CHOSEN
Decision: Option C. Current behavior is correct — not a bug.
  Idle press = triad (what the lattice gives you).
  Playback = full Shape (chord identity known from progression).
  No code change needed.
```

**Tests (0a):**
- [x] Press on triangle during playback → full Shape highlighted (main + ext + dots) — verified, existing behavior correct
- [x] Press on triangle in idle → triad only (Option C: current behavior correct, no code change)
- [x] Grid-highlighter receives correct `extTriIds` in playback code path — verified

#### 0b: Chord grammar expansion — input robustness

**Current state:** Parser (`parseChordSymbol`) supports a limited MVP grammar. Common chord symbols that musicians will naturally type are rejected with hard errors:
- `Cm7b5` / `Cø7` (half-diminished) → "Invalid chord symbol"
- `C/E` (slash chord) → "Invalid chord symbol"
- `Cdim7` (diminished 7th) → "Invalid chord symbol"
- `C9`, `Cm9` → "Invalid chord symbol"

**Approach:** Two-layer fix:

**Layer 1 — Input cleaning (integration module, `progression-pipeline.ts`):**
Before calling `parseChordSymbol()`, apply normalization rules:
- Strip slash bass: `C/E` → `C`, `Dm7/A` → `Dm7`
- Convert `ø` or `ø7` → `dim` (or `m7b5` if grammar supports it)
- Convert `-` quality marker → `m`: `C-7` → `Cm7`
- Convert `Δ` or `△` → `maj7`: `CΔ7` → `Cmaj7`, `CΔ` → `Cmaj7`
- Strip parenthesized additions: `C7(b9)` → `C7`
- Strip `sus` chords → warn + pass through as bare triad: `Csus4` → `C`

This keeps HC's parser clean and puts the "messy real-world input" handling in the integration layer where it belongs.

**Layer 2 — Grammar expansion (Harmony Core, `chords.ts`):**
Extend the parser regex and `EXTENSION_INTERVALS` for commonly needed symbols:
- `dim7`: intervals [0, 3, 6, 9] — fully diminished 7th
- `m7b5`: intervals [0, 3, 6, 10] — half-diminished 7th (quality=min, fifth flatted)

```
POL-D7: Chord grammar expansion scope
Date: 2026-02-16
Status: CLOSED — Option B
Priority: Important
Options:
A) Input cleaning only (Layer 1) — strip unrecognized parts, warn user.
   No HC changes. Simplest. Lossy (slash bass ignored, extensions stripped).
B) Input cleaning + dim7/m7b5 in HC (Layer 1 + Layer 2). ← CHOSEN
   Adds the two most common missing chord types. Moderate effort.
C) Full grammar expansion (dim7, m7b5, 9, 11, 13, sus, slash) —
   significant HC rework. Deferred to post-MVP per HC-D4.
Decision: Option B. Layer 2 (HC grammar: dim7, m7b5) implemented.
  Layer 1 (input cleaning in integration) implemented.
```

**Tests (0b):**
- [x] `C/E` → cleaned to `C` → parses successfully (slash bass stripped)
- [x] `Dm7/A` → cleaned to `Dm7` → parses successfully
- [x] `Cm7b5` → parses as half-diminished (Layer 2 — implemented)
- [x] `Cdim7` → parses as fully-diminished 7th (Layer 2 — implemented)
- [x] `C-7` → cleaned to `Cm7` → parses successfully
- [x] `CΔ7` → cleaned to `Cmaj7` → parses successfully
- [x] `Csus4` → cleaned to `C` with warning → parses as C major
- [x] Invalid symbols after cleaning → error with helpful message identifying the problem

---

### Phase 1: UI Layout Redesign

**Objective:** Replace the three-zone layout (toolbar, canvas, control panel) with a two-tab sidebar (Play | Library) plus floating canvas controls. Desktop: permanent left sidebar. Mobile: hamburger overlay. Add tempo controller, active chord display, loop toggle, info overlays. Use standard transport icons.

**Information architecture** (POL-D9):

The sidebar content is organized into three tiers based on usage pattern:

1. **Header (always visible):** title/subtitle + `?` (How to Use) and `ⓘ` (What This Is) buttons + tab bar
2. **Tab: Play (doing):** active chord display, progression input + Load, playback controls (▶ ■ 🔁) + tempo, Clear
3. **Tab: Library (choosing):** genre/feature filter tabs, scrollable entry list with expandable detail cards

How to Use and What This Is open as **full-viewport overlay modals**, not sidebar content — they're reference material best read at full width.

**DOM structure:**

```
#app
└── div.tonnetz-app (flex-row on desktop, full-width on mobile)
    ├── div.sidebar-backdrop.tonnetz-hidden (mobile: semi-transparent click-to-dismiss)
    ├── aside.tonnetz-sidebar (300px desktop / position:fixed overlay mobile)
    │   ├── header.sidebar-header
    │   │   ├── div.sidebar-title-row
    │   │   │   ├── h1 "Tone Nets"
    │   │   │   │   └── small.subtitle "an interactive Tonnetz explorer"
    │   │   │   └── div.sidebar-info-btns
    │   │   │       ├── button "?" (→ How to Use overlay)
    │   │   │       └── button "ⓘ" (→ What This Is overlay)
    │   │   └── nav.sidebar-tabs
    │   │       ├── button.tab-btn[data-tab="play"] "▶ Play" (active by default)
    │   │       └── button.tab-btn[data-tab="library"] "📚 Library"
    │   ├── section.tab-panel[data-tab="play"]
    │   │   ├── div.chord-display (shows active chord name, e.g., "Am7")
    │   │   ├── div.progression-input
    │   │   │   ├── textarea (placeholder, rows ~3)
    │   │   │   └── button "Load"
    │   │   └── div.playback-controls
    │   │       ├── div.transport-buttons
    │   │       │   ├── button ▶ Play (disabled until progression loaded)
    │   │       │   ├── button ■ Stop (disabled until playing)
    │   │       │   ├── button 🔁 Loop (toggle, disabled until progression loaded)
    │   │       │   └── button ✕ Clear (disabled until progression loaded)
    │   │       └── div.tempo-control
    │   │           ├── input[type=range] (40–240, default 120)
    │   │           └── span "120 BPM"
    │   └── section.tab-panel.tonnetz-hidden[data-tab="library"]
    │       ├── nav.library-filters
    │       │   ├── button "All"
    │       │   ├── button "Genre"
    │       │   └── button "Feature"
    │       └── div.library-list (scrollable)
    │           └── div.library-entry (repeated)
    │               ├── div.entry-summary (title, composer, genre badge, chord preview)
    │               └── div.entry-detail.tonnetz-hidden (comment, roman numerals, tempo)
    └── main.tonnetz-canvas-area (flex:1)
        ├── button.hamburger.tonnetz-hidden (mobile only: ☰, top-left, position:absolute)
        ├── button.reset-view (top-right, position:absolute, always visible)
        └── <svg> + 5 layer <g> groups
```

**Responsive breakpoints:**

| Breakpoint | Sidebar | Canvas | Hamburger |
|------------|---------|--------|-----------|
| Desktop (≥768px) | Permanent left, 300px, always visible | `calc(100% - 300px)` | Hidden |
| Mobile (<768px) | Hidden by default; `position: fixed` overlay on left | Full width, unaffected by sidebar open/close | Visible, top-left corner |

Mobile sidebar dismiss triggers: backdrop tap, hamburger tap, Escape key.

**Canvas area floating controls:**

- **Reset View** button: `position: absolute; top: 8px; right: 8px` — replaces the old toolbar entirely.
- **Hamburger** (☰): `position: absolute; top: 8px; left: 8px` — mobile only, hidden on desktop via media query.

Both use `z-index` above the SVG but below the sidebar/backdrop.

#### 1a: Sidebar shell + responsive layout

Build the DOM structure and CSS. Wire into `main.ts` replacing old layout/panel/toolbar.

**Implementation approach:**

New file `INTEGRATION/src/sidebar.ts` exports `createSidebar(options)` returning:

```ts
interface SidebarOptions {
  root: HTMLElement;
  onLoadProgression: (text: string) => void;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  onResetView: () => void;
  onTempoChange: (bpm: number) => void;
  onLoopToggle: (enabled: boolean) => void;
  initialTempo: number;
}

interface Sidebar {
  getCanvasContainer(): HTMLElement;
  setProgressionLoaded(loaded: boolean): void;
  setPlaybackRunning(running: boolean): void;
  setActiveChord(symbol: string | null): void;
  setTempo(bpm: number): void;
  setLoopEnabled(enabled: boolean): void;
  isLoopEnabled(): boolean;
  switchToTab(tab: "play" | "library"): void;
  destroy(): void;
}
```

**Changes to `main.ts`:**

Replace:
```ts
const layout = createLayoutManager({ root: appEl });
const controlPanel = createControlPanel({ container: layout.getControlPanelContainer(), ... });
const toolbar = createToolbar({ container: layout.getToolbarContainer(), ... });
```

With:
```ts
const sidebar = createSidebar({ root: appEl, onLoadProgression, onPlay, onStop, onClear, onResetView, onTempoChange, onLoopToggle, initialTempo });
const canvasContainer = sidebar.getCanvasContainer();
```

All downstream code (`scaffold`, `resizeCtrl`, `camera`, `interactionCtrl`, `proximityCursor`) uses `canvasContainer` from sidebar — same variable, different source.

RU imports removed: `createLayoutManager`, `createControlPanel`, `createToolbar` (and their types). These become dead code in RU, retired in Phase 5b.

**Tests (1a):**
- [ ] Desktop: sidebar visible at 300px, canvas fills remaining width
- [ ] Mobile: sidebar hidden by default, hamburger button visible
- [ ] Hamburger tap → sidebar appears as overlay with backdrop
- [ ] Backdrop tap / hamburger tap / Escape → sidebar dismisses
- [ ] Tab switching: Play tab ↔ Library tab, correct panel visible
- [ ] Canvas interaction (pan/zoom/tap) works with sidebar present on desktop
- [ ] ResizeObserver fires on container resize → canvas recomputes viewport
- [ ] `destroy()` removes all DOM elements and event listeners

#### 1b: Playback controls + transport icons + loop toggle

- **Play** (▶), **Stop** (■): standard tape-recorder Unicode symbols
- **Loop** (🔁): toggle button — visually distinct active state (highlighted/pressed)
- **Clear** (✕): text or icon, danger-styled
- All disabled until progression loaded; Stop disabled until playing
- Loop wired to transport: when enabled, playback auto-restarts on natural completion

```
POL-D11: Playback control set
Date: 2026-02-17
Status: Closed
Priority: Important
Decision: Play (▶), Stop (■), Loop (🔁 toggle), Clear (✕). No Pause button.
  Loop is a toggle — when active, transport auto-restarts on completion.
  Standard tape-recorder iconography for immediate recognition.
Rationale:
  Pause adds state complexity (paused vs stopped, resume position tracking)
  for minimal value in a progression explorer. Stop + replay is sufficient.
  Loop is essential for studying harmonic patterns by repeated listening.
Revisit if: Users request pause for long progressions.
```

**Tests (1b):**
- [ ] Play button shows ▶, triggers `onPlay`
- [ ] Stop button shows ■, triggers `onStop`
- [ ] Loop button shows 🔁, toggles on/off, triggers `onLoopToggle(boolean)`
- [ ] Loop active state visually distinct (e.g., highlighted background)
- [ ] Clear button triggers `onClear`
- [ ] Button disabled states: Play/Loop/Clear disabled when no progression; Stop disabled when not playing
- [ ] Loop enabled + playback completes naturally → transport auto-restarts

#### 1c: Tempo controller

Resolves INT-D8 (Open → Closed).
- Range slider: 40–240 BPM, default 120
- BPM value displayed as label next to slider, updates live during drag
- Lives in Play tab, below transport buttons
- Wired to `AudioTransport.setTempo(bpm)` and persistence `saveSettings({ tempo_bpm })`
- Initial value loaded from persistence settings

**Tests (1c):**
- [ ] Tempo slider change → `onTempoChange(bpm)` fires with correct value
- [ ] `sidebar.setTempo(bpm)` → slider and label update
- [ ] Range clamped: values below 40 → 40, above 240 → 240
- [ ] Initial tempo from persistence reflected on load

#### 1d: Active chord display

Compact display in the Play tab showing the currently sounding chord name.

- During interactive exploration: shows chord symbol from hit-test (e.g., `Am`, `C | E edge`)
- During playback: shows current chord from progression (e.g., `Cm7`, `Am7b5`)
- When idle: empty or shows placeholder (e.g., "Tap a triangle to play")
- Driven by `sidebar.setActiveChord(symbol)` called from `main.ts`

```
POL-D10: Active chord display
Date: 2026-02-17
Status: Closed
Priority: Normal
Decision: Show active chord name in Play tab, compact single line.
  Interactive exploration: chord symbol from hit-test result.
  Playback: current chord from progression.
  Idle: placeholder text.
Rationale:
  Particularly valuable for 4-note chords (7ths, dim7, m7b5) and edge
  unions where the sounding pitch classes aren't obvious from the grid.
  Compact enough to not compete with playback controls for space.
Revisit if: Display needs to show more detail (e.g., pitch-class list,
  interval labels). Could expand to a multi-line display in future.
```

**Tests (1d):**
- [ ] `setActiveChord("Am7")` → display shows "Am7"
- [ ] `setActiveChord(null)` → display shows placeholder
- [ ] Display updates in real-time during playback chord changes
- [ ] Display doesn't overflow sidebar width for long chord names

#### 1e: Title, branding, info buttons

- **Title:** "Tone Nets" (POL-D2, still tentative)
- **Subtitle:** "an interactive Tonnetz explorer"
- **Page `<title>`:** matches sidebar title
- **Info buttons** (`?` and `ⓘ`) in the header row, right-aligned next to title
- Buttons trigger overlay modals (modal content is Phase 1f)

```
POL-D2: Application title
Date: 2026-02-16
Status: Closed
Priority: Minor
Decision: "Tone Nets" with subtitle "an interactive Tonnetz explorer"
Revisit if: Better name emerges before deployment.
```

**Tests (1e):**
- [ ] Title and subtitle visible in sidebar header
- [ ] Title visible in mobile sidebar overlay
- [ ] Page `<title>` matches
- [ ] `?` button and `ⓘ` button present and clickable

#### 1f: Info overlay modals

Two full-viewport overlay modals, triggered from sidebar header buttons:

**"How to Use" overlay** (triggered by `?`):
- Interaction guide: tap triangle → triad, tap near edge → union chord, drag → pan, scroll → zoom
- Keyboard shortcuts: Space = play/stop, Escape = clear
- **Supported chord symbols** reference table (see §Supported Chord Reference)
- Input tips: paste or type, pipe `|` or space delimited
- Library: how to browse and load

**"What This Is" overlay** (triggered by `ⓘ`):
- What is a Tonnetz — history, theory, geometric meaning
- How harmonic relationships map to spatial proximity
- Voice-leading as geometric distance
- Credits / author
- Link to source or further reading

Both overlays:
- Full viewport width (not constrained to sidebar width) — better for reading
- Dismissible via close button (✕, top-right), Escape key, or outside click
- Scrollable if content exceeds viewport
- Semi-transparent backdrop behind content

```
POL-D8: Two info overlays (How to Use vs What This Is)
Date: 2026-02-16 (revised 2026-02-17)
Status: Closed
Priority: Normal
Decision: Full-viewport overlay modals, not sidebar content.
  - "How to Use" — practical: interaction, shortcuts, supported chords, input tips
  - "What This Is" — conceptual: Tonnetz history, theory, credits
Rationale:
  Different audiences and purposes. Reference text benefits from full viewport
  width. Overlays don't compete with sidebar tabs for space.
```

**Tests (1f):**
- [ ] `?` button opens How to Use overlay with interaction guide + chord table
- [ ] `ⓘ` button opens What This Is overlay with theory + credits
- [ ] Both dismiss via close button / Escape / outside click
- [ ] Both scrollable on mobile
- [ ] Only one overlay visible at a time (opening one closes the other)
- [ ] Overlays use full viewport width, not sidebar width

#### 1g: Button visual redesign

- All buttons (transport, Load, Clear, tab buttons, info buttons) styled consistently
- Touch-friendly sizing: min 44×44px tap target
- Disabled state visually distinct (muted color + `cursor: not-allowed`)
- Active/toggle state for Loop button (highlighted background when loop enabled)
- Transport buttons use Unicode symbols: ▶ ■ 🔁
- Hover/active/focus states for desktop

**Tests (1g):**
- [ ] All interactive buttons have min 44×44px tap target
- [ ] Disabled buttons have distinct visual treatment
- [ ] Loop toggle has distinct active vs inactive appearance
- [ ] Button states (normal/hover/active/disabled) all defined in CSS

#### Phase 1 build order

| Step | Sub-phase | Regime | Dependencies |
|------|-----------|--------|-------------|
| 1 | **1a** Sidebar shell + responsive layout | Build | None — foundational |
| 2 | **1b** Playback controls + loop | Build | 1a (needs sidebar DOM) |
| 3 | **1c** Tempo controller | Build | 1a (needs sidebar DOM), INT-D8 |
| 4 | **1d** Active chord display | Build | 1a (needs sidebar DOM) |
| 5 | **1e** Title, branding, info buttons | Build | 1a (needs sidebar DOM) |
| 6 | **1g** Button visual redesign | Refine | 1a–1e complete (needs all buttons present) |
| 7 | **1f** Info overlay modals | Build | 1e (needs trigger buttons) |

Steps 1–5 can be built incrementally in a single `sidebar.ts` file. Step 6 is a visual tuning pass (Refine regime — needs human feedback). Step 7 is content-heavy but structurally independent.

#### Library tab placeholder (Phase 2 prep)

The Library tab panel is created in Phase 1a as an empty container. Phase 2 populates it with data, filters, and entry cards. The tab switching mechanism is built in 1a so Phase 2 only adds content, no structural changes.

#### Library data architecture (Phase 2 prep)

```
INTEGRATION/src/library/
  library-data.ts        ← static array of LibraryEntry[], one entry per progression
  library-types.ts       ← LibraryEntry interface (extends PD ProgressionRecord with metadata)
  library-validation.ts  ← test-time check: all entries parse via parseChordSymbol()
```

Adding a progression = append to the array in `library-data.ts`. Validation test catches unparseable chord symbols. Data file is isolated from UI rendering code.

```
POL-D12: Library progression detail display
Date: 2026-02-17
Status: Closed
Priority: Normal
Decision: Expandable card within the library list.
  Summary row: title, composer, genre badge, first few chord symbols as preview.
  Expanded: full comment, roman numeral analysis, tempo, complete chord list.
  Tapping the summary row toggles expansion (accordion-style, one open at a time).
  Selecting "Load" from expanded detail → loads progression + auto-switches to Play tab.
Rationale:
  User is browsing and comparing — expandable cards let them peek at details
  without losing their place in the list. Auto-switch to Play tab after load
  eliminates the extra tap to reach playback controls.
Revisit if: Detail content exceeds what fits in an expanded card (e.g., if we
  add audio preview or visual path thumbnail).
```

```
POL-D13: Dot-only shape centroid = root node
Date: 2026-02-17
Status: Closed
Priority: Important
Decision: For dot-only shapes (dim, aug), centroid_uv = nearest lattice node
  matching the root pitch class. Not the average of all dot nodes, not the focus.
Rationale:
  Averaging dot node positions gave centroids in empty space (not on any edge or
  node). Using the root node is musically intuitive (the chord is named after its
  root), deterministic, always on a real lattice node, and aligns with the grid-
  highlighter's greedy chain anchor (which also starts from the centroid).
Revisit if: A different anchor point (e.g., cluster visual center) proves more
  useful for progression path rendering.
```

```
POL-D14: Non-root triangle placement for m7b5 chords (DEFERRED)
Date: 2026-02-17
Status: Open — future work
Priority: Nice-to-have
Decision: Deferred. Currently m7b5 chords (e.g., Gm7b5 = G, Bb, Db, F) are
  treated as fully dot-only because the root triad (Gdim) is diminished. However,
  these chords contain a valid non-root minor triad (Bbm = Bb, Db, F) that could
  be placed as a triangle with the remaining note (G) as a dot.
Proposed approach:
  In decomposeChordToShape, when mainTri is null (root triad is dim/aug), scan
  all 3-note subsets of chord_pcs for a match in sigToTris. If found, place that
  as the main triangle and treat remaining PCs as dots. This gives m7b5 chords a
  filled triangle + connecting dot, matching user expectations.
  Note: dim7 chords (all subsets are diminished) would still be fully dot-only.
Revisit if: Library progressions with m7b5 chords look visually wrong during
  playback (triangle not filled, notes scattered).
```

---

### Supported Chord Reference

This table documents the complete chord symbol support after Phase 0b (POL-D7). It appears in the "How to Use" popup and serves as the authoritative reference.

**Directly supported (parsed by Harmony Core):**

| Category | Symbols | Example | Notes |
|----------|---------|---------|-------|
| Major triad | `C`, `D`, `F#` ... | `C` → C-E-G | Default quality when no modifier |
| Minor triad | `Cm`, `Dm`, `Am` ... | `Am` → A-C-E | `m` prefix |
| Diminished triad | `Cdim`, `Bdim` ... | `Bdim` → B-D-F | Displays as dot cluster |
| Augmented triad | `Caug`, `Eaug` ... | `Caug` → C-E-G# | Displays as dot cluster |
| Dominant 7th | `C7`, `G7`, `Bb7` ... | `G7` → G-B-D-F | |
| Minor 7th | `Cm7`, `Am7` ... | `Dm7` → D-F-A-C | |
| Major 7th | `Cmaj7`, `Fmaj7` ... | `Cmaj7` → C-E-G-B | |
| 6th | `C6`, `G6` ... | `C6` → C-E-G-A | |
| Add 9 | `Cadd9`, `Gadd9` ... | `Cadd9` → C-E-G-D | |
| 6/9 | `C6/9`, `G6/9` ... | `C6/9` → C-E-G-A-D | 5 pitch classes |
| Diminished 7th | `Cdim7`, `Bdim7` ... | `Cdim7` → C-Eb-Gb-A | Dot cluster (Phase 0b) |
| Half-diminished | `Cm7b5`, `Bm7b5` ... | `Cm7b5` → C-Eb-Gb-Bb | Dot cluster (Phase 0b) |

**Accepted via input cleaning (normalized before parsing):**

| Input | Cleaned to | Notes |
|-------|-----------|-------|
| `C/E`, `Dm7/A` | `C`, `Dm7` | Slash bass stripped (bass voicing not supported in MVP) |
| `C-7`, `D-7` | `Cm7`, `Dm7` | Dash = minor |
| `CΔ7`, `CΔ`, `C△7` | `Cmaj7` | Triangle = maj7 |
| `Cø7`, `Cø` | `Cm7b5` | Slashed-O = half-diminished |
| `C7(b9)`, `G7(#11)` | `C7`, `G7` | Parenthesized alterations stripped |
| `Csus4`, `Csus2` | `C` | Sus stripped with warning |

**Not supported (error):**

| Symbol | Reason |
|--------|--------|
| `Caug7`, `CaugMaj7` | Augmented extended chords excluded (HC-D8) |
| `C9`, `C11`, `C13` | Extended tensions beyond MVP scope |
| `Cmaj9`, `C7#9` | Compound extensions beyond MVP scope |

---

### Phase 2: Progression Library

**Objective:** Bundled library of ~25 curated progressions with three browsing views, metadata, and commentary. User provides the progression list.

#### 2a: Library data model

Extend PD's `ProgressionRecord` with library-specific metadata (or define a `LibraryEntry` wrapper):

```ts
interface LibraryEntry {
  /** PD-compatible progression data */
  progression: {
    title: string;
    tempo_bpm: number;
    grid: GridValue;
    chords: string[];
  };
  /** Library metadata */
  composer?: string;
  genre: string;          // for genre filter
  harmonicFeature: string; // for harmonic feature filter (e.g., "ii-V-I", "chromatic mediant", "tritone sub")
  comment: string;         // explanatory note about harmonic movement
}
```

- Library data stored as a static TypeScript array (bundled, not localStorage)
- ~25 entries (user will provide the list)
- Each entry must parse successfully through `HC.parseChordSymbol()` — validated at build time or test time

**Tests (2a):**
- [ ] All library entries parse without error via `parseChordSymbol()`
- [ ] All entries have non-empty title, genre, harmonicFeature
- [ ] No duplicate titles
- [ ] TypeScript compiles with strict types

#### 2b: Library UI

Three browsing modes in the sidebar library section:
1. **All (alphabetical)** — flat list sorted by title
2. **By genre** — grouped/filtered by genre tag
3. **By harmonic feature** — grouped/filtered by harmonic feature tag

Each entry displays: title, composer (if present), genre badge, first few chords as preview, comment (expandable or tooltip).

Selection → load into progression pipeline (same path as paste: `loadProgressionFromChords()`).

**Tests (2b):**
- [ ] All three views render correct entries
- [ ] Genre filter shows only matching entries
- [ ] Harmonic feature filter shows only matching entries
- [ ] Selecting an entry loads progression (shapes rendered, path drawn, transport scheduled)
- [ ] Currently playing progression stops when new library entry selected
- [ ] Library UI scrollable when entries exceed visible area

#### 2c: Library load integration

- Library selection triggers same pipeline as paste: `parseProgressionInput()` → `loadProgressionFromChords()`
- Tempo from library entry overrides current tempo (user can adjust afterward via tempo controller)
- Grid from library entry used for beat conversion

**Tests (2c):**
- [ ] Library entry load → same visual result as pasting the same chord string
- [ ] Library entry tempo applied to transport
- [ ] Library entry grid used for beat conversion
- [ ] Loading from library while playback running → stop + load (not crash)

---

### Phase 3: Audio Quality

**Objective:** Explore synthesis alternatives for better chord blend, compare voicing strategies, tune register.

#### 3a: Synthesis sound exploration

Current: triangle + sine dual-oscillator pad (AE-D2, ±2 cents detune, LP filter 2kHz).

Exploration areas:
- Different waveform combinations (e.g., sine+sine with more detune, triangle+triangle)
- Reverb via ConvolverNode or simple delay feedback
- Different LP filter cutoff/Q
- Attack/release envelope tweaks for better chord overlap

This is an iterative listening phase — document findings, pick a direction.

```
POL-D3: Revised synthesis model
Date: 2026-02-16
Status: Open
Priority: Important
Decision: (pending A/B listening comparison)
Revisit if: After listening tests in Phase 3a.
```

#### 3b: Voicing algorithm comparison

Current: greedy minimal-motion voice-leading (AE-D3). Root can end up at any position in the voicing.

Two strategies to compare:
- **A) Current** — compact clusters, minimal total voice motion, root position varies
- **B) Root-bottom** — root always lowest note, upper voices voice-led above it. More conventional but wider spread.

Approach: implement both, listen to ii-V-I and other library progressions, decide.

```
POL-D4: Voicing strategy — root position
Date: 2026-02-16
Status: Open
Priority: Important
Options:
A) Keep current greedy minimal-motion (root floats)
B) Root always on bottom, voice-lead upper voices
C) Both available as a toggle (future extensibility)
Decision: Discuss after hearing both (user preference: option C process)
Revisit if: After A/B comparison in Phase 3b.
```

#### 3c: Register & blend tuning

- Default register currently 60 (middle C). May want lower for pad sound (48–52 range).
- Voice-count normalization (`1/sqrt(n)`) — check if it sounds right with new synthesis.
- Release overlap duration — currently 500ms, may want longer/shorter for new sound.

**Tests (Phase 3 overall):**
- [ ] Modified synthesis still passes all AE tests (172)
- [ ] Voice-leading output unchanged if algorithm not modified (regression)
- [ ] If root-bottom implemented: root is always lowest MIDI note in voicing
- [ ] New register default produces notes in intended range

---

### Phase 4: Mobile UAT

**Objective:** Systematic user acceptance testing on mobile devices. Touch interaction, responsive layout, hamburger menu, performance.

#### 4a: Touch interaction verification

- Tap → chord plays (same behavior as desktop click)
- Hold → sustained chord (pointer-down/up model)
- Drag → pan (not scrub, per UX-D3)
- Pinch → zoom
- Proximity radius adequate for finger-sized targets (may need increase from 0.12)
- No accidental edge selections when targeting triangle centers

#### 4b: Responsive layout

- Hamburger menu appears below 768px
- Sidebar overlay doesn't obscure critical canvas area
- Sidebar dismisses cleanly on outside tap
- Progression input usable on mobile keyboard (textarea sizing, autocorrect off)
- Library browser scrollable and touch-friendly
- Button tap targets ≥ 44×44px
- Info popup scrollable on small screens

#### 4c: Performance profiling

- Frame rate during progression playback (target: 60fps, acceptable: 30fps)
- Audio latency on mobile (target: <100ms from tap to sound)
- SVG element count within browser limits at mobile window sizes (12×12 = ~288 triangles)
- Memory usage during extended sessions

#### 4d: Cross-device testing

Target devices/browsers:
- iOS Safari (primary — most restrictive audio policies)
- Android Chrome
- Desktop Chrome, Firefox, Safari (regression)

**Tests (4a–4d):**
- [ ] Manual test protocol for each interaction type on each target browser
- [ ] Audio latency measurement (console timestamp logging)
- [ ] FPS measurement during playback (rAF frame timing)
- [ ] No console errors during full test session
- [ ] URL sharing works cross-device (share from desktop, open on mobile)

---

### Phase 5: Final Polish & Review

**Objective:** End-to-end walkthrough, documentation alignment, code cleanup.

#### 5a: End-to-end walkthrough
- Fresh load → explore → load library progression → play → stop → share URL → open on another device → works

#### 5b: Code review
- Remove dead code from layout/panel replacement (if applicable)
- Confirm no architecture drift from spec
- Update SPEC.md, UX_SPEC.md with final decisions

#### 5c: Documentation pass
- Close all open POL-D decisions
- Update UX_SPEC.md with final layout zones, sidebar spec, library section
- Update SPEC.md Phase 1 checklist if needed
- Final DEVLOG entry

---

## Design Decisions

```
POL-D1: Sidebar implementation approach
Date: 2026-02-16
Status: Closed — Option B
Priority: Critical
Options:
A) Modify existing createLayoutManager() + createControlPanel() in RU
B) Replace with new sidebar component in Integration ← CHOSEN
C) New sidebar component in RU, deprecate old layout/panel
Decision: Option B. Build new sidebar component in Integration module.
  RU's createLayoutManager() and createControlPanel() become unused.
  Cleanest approach — sidebar is a product-level layout concern, not a
  reusable UI component. Integration already owns the DOM wiring.
  RU layout/panel code can be retired in Phase 5b code review.
```

```
POL-D2: Application title
Date: 2026-02-16 (closed 2026-02-17)
Status: Closed
Priority: Minor
Decision: "Tone Nets" with subtitle "an interactive Tonnetz explorer"
Revisit if: Better name emerges before deployment.
```

```
POL-D3: Revised synthesis model
Date: 2026-02-16
Status: Open
Priority: Important
Decision: Pending A/B listening comparison.
Revisit if: After listening tests in Phase 3a.
```

```
POL-D4: Voicing strategy — root position
Date: 2026-02-16
Status: Open
Priority: Important
Options:
A) Keep current greedy minimal-motion (root floats)
B) Root always on bottom, voice-lead upper voices
C) Both available as a toggle
Decision: Discuss after hearing both.
Revisit if: After A/B comparison in Phase 3b.
```

```
POL-D5: Mobile proximity radius
Date: 2026-02-16
Status: Open
Priority: Important
Context: Desktop hit-test radius is 0.12 world units (tuned in Design Pass 2).
Finger contact area is ~7mm vs mouse pointer ~1px. May need separate
mobile radius or a larger shared radius.
Decision: Deferred to Phase 4a mobile testing.
Revisit if: Mobile testing reveals edge-selection is too easy or triangle-selection too hard.
```

```
POL-D6: Interactive press extension display
Date: 2026-02-16
Status: Closed — Option C
Priority: Important
Decision: Option C — always show triad on press; full Shape on progression playback.
  - Idle press: triad (single triangle) or edge-union (two adjacent triangles,
    4 pcs). These are what the lattice naturally produces. No dots, no
    decomposition beyond adjacent triangles.
  - Playback: full Shape rendering including ext_tris and dot_pcs for chords
    that go beyond what two adjacent triangles cover (e.g., add9, dim7).
  Current behavior is correct — not a bug. No code change needed.
Rationale:
In exploration, you play what the lattice gives you. In playback, the full chord
decomposition is shown because the chord identity is known from the progression.
```

```
POL-D7: Chord grammar expansion scope
Date: 2026-02-16
Status: Closed
Priority: Important
Decision: Option B — input cleaning (Layer 1) + dim7/m7b5 in HC (Layer 2).
Layer 1 (integration, progression-pipeline.ts): strip slash bass, convert ø/Δ/-,
  strip parenthesized additions, convert sus → bare triad with warning.
Layer 2 (HC, chords.ts): add dim7 [0,3,6,9] and m7b5 [0,3,6,10] to parser
  regex and EXTENSION_INTERVALS.
Rationale:
dim7 and m7b5 are essential for jazz standards — the library will need them.
Input cleaning handles the long tail of notation variants without bloating HC's
grammar. Slash chord bass voicing is a future concern; stripping the bass note
is acceptable for MVP.
Revisit if: Library progressions require chord types beyond dim7/m7b5 (e.g., sus,
9, 11, 13) — at that point reconsider Option C.
```

```
POL-D9: Sidebar information architecture
Date: 2026-02-17
Status: Closed
Priority: Critical
Decision: Two-tab sidebar (Play | Library) with persistent header above tabs.
  Header: title/subtitle + info buttons (? and ⓘ).
  Play tab: active chord display, progression input, transport controls + tempo.
  Library tab: genre/feature filter tabs, scrollable entry list with expandable cards.
  How to Use and What This Is as full-viewport overlay modals (not sidebar content).
Rationale:
  "Doing" (playback controls) and "Choosing" (library browsing) are distinct
  usage modes that compete for sidebar space. Tabs separate them cleanly — each
  gets full sidebar height. Library scales to 50+ entries without squeezing controls.
  Reference content (How/What) benefits from full-viewport reading width and is
  used infrequently — overlays are appropriate.
  Auto-switch to Play tab on library selection eliminates the extra-tap concern.
Revisit if: A third usage mode emerges (e.g., analysis/annotation) that needs
  its own tab.
```

```
POL-D10: Active chord display
Date: 2026-02-17
Status: Closed
Priority: Normal
Decision: Show active chord name in Play tab, compact single line.
  Interactive exploration: chord symbol from hit-test result.
  Playback: current chord from progression.
  Idle: placeholder text.
Rationale:
  Particularly valuable for 4-note chords (7ths, dim7, m7b5) and edge
  unions where the sounding pitch classes aren't obvious from the grid.
  Compact enough to not compete with playback controls for space.
Revisit if: Display needs to show more detail (e.g., pitch-class list,
  interval labels). Could expand to a multi-line display in future.
```

```
POL-D11: Playback control set
Date: 2026-02-17
Status: Closed
Priority: Important
Decision: Play (▶), Stop (■), Loop (🔁 toggle), Clear (✕). No Pause button.
  Loop is a toggle — when active, transport auto-restarts on completion.
  Standard tape-recorder iconography for immediate recognition.
Rationale:
  Pause adds state complexity (paused vs stopped, resume position tracking)
  for minimal value in a progression explorer. Stop + replay is sufficient.
  Loop is essential for studying harmonic patterns by repeated listening.
Revisit if: Users request pause for long progressions.
```

```
POL-D12: Library progression detail display
Date: 2026-02-17
Status: Closed
Priority: Normal
Decision: Expandable card within the library list (accordion-style).
  Summary row: title, composer, genre badge, first few chord symbols as preview.
  Expanded: full comment, roman numeral analysis, tempo, complete chord list.
  One card open at a time. "Load" button in expanded detail → loads progression +
  auto-switches to Play tab.
Rationale:
  User is browsing and comparing — expandable cards let them peek at details
  without losing their place in the list. Auto-switch to Play tab after load
  eliminates the extra tap to reach playback controls.
Revisit if: Detail content exceeds what fits in an expanded card (e.g., if we
  add audio preview or visual path thumbnail).
```
