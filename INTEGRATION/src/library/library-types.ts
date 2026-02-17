/**
 * Library types for the progression library.
 *
 * Phase 2a: Data model for bundled library entries.
 */

import type { GridValue } from "persistence-data";

/** A single progression library entry with metadata. */
export interface LibraryEntry {
  /** Unique identifier (slug-style, e.g., "autumn-leaves"). */
  readonly id: string;
  /** Display title. */
  readonly title: string;
  /** Composer or source (optional). */
  readonly composer?: string;
  /** Genre tag for filtering. */
  readonly genre: string;
  /** Harmonic feature tag for filtering. */
  readonly harmonicFeature: string;
  /** Explanatory comment about the harmonic content. */
  readonly comment: string;
  /** Tempo in BPM. */
  readonly tempo: number;
  /** Grid value for beat conversion. */
  readonly grid: GridValue;
  /** Chord symbols (one per grid slot, repeated for duration). */
  readonly chords: readonly string[];
}
