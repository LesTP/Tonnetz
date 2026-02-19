/**
 * Library types for the progression library.
 *
 * Phase 2a: Data model for bundled library entries.
 */

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
  /** Harmonic feature tags for filtering (supports multiple tags per entry). */
  readonly harmonicFeature: readonly string[];
  /** Explanatory comment about the harmonic content. */
  readonly comment: string;
  /** Tempo in BPM. */
  readonly tempo: number;
  /** Chord symbols — one per bar (each chord = 4 beats). */
  readonly chords: readonly string[];
}
