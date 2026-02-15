/**
 * Grid-to-beat conversion for the integration module.
 *
 * PD stores durations as grid notation ("1/4", "1/8", etc.) where duration
 * is implicit via repeated chord tokens (PD-D2). AE schedules in beats.
 * This module bridges the two models.
 *
 * Beat calculation assumes a 4-beat bar: beatsPerChord = 4 / denominator.
 *   "1/4" → 1 beat (quarter note grid)
 *   "1/8" → 0.5 beats (eighth note grid)
 *   "1/3" → 4/3 beats (triplet — bar divided by 3)
 *   "1/6" → 2/3 beats (triplet eighth — bar divided by 6)
 *
 * See SPEC.md §Grid-to-Beat Bridging, INT-D4.
 */

import type { GridValue } from "persistence-data";

/** Grid denominator → beats per chord (4-beat bar). */
const GRID_BEATS: ReadonlyMap<GridValue, number> = new Map([
  ["1/4", 1],
  ["1/8", 0.5],
  ["1/3", 4 / 3],
  ["1/6", 2 / 3],
]);

/**
 * Convert a PD grid value to beats per chord.
 *
 * @param grid — PD grid notation string
 * @returns beats per single chord slot at that grid resolution
 */
export function gridToBeatsPerChord(grid: GridValue): number {
  const beats = GRID_BEATS.get(grid);
  if (beats === undefined) {
    throw new Error(`Unknown grid value: ${grid}`);
  }
  return beats;
}

/** A collapsed chord entry: unique symbol with its consecutive repeat count. */
export interface CollapsedChord {
  readonly symbol: string;
  readonly count: number;
}

/**
 * Collapse consecutive identical chord symbols into entries with repeat counts.
 *
 * PD encodes duration by repetition: ["Dm7","Dm7","G7"] means Dm7 lasts
 * 2 grid slots and G7 lasts 1. This function groups consecutive identical
 * symbols so the pipeline can compute per-chord durations.
 *
 * @param chords — raw chord symbol array (possibly with repeats)
 * @returns collapsed array with symbol + count
 */
export function collapseRepeatedChords(
  chords: readonly string[],
): CollapsedChord[] {
  if (chords.length === 0) return [];

  const result: CollapsedChord[] = [];
  let current = chords[0];
  let count = 1;

  for (let i = 1; i < chords.length; i++) {
    if (chords[i] === current) {
      count++;
    } else {
      result.push({ symbol: current, count });
      current = chords[i];
      count = 1;
    }
  }
  result.push({ symbol: current, count });

  return result;
}
