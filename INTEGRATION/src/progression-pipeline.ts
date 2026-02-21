/**
 * Progression pipeline for the integration module.
 *
 * Phase 2b: parseProgressionInput() — split raw text into chord symbol tokens.
 * Phase 2c: loadProgressionPipeline() — full pipeline from chord symbols to
 *   Shape[] + ChordEvent[], bridging PD's grid-based durations to AE's beat
 *   scheduling via manual ChordEvent construction (INT-D5).
 *
 * See DEVPLAN §Phase 2b, §Phase 2c.
 */

import type { Chord, Shape, CentroidCoord, WindowIndices } from "harmony-core";
import { parseChordSymbol, mapProgressionToShapes } from "harmony-core";
import type { ChordEvent } from "audio-engine";

// ── Phase 0b Layer 1: Input Cleaning ─────────────────────────────

/** Result of cleaning a chord symbol. */
export interface CleanResult {
  /** Cleaned chord symbol ready for HC parseChordSymbol(). */
  readonly cleaned: string;
  /** Optional warning if lossy normalization was applied. */
  readonly warning: string | null;
}

/**
 * Normalize a raw chord symbol before HC parsing.
 *
 * Handles notation variants that HC's parser doesn't support directly:
 *  - Slash bass: `C/E` → `C`, `Dm7/A` → `Dm7` (bass voicing not in MVP)
 *  - Half-diminished: `Cø7`, `Cø` → `Cm7b5`
 *  - Dash-as-minor: `C-7` → `Cm7`, `C-` → `Cm`
 *  - Triangle-as-maj7: `CΔ7`, `CΔ`, `C△7`, `C△` → `Cmaj7`
 *  - Parenthesized alterations: `C7(b9)` → `C7`, `G7(#11)` → `G7`
 *  - Sus chords: `Csus4`, `Csus2`, `Dsus` → `C`, `C`, `D` (with warning)
 *
 * Returns the cleaned symbol and an optional warning string.
 * If no cleaning was needed, returns the original symbol with null warning.
 */
