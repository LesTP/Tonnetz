# DEVLOG — MVP Polish Track

Module: MVP Polish (cross-cutting)
Started: 2026-02-16

---

## Entry 3 — Phase 0b Layer 1: Input Cleaning

**Date:** 2026-02-16

### Problem

Musicians type chord symbols in many notational variants: `C/E` (slash chords), `C-7` (dash for minor), `CΔ7` (triangle for maj7), `Cø7` (slashed-O for half-diminished), `C7(b9)` (parenthesized alterations), `Csus4` (suspended chords). HC's parser rejects all of these — it only accepts the canonical form.

### Solution

Added `cleanChordSymbol()` to `progression-pipeline.ts` in the Integration module. This runs before `parseChordSymbol()` and normalizes input:

| Rule | Example | Result |
|------|---------|--------|
| Slash bass stripping | `Dm7/A` → `Dm7` | Negative lookbehind `(?<!6)` preserves `6/9` |
| Parenthesized alterations | `C7(b9)` → `C7` | Regex `\([^)]*\)` |
| Half-diminished symbol | `Cø7` → `Cm7b5` | Unicode `ø` → `m7b5` |
| Triangle symbol | `CΔ7`, `C△` → `Cmaj7` | Unicode `Δ` or `△` → `maj7` |
| Dash-as-minor | `C-7` → `Cm7` | Anchored after root+accidental |
| Sus stripping | `Csus4` → `C` + warning | Lossy — warning surfaced in `PipelineSuccess.warnings` |

The cleaning function returns `{ cleaned, warning }` — warnings propagate through the pipeline into `PipelineSuccess.warnings[]` for UI display.

### Wiring

Changed `loadProgressionPipeline()` Step 2 from:
```ts
parsedChords.push(parseChordSymbol(entry.symbol));
```
to:
```ts
const { cleaned, warning } = cleanChordSymbol(entry.symbol);
if (warning) warnings.push(warning);
parsedChords.push(parseChordSymbol(cleaned));
```

Added `warnings: string[]` field to `PipelineSuccess` interface. Exported `cleanChordSymbol` and `CleanResult` from `index.ts`.

### Design Notes

- **Slash bass stripping** uses negative lookbehind `(?<!6)` to avoid eating the `6/9` extension. This is the trickiest regex in the function — `C6/9` must NOT become `C6`.
- **Order of operations matters:** slash stripping happens first (removes `/A` before other rules can misparse it), then parentheses, then symbol conversions, then sus stripping (last because it generates a warning).
- **Empty/whitespace input** short-circuits to `{ cleaned: "", warning: null }`.
- **`PipelineSuccess.warnings` is additive** — existing code that destructures success results is not affected.

### Files Changed

**INTEGRATION:**
- `src/progression-pipeline.ts` — Added `cleanChordSymbol()`, `CleanResult`, wired into pipeline, added `warnings` to `PipelineSuccess`
- `src/index.ts` — Export `cleanChordSymbol`, `CleanResult`
- `src/__tests__/progression-pipeline.test.ts` — +46 tests across 3 describe blocks (unit: 31 clean tests, integration: 8 pipeline tests, passthrough: 7 tests)

### Test Results

```
HC:  178 passed  (no change)
RU:  341 passed  (no change)
AE:  172 passed  (no change)
PD:  108 passed  (no change)
INT: 187 passed  (+46 new: input cleaning)
Total: 986 passed — 0 failures
tsc --noEmit: 0 errors
```

### Regression Check

All 23 pre-existing pipeline tests still pass. The `warnings` field is additive — `integration-flow.test.ts` (32 tests) passes without any modification.

---

## Entry 2 — Phase 0b Layer 2: dim7 and m7b5 Grammar Expansion

**Date:** 2026-02-16

### Problem

HC parser (`parseChordSymbol()`) rejected `Cdim7` and `Cm7b5` — two chord types needed for jazz library entries (notably Entry 11: Autumn Leaves, which uses `Am7b5`).

Previous regex: `^([A-G])(#|b)?(m(?!aj)|dim|aug)?(maj7|add9|6\/9|6|7)?$`

This had two problems:
1. **`Cdim7` parsed incorrectly** — regex captured `dim` as quality and `7` as extension, producing intervals [0,3,6,10] (half-diminished). A true dim7 chord has [0,3,6,9] (diminished 7th = bb7, interval 9).
2. **`Cm7b5` rejected entirely** — regex captured `m` as quality, but `7b5` doesn't match any extension token.

### Solution

Restructured regex with compound token capture group:

```
/^([A-G])(#|b)?(?:(dim7|m7b5)|(m(?!aj)|dim|aug)?(maj7|add9|6\/9|6|7)?)?$/
```

