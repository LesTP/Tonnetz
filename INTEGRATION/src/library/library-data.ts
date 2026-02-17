/**
 * Library data — bundled progression entries.
 *
 * Phase 2a: Static array of LibraryEntry objects.
 * Content is placeholder — final entries will be curated from LIBRARY_CONTENT.md.
 *
 * To add a progression: append to the LIBRARY array below.
 * All chord symbols must parse via HC parseChordSymbol() (validated by tests).
 */

import type { LibraryEntry } from "./library-types.js";

export const LIBRARY: readonly LibraryEntry[] = [
  {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    composer: "Joseph Kosma",
    genre: "Jazz",
    harmonicFeature: "ii-V-I",
    comment:
      "Textbook ii-V-I in Bb major, then the same pattern in the relative minor (Gm).",
    tempo: 132,
    grid: "1/4",
    chords: [
      "Cm7", "Cm7", "Cm7", "Cm7",
      "F7", "F7", "F7", "F7",
      "Bbmaj7", "Bbmaj7", "Bbmaj7", "Bbmaj7",
      "Ebmaj7", "Ebmaj7", "Ebmaj7", "Ebmaj7",
      "Am7b5", "Am7b5", "Am7b5", "Am7b5",
      "D7", "D7", "D7", "D7",
      "Gm", "Gm", "Gm", "Gm",
      "Gm", "Gm", "Gm", "Gm",
    ],
  },
  {
    id: "canon-in-d",
    title: "Canon in D",
    composer: "Johann Pachelbel",
    genre: "Classical / Baroque",
    harmonicFeature: "Descending bass line",
    comment:
      "The most famous chord progression in Western music. I-V-vi-iii-IV-I-IV-V.",
    tempo: 66,
    grid: "1/4",
    chords: [
      "D", "D", "D", "D",
      "A", "A", "A", "A",
      "Bm", "Bm", "Bm", "Bm",
      "F#m", "F#m", "F#m", "F#m",
      "G", "G", "G", "G",
      "D", "D", "D", "D",
      "G", "G", "G", "G",
      "A", "A", "A", "A",
    ],
  },
  {
    id: "chord-forms-demo",
    title: "Chord Forms Demo",
    genre: "Reference / Educational",
    harmonicFeature: "Chord type showcase",
    comment:
      "Every supported chord type: triads, 7ths, dim7, m7b5, aug, and 6th.",
    tempo: 80,
    grid: "1/4",
    chords: [
      "Dm7", "Dm7", "Dm7", "Dm7",
      "G7", "G7", "G7", "G7",
      "Cmaj7", "Cmaj7", "Cmaj7", "Cmaj7",
      "Am7", "Am7", "Am7", "Am7",
      "Fm7b5", "Fm7b5", "Fm7b5", "Fm7b5",
      "Bb7", "Bb7", "Bb7", "Bb7",
      "Ebmaj7", "Ebmaj7", "Ebmaj7", "Ebmaj7",
      "Abdim7", "Abdim7", "Abdim7", "Abdim7",
      "Dbaug", "Dbaug", "Dbaug", "Dbaug",
      "Gb6", "Gb6", "Gb6", "Gb6",
      "Bm", "Bm", "Bm", "Bm",
      "E7", "E7", "E7", "E7",
    ],
  },
];

/** All unique genre tags in the library. */
export function getGenres(entries: readonly LibraryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.genre))].sort();
}

/** All unique harmonic feature tags in the library. */
export function getFeatures(entries: readonly LibraryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.harmonicFeature))].sort();
}
