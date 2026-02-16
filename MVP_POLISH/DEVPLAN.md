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

**Phase:** 0b — Pre-Polish Bug Fixes (complete)
**Focus:** Chord grammar expansion — dim7/m7b5 in HC (Layer 2) + input cleaning in Integration (Layer 1).
**Blocked/Broken:** Nothing

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

**Objective:** Unify sidebar/palette into a single panel. Desktop: permanent left sidebar. Mobile: hamburger menu dropdown. Add tempo controller, app title, info/about button. Redesign button styling.

#### 1a: Layout architecture decision & sidebar shell

Decide and implement the panel container structure:
- **Desktop (≥768px):** permanent left sidebar, always visible. Canvas fills remaining width.
- **Mobile (<768px):** sidebar hidden by default. Hamburger button (☰) in top-left corner reveals sidebar as an overlay/dropdown. Tap outside or hamburger again to dismiss.
- Sidebar contains (top to bottom): title/branding, progression input, library browser (Phase 2), playback controls + tempo, info/about button.
- `createLayoutManager()` in RU currently implements a three-zone layout (toolbar, canvas, control panel). This needs to be reworked or replaced.

**Decision needed:**
```
POL-D1: Sidebar implementation approach
Date: 2026-02-16
Status: Closed — Option B
Priority: Critical
Options:
A) Modify existing createLayoutManager() + createControlPanel() in RU — preserves test coverage
B) Replace with new sidebar component in Integration ← CHOSEN
C) New sidebar component in RU, deprecate old layout/panel
Decision: Option B. Build new sidebar in Integration module.
  RU layout/panel become unused; retired in Phase 5b.
```

**Tests (1a):**
- [ ] Desktop: sidebar visible, canvas fills remaining space
- [ ] Mobile: sidebar hidden, hamburger button visible
- [ ] Hamburger tap → sidebar appears as overlay
- [ ] Outside tap / hamburger tap → sidebar dismisses
- [ ] Canvas interaction (pan/zoom/tap) works alongside sidebar on desktop
- [ ] ResizeObserver fires on sidebar show/hide → canvas recomputes viewport

#### 1b: Tempo controller

Resolves INT-D8 (Open → Closed).
- Slider or number input with range ~40–240 BPM, default 120
- Lives in the sidebar playback controls section
- Wired to `AudioTransport.setTempo(bpm)` and `PD.saveSettings({ tempo_bpm })`
- Shows current BPM value as label

**Tests (1b):**
- [ ] Tempo change → `transport.setTempo()` called with correct value
- [ ] Tempo change → `PD.saveSettings()` called
- [ ] Tempo from PD settings → slider/input reflects saved value on load
- [ ] Range clamped to valid BPM (no negative, no zero, no absurd values)

#### 1c: Button visual redesign

- Play, Stop, Clear buttons styled consistently
- Load/paste area styled
- Disabled state visually distinct
- Touch-friendly sizing (min 44×44px tap target)

**Tests (1c):**
- [ ] All buttons have min 44×44px touch target
- [ ] Disabled buttons have distinct visual treatment
- [ ] Button states (normal/hover/active/disabled) all defined

#### 1d: Title & branding

- App title displayed at top of sidebar
- Working title: "Tone Nets" (pending final decision)
- Minimal branding — title text, possibly a small geometric icon

```
POL-D2: Application title
Date: 2026-02-16
Status: Open
Priority: Minor
Decision: "Tone Nets" (tentative)
Revisit if: Better name emerges before deployment.
```

**Tests (1d):**
- [ ] Title visible in sidebar header
- [ ] Title visible in mobile hamburger header
- [ ] Page `<title>` matches

#### 1e: Info popups (two separate modals)

Two distinct info modals, each triggered from a button in the sidebar:

**"How to Use" popup** (triggered by `?` or "How to Use" button):
- Interaction guide: tap triangle → triad, tap near edge → union chord, drag → pan, scroll → zoom
- Keyboard shortcuts: Space = play/stop, Escape = clear
- **Supported chord symbols** reference table (see §Supported Chord Reference below)
- Input tips: paste or type, pipe or space delimited
- Library: how to browse and load

**"What This Is" popup** (triggered by `ⓘ` or "About" button):
- What is a Tonnetz — history, theory, geometric meaning
- How harmonic relationships map to spatial proximity
- Voice-leading as geometric distance
- Credits / author
- Link to source or further reading

Both popups:
- Dismissible via close button, Escape key, or outside click
- Scrollable if content exceeds viewport on mobile

```
POL-D8: Two info popups (How to Use vs What This Is)
Date: 2026-02-16
Status: Closed
Priority: Normal
Decision: Split into two separate modals rather than one combined popup.
  - "How to Use" — practical: interaction, shortcuts, supported chords, input tips
  - "What This Is" — conceptual: Tonnetz history, theory, credits
Rationale:
Different audiences and purposes. A musician wanting to know which chords work
shouldn't have to scroll past theory history. A curious user wanting to understand
the Tonnetz shouldn't wade through input syntax.
```

**Tests (1e):**
- [ ] "How to Use" button opens correct popup with interaction guide + chord table
- [ ] "What This Is" button opens correct popup with theory + credits
- [ ] Both dismiss via close/Escape/outside click
- [ ] Both scrollable on mobile
- [ ] Only one popup visible at a time (opening one closes the other)

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
Date: 2026-02-16
Status: Open
Priority: Minor
Decision: "Tone Nets" (tentative)
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
