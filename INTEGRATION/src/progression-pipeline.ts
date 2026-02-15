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
    return { ok: true, shapes: [], events: [], collapsed: [] };
  }

  // Step 1: collapse consecutive identical symbols
  const collapsed = collapseRepeatedChords(chords);

  // Step 2: parse each unique symbol
  const parsedChords: Chord[] = [];
  const failedSymbols: string[] = [];

  for (const entry of collapsed) {
    try {
      parsedChords.push(parseChordSymbol(entry.symbol));
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

  return { ok: true, shapes, events, collapsed };
}