export function cleanChordSymbol(raw: string): CleanResult {
  let s = raw.trim();
  if (!s) return { cleaned: s, warning: null };

  let warning: string | null = null;

  // 1. Strip slash bass notation: "Dm7/A" → "Dm7"
  //    Must NOT strip 6/9 — that's an extension, not a slash chord.
  //    Pattern: slash followed by a root note (A-G with optional #/b) at end of string,
  //    but NOT preceded by "6" (which would be the 6/9 extension).
  s = s.replace(/(?<!6)\/[A-Ga-g][#b]?$/, "");

  // 2. Strip parenthesized alterations: "C7(b9)" → "C7"
  s = s.replace(/\([^)]*\)/g, "");

  // 3. Convert half-diminished symbol: ø7 → m7b5, ø → m7b5
  s = s.replace(/ø7?/, "m7b5");

  // 4. Convert triangle symbol to maj7: Δ7 → maj7, Δ → maj7, △7 → maj7, △ → maj7
  s = s.replace(/[Δ△]7?/, "maj7");

  // 5. Convert dash-as-minor: C-7 → Cm7, C- → Cm
  //    Dash must follow root+accidental, not appear elsewhere.
  //    Pattern: after root letter (A-G) and optional accidental (#/b), replace "-" with "m"
  s = s.replace(/^([A-Ga-g][#b]?)-/, "$1m");

  // 6. Convert 9th chord shorthand: C+9 → Cadd9, C9 → Cadd9
  //    But not 6/9 (already supported) or add9 (already correct)
  s = s.replace(/\+9$/, "add9");
  s = s.replace(/(?<!add)(?<!6\/)9$/, "add9");

  // 7. Strip sus chords: Csus4 → C, Csus2 → C, Dsus → D (with warning)
  if (/sus[24]?/.test(s)) {
    warning = `"${raw}" → sus stripped (not supported in MVP), treated as "${s.replace(/sus[24]?/, "")}"`;
    s = s.replace(/sus[24]?/, "");
  }

  // 7. Strip extension from augmented chords: Gaug7 → Gaug (aug+ext excluded from MVP, SPEC D-8)
  if (/^[A-Ga-g][#b]?aug(maj7|add9|6\/9|6|7)$/.test(s)) {
    s = s.replace(/(aug)(maj7|add9|6\/9|6|7)$/, "$1");
  }

  return { cleaned: s, warning };
}

// ── Phase 2b: Progression Text Parsing ──────────────────────────────

/**
 * Split raw text input into chord symbol tokens.
 *
 * Accepts pipe `|` or whitespace as delimiters (INT-D7 Closed: Option C).
 * Trims each token and rejects empty strings.
 *
 * @param text — raw progression text (e.g., "Dm7 | G7 | Cmaj7")
 * @returns array of non-empty chord symbol strings
 */
export function parseProgressionInput(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/[|\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// ── Phase 2c: Progression Load Pipeline ─────────────────────────────

/** Pipeline result — always succeeds (unrecognized chords silently stripped). */
export interface PipelineSuccess {
  readonly ok: true;
  readonly shapes: Shape[];
  readonly events: ChordEvent[];
  /** Cleaned chord symbols that parsed successfully. */
  readonly cleanedSymbols: string[];
  /** Warnings from input cleaning (e.g., sus stripped). Empty if no warnings. */
  readonly warnings: string[];
}

export type PipelineResult = PipelineSuccess;

/** Arguments for the progression load pipeline. */
export interface PipelineArgs {
  readonly chords: readonly string[];
  readonly focus: CentroidCoord;
  readonly indices: WindowIndices;
}

/**
 * Full progression load pipeline: chord strings → Shape[] + ChordEvent[].
 *
 * Duration model (POL-D17): every chord = 4 beats (one bar). No collapsing.
 * Unrecognized chord symbols are silently stripped.
 *
 * Steps:
 * 1. Clean + parse each symbol via HC parseChordSymbol() (skip failures)
 * 2. Map parsed chords to Shapes via HC mapProgressionToShapes()
 * 3. Build ChordEvent[] with uniform 4-beat durations
 *
 * Always returns `ok: true`. Empty input or all-failed input produces
 * an empty success result.
 */
export function loadProgressionPipeline(args: PipelineArgs): PipelineResult {
  const { chords, focus, indices } = args;

  if (chords.length === 0) {
    return { ok: true, shapes: [], events: [], cleanedSymbols: [], warnings: [] };
  }

  // Step 1: clean + parse each symbol, silently skip failures
  const parsedChords: Chord[] = [];
  const warnings: string[] = [];
  const cleanedSymbols: string[] = [];

  for (const raw of chords) {
    const { cleaned, warning } = cleanChordSymbol(raw);
    if (warning) warnings.push(warning);
    try {
      parsedChords.push(parseChordSymbol(cleaned));
      cleanedSymbols.push(cleaned);
    } catch {
      // Unrecognized chord symbol — silently skip
    }
  }

  if (parsedChords.length === 0) {
    return { ok: true, shapes: [], events: [], cleanedSymbols: [], warnings: [] };
  }

  // Step 2: map to shapes via chain-focus placement (HC-D11)
  const shapes = mapProgressionToShapes(parsedChords, focus, indices);

  // Step 3: build ChordEvent[] — uniform 4 beats per chord (POL-D17)
  const BEATS_PER_CHORD = 4;
  const events: ChordEvent[] = [];
  let startBeat = 0;

  for (let i = 0; i < shapes.length; i++) {
    events.push({
      shape: shapes[i],
      startBeat,
      durationBeats: BEATS_PER_CHORD,
    });
    startBeat += BEATS_PER_CHORD;
  }

  return { ok: true, shapes, events, cleanedSymbols, warnings };
}
