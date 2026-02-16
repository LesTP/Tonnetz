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
import type { GridValue } from "persistence-data";

import {
  gridToBeatsPerChord,
  collapseRepeatedChords,
  type CollapsedChord,
} from "./grid-to-beats.js";

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

  // 6. Strip sus chords: Csus4 → C, Csus2 → C, Dsus → D (with warning)
  if (/sus[24]?/.test(s)) {
    warning = `"${raw}" → sus stripped (not supported in MVP), treated as "${s.replace(/sus[24]?/, "")}"`;
    s = s.replace(/sus[24]?/, "");
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

/** Successful pipeline result. */
export interface PipelineSuccess {
  readonly ok: true;
  readonly shapes: Shape[];
  readonly events: ChordEvent[];
  readonly collapsed: CollapsedChord[];
  /** Warnings from input cleaning (e.g., sus stripped). Empty if no warnings. */
  readonly warnings: string[];
}

/** Failed pipeline result (one or more chord symbols failed to parse). */
export interface PipelineError {
  readonly ok: false;
  readonly error: string;
  readonly failedSymbols: string[];
}

export type PipelineResult = PipelineSuccess | PipelineError;

/** Arguments for the progression load pipeline. */
export interface PipelineArgs {
  readonly chords: readonly string[];
  readonly grid: GridValue;
  readonly focus: CentroidCoord;
  readonly indices: WindowIndices;
}

/**
 * Full progression load pipeline: chord strings → Shape[] + ChordEvent[].
 *
 * Steps:
 * 1. Collapse consecutive identical chord symbols (INT-D4)
 * 2. Parse each unique symbol via HC parseChordSymbol()
 * 3. Map parsed chords to Shapes via HC mapProgressionToShapes()
 * 4. Build ChordEvent[] manually with variable per-chord durations (INT-D5)
 *
 * Returns a discriminated union: `{ ok: true, shapes, events }` on success,
 * or `{ ok: false, error, failedSymbols }` if any symbol fails to parse.
 *
 * Empty input produces an empty success result (not an error).
 */
export function loadProgressionPipeline(args: PipelineArgs): PipelineResult {
  const { chords, grid, focus, indices } = args;

  if (chords.length === 0) {
    return { ok: true, shapes: [], events: [], collapsed: [], warnings: [] };
  }

  // Step 1: collapse consecutive identical symbols
  const collapsed = collapseRepeatedChords(chords);

  // Step 2: clean + parse each unique symbol
  const parsedChords: Chord[] = [];
  const failedSymbols: string[] = [];
  const warnings: string[] = [];

  for (const entry of collapsed) {
    const { cleaned, warning } = cleanChordSymbol(entry.symbol);
    if (warning) warnings.push(warning);
    try {
      parsedChords.push(parseChordSymbol(cleaned));
    } catch {
      failedSymbols.push(entry.symbol);
    }
  }

  if (failedSymbols.length > 0) {
    return {
      ok: false,
      error: `Failed to parse chord symbol(s): ${failedSymbols.join(", ")}`,
      failedSymbols,
    };
  }

  // Step 3: map to shapes via chain-focus placement (HC-D11)
  const shapes = mapProgressionToShapes(parsedChords, focus, indices);

  // Step 4: build ChordEvent[] with variable durations (INT-D5)
  const beatsPerSlot = gridToBeatsPerChord(grid);
  const events: ChordEvent[] = [];
  let startBeat = 0;

  for (let i = 0; i < shapes.length; i++) {
    const durationBeats = collapsed[i].count * beatsPerSlot;
    events.push({
      shape: shapes[i],
      startBeat,
      durationBeats,
    });
    startBeat += durationBeats;
  }

  return { ok: true, shapes, events, collapsed, warnings };
}