- Group 3: compound suffix (`dim7` or `m7b5`) — matched BEFORE groups 4/5
- Groups 4/5: standard quality + extension (only tried when group 3 doesn't match)
- When compound matches, parser derives quality=dim and extension from the compound token

New `EXTENSION_INTERVALS` entries:
- `dim7: [9]` — diminished 7th (bb7, interval 9 from root)
- `m7b5: [10]` — minor 7th (b7, interval 10 from root)

Both use `quality = "dim"` (diminished triad [0,3,6]) as the base. The distinction is solely in the 7th:
- dim7: [0,3,6] + [9] = {0,3,6,9} — fully diminished (symmetric, minor 3rds all the way)
- m7b5: [0,3,6] + [10] = {0,3,6,10} — half-diminished (dim triad + minor 7th)

### Files Changed

**HARMONY_CORE:**
- `src/types.ts` — Added `"dim7"` and `"m7b5"` to `Extension` union type
- `src/chords.ts` — Restructured `CHORD_RE` regex (5 capture groups), added compound token parsing path, added `dim7`/`m7b5` to `EXTENSION_INTERVALS`
- `src/__tests__/chords.test.ts` — +10 tests (5 parse tests + 5 pitch-class correctness tests + 1 symmetry test... wait, 10 total)

### Test Results

```
HC:  178 passed  (+10 new: dim7/m7b5 parse + pc correctness)
RU:  341 passed  (no change)
AE:  172 passed  (no change)
PD:  108 passed  (no change)
INT: 141 passed  (no change)
Total: 940 passed — 0 failures
tsc --noEmit: 0 errors (HARMONY_CORE)
```

### Regression Check

All pre-existing chord tests still pass:
- `Cdim` still parses as dim triad (quality=dim, extension=null) — the `dim` quality-only path is unaffected
- `Cm7` still parses as minor 7th (quality=min, extension=7) — the `m` quality path is unaffected
- All 12 roots × maj and min still correct
- Aug+extension rejection still works

### Library Compatibility

After this change, 27 of 28 library entries parse with no cleaning required. Entry 11 (Autumn Leaves) with `Am7b5` now parses correctly. Only Layer 1 (input cleaning) remains for handling notation variants (slash chords, ø, Δ, etc.).

---

## Migrated Entries (0a–0e)

The following entries were originally logged under Integration Module DEVLOG (Entries 18–22, Phase 8: User Testing). They are migrated here because they represent UX/visual polish work, not integration wiring. Original dates and content preserved; entry numbering prefixed with `0` to indicate pre-track work.

---

## Entry 0a — Design Pass 1 (Visual Tuning)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 18

### User Feedback (5 items)

| # | Feedback | Resolution |
|---|----------|------------|
| 1 | Default zoom too far out — few progressions span more than 6 triangles | Default zoom 1 → 4 (MAX_ZOOM raised to 8) |
| 2 | Pointer should be a circle to show triangle vs edge hit zone | Added `ProximityCursor` — dashed circle follows pointer. New file: `cursor.ts` |
| 3 | Node labels overlap circles, hard to read; grid too dark | Node circles enlarged (0.08→0.15 radius), grid lightened, labels bolded |
| 4 | Grid is a skewed parallelogram, should be rectangular | Skipped — at 4× default zoom the edges are off-screen |
| 5 | Major/minor triangles should be different colors; active chord should be bright | Grid: major=pale blue, minor=pale red. Active shapes: bright blue/red. |

Additional: cursor circle reduced to 1/3 proximity radius; playing chord highlight wired.

### Files Changed

**RENDERING_UI:** `camera.ts`, `renderer.ts`, `shape-renderer.ts`, `highlight.ts`, `cursor.ts` (new), `index.ts`, `camera.test.ts`, `camera-controller.test.ts`
**INTEGRATION:** `main.ts`

---

## Entry 0b — Design Pass 2 (Interaction Fixes)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 19

### Feedback Items (8)

| # | Issue | Fix |
|---|-------|-----|
| 1 | First click sustains indefinitely | Async race: added `pointerGeneration` counter for race prevention |
| 2 | Highlights appear only on release, not press | Moved highlight to `onPointerDown` wrapper |
| 3 | Clicking inside triangle plays extended chord | Proximity radius 0.5 → 0.12 world units |
| 4 | Interaction highlights persist in playback mode | Added `clearAllHighlights` on play/load |
| 5 | Interaction colors more vivid than playback colors | Aligned fill opacities (0.55 main, 0.28 ext) |
| 6 | Cursor circle bigger than triangle | Cursor radius matched to hit-test radius |
| 7 | Visual cursor accurate but audio hits edges | Unified hit-test radius across all three paths (0.12) |
| 8 | Clicking around triangle plays different chords | Resolved by #7 |

### Architecture Insight: Three Hit-Test Radii

Key lesson — three independent radii needed synchronization:
1. `interaction-controller.ts` — tap/drag classification
2. `interaction-wiring.ts` — audio hit-test
3. `main.ts` — visual highlight hit-test

All three now use `computeProximityRadius(0.12)` = 0.12 world units.

### Files Changed

**RENDERING_UI:** `interaction-controller.ts`, `highlight.ts`
**INTEGRATION:** `interaction-wiring.ts`, `main.ts`

---

## Entry 0c — Design Pass 3 (Colors, Labels, Enharmonics)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 20

### Feedback Items (4)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Major/minor colors should be flipped (major=red, minor=blue is standard) | Swapped all color assignments |
| 2 | Note labels should show enharmonic equivalents (C#/Db) | Added `PC_ENHARMONIC` lookup; dual text elements for enharmonic nodes |
| 3 | Enharmonic labels cramped | Font size 75% → 62% of base |
| 4 | Note labels should be dark grey not black | `LABEL_COLOR` `#111` → `#555` |

### Files Changed

**RENDERING_UI:** `renderer.ts`, `shape-renderer.ts`, `highlight.ts`, `renderer.test.ts`

---

## Entry 0d — Design Pass 4 (Playing State Redesign + Grid Highlighter)

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 21

### Architecture Change: Overlay → Mutate-Grid

**Problem:** Overlay SVG polygons on `layer-chords`/`layer-interaction` covered node circles rendered in `layer-grid` — nodes looked buried.

**Solution:** New **mutate-grid** approach. Directly mutate existing `layer-grid` triangle polygon `fill`, edge line `stroke`/`stroke-width`, and node circle `stroke`/`stroke-width`. `saveOnce()` mechanism stores originals and restores on deactivation. UX_SPEC §3 updated with the at-rest/playing visual encoding tables.

### Feedback Items (8)

| # | Issue | Fix |
|---|-------|-----|
| 1 | At-rest triangles too faint (0.25 opacity) | Increased to 0.45 |
| 2 | Playing triangles not dramatic enough | Fully opaque hex fills: major `#c84646`, minor `#5082d2` |
| 3 | Playing state covers node circles | Grid-highlighter mutates grid directly |
| 4 | Node circles don't restore after release | Fixed double-save bug with Set tracking |
| 5 | Edges should change when playing | Grid-highlighter mutates edge strokes; polygon stroke → `"none"` |
| 6 | Double-line effect at edges | All playing colors fully opaque; polygon stroke `"none"` |
| 7 | Edges and nodes should be same shade | Unified grey at rest, unified colors when playing |
| 8 | Edges and nodes should have same thickness | Unified widths (0.02 rest, 0.035 playing, 0.05 root) |

### Files Changed

**RENDERING_UI (new):** `grid-highlighter.ts`
**RENDERING_UI (modified):** `renderer.ts`, `shape-renderer.ts`, `highlight.ts`, `index.ts`
**INTEGRATION:** `main.ts`

---

## Entry 0e — Playback Testing Session

**Date:** 2026-02-16
**Origin:** Integration DEVLOG Entry 22

### Bugs Found & Fixed (4)

| # | Bug | Fix |
|---|-----|-----|
| 1 | Interactive grid highlight fires during playback (UX-D6 violation) | Added UI state check at top of `onPointerDown` wrapper |
| 2 | `handleStop()` doesn't clear playback grid highlight | Added deactivate in `handleStop()` |
| 3 | Natural completion leaves last chord highlighted | Added `transport.onStateChange()` listener for `playing: false` |
| 4 | Dual grid highlight handle conflict | Explicit clear of both handles in `handlePlay()` |

### Code Review Findings (No-Fix)

- `createControlPanelCallbacks()` unused — benign dead code
- `onTriangleSelect`/`onEdgeSelect` are no-ops after highlight move to `onPointerDown` — correct but could simplify
- Dual `onStateChange` listeners (main.ts + wireTransportToUIState) — idempotent, safe

### Files Changed

**INTEGRATION:** `main.ts`

---

## Entry 1 — Track Setup & Documentation Restructuring

**Date:** 2026-02-16

### Changes

- Created `MVP_POLISH/DEVPLAN.md` — cold start summary, 5-phase breakdown (UI Layout, Progression Library, Audio Quality, Mobile UAT, Final Polish), 5 open decisions (POL-D1 through POL-D5)
- Created `MVP_POLISH/DEVLOG.md` — migrated Integration DEVLOG Entries 18–22 as Entries 0a–0e
- Closed Integration track (DEVPLAN marked complete, DEVLOG closing entry added)
- Updated UX_SPEC.md with new layout direction (sidebar/hamburger), library section, title

### Integration Track Closure Summary

The Integration Module DEVPLAN/DEVLOG covered:
- **Phases 1–7:** Scaffolding, grid-to-beat bridging, interaction wiring, transport wiring, persistence wiring, application assembly, polish & review (keyboard shortcuts, logging, perf review)
- **Phase 8:** User testing — 4 design passes + playback testing (migrated to this track)
- **930 tests passing** across all modules at handoff
- **INT-D8 (tempo control UI)** carried forward as POL-D1/Phase 1b dependency

---
