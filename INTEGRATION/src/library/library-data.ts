/**
 * Library data — bundled progression entries.
 *
 * Phase 2a: Static array of LibraryEntry objects.
 * Content curated from LIBRARY_CONTENT.md.
 *
 * Duration model (POL-D17): each chord = 4 beats (one bar).
 * To add a progression: append to the LIBRARY array below.
 * All chord symbols must parse via HC parseChordSymbol().
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
    chords: [
      "Cm7", "F7", "Bbmaj7", "Ebmaj7",
      "Am7b5", "D7", "Gm", "Gm",
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
    chords: ["D", "A", "Bm", "F#m", "G", "D", "G", "A"],
  },
  {
    id: "chord-forms-demo",
    title: "Chord Forms Demo",
    genre: "Reference / Educational",
    harmonicFeature: "Chord type showcase",
    comment:
      "Every supported chord type: triads, 7ths, dim7, m7b5, aug, and 6th.",
    tempo: 80,
    chords: [
      "Dm7", "G7", "Cmaj7", "Am7",
      "Fm7b5", "Bb7", "Ebmaj7", "Abdim7",
      "Dbaug", "Gb6", "Bm", "E7",
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
