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
    id: "12-bar-blues",
    title: "12-Bar Blues",
    genre: "Blues",
    harmonicFeature: ["I-IV-V diatonic"],
    comment:
      "Foundation of blues, rock, and jazz. All three chords are dominant 7ths — in blues every chord IS the tonic of its moment.",
    tempo: 120,
    chords: [
      "A7", "A7", "A7", "A7",
      "D7", "D7", "A7", "A7",
      "E7", "D7", "A7", "E7",
    ],
  },
  {
    id: "adagio-g-minor",
    title: "Adagio in G Minor",
    composer: "Tomaso Albinoni / Remo Giazotto",
    genre: "Classical / Baroque",
    harmonicFeature: ["Minor key i-iv-V"],
    comment:
      "Textbook minor-key cycle: i-iv-V7-i with a bVI (Eb) providing the emotional peak before the final cadence.",
    tempo: 54,
    chords: ["Gm", "Cm", "D7", "Gm", "Eb", "Cm", "D7", "Gm"],
  },
  {
    id: "air-on-g-string",
    title: "Air on the G String",
    composer: "Johann Sebastian Bach",
    genre: "Classical / Baroque",
    harmonicFeature: ["Descending bass line"],
    comment:
      "Iconic descending bass line (C-B-A-G-F-E-F-G). Same bass pattern as Pachelbel\u2019s Canon \u2014 one of the most reused harmonic frameworks in Western music.",
    tempo: 56,
    chords: ["C", "G", "Am", "Em", "F", "C", "F", "G"],
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    composer: "Traditional / John Newton",
    genre: "Traditional / Folk",
    harmonicFeature: ["I-IV-V diatonic"],
    comment:
      "Three chords and the truth. I-IV-V with nothing else \u2014 the entire harmonic vocabulary is the three primary triads.",
    tempo: 80,
    chords: ["G", "C", "G", "G", "D", "G", "C", "G", "D", "G"],
  },
  {
    id: "blue-bossa",
    title: "Blue Bossa",
    composer: "Kenny Dorham",
    genre: "Jazz",
    harmonicFeature: ["Key center modulation"],
    comment:
      "Latin jazz: ii-V-i in C minor, then a sudden ii-V-I shift to Db major (down a half step), then back. A dramatic geographic leap on the Tonnetz.",
    tempo: 288,
    chords: [
      "Cm", "Cm", "Cm", "Cm", "Fm7", "Fm7", "Bb7", "Bb7",
      "Ebmaj7", "Ebmaj7", "Ebmaj7", "Ebmaj7", "Ebm", "Ebm", "Ab7", "Ab7",
      "Dbmaj7", "Dbmaj7", "Dbmaj7", "Dbmaj7", "Dm", "Dm", "G7", "G7",
      "Cm", "Cm", "Cm", "Cm", "Dm", "G7", "Cm", "Cm",
    ],
  },
  {
    id: "autumn-leaves",
    title: "Autumn Leaves",
    composer: "Joseph Kosma",
    genre: "Jazz",
    harmonicFeature: ["ii-V-I"],
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
    harmonicFeature: ["Descending bass line"],
    comment:
      "The most famous chord progression in Western music. I-V-vi-iii-IV-I-IV-V.",
      tempo: 66,
    chords: ["D", "A", "Bm", "F#m", "G", "D", "G", "A"],
  },
  {
    id: "chord-forms-demo",
    title: "Chord Forms Demo",
    genre: "Reference",
    harmonicFeature: ["Chord type showcase"],
    comment:
      "Every supported chord type: triads, 7ths, dim7, m7b5, aug, and 6th.",
    tempo: 80,
    chords: [
      "Dm7", "G7", "Cmaj7", "Am7",
      "Fm7b5", "Bb7", "Ebmaj7", "Abdim7",
      "Dbaug", "Gb6", "Bm", "E7",
    ],
  },
  {
    id: "clair-de-lune",
    title: "Clair de Lune",
    composer: "Claude Debussy",
    genre: "Classical / Baroque",
    harmonicFeature: ["Parallel motion", "Chromatic voice-leading"],
    comment:
      "Debussy\u2019s planing technique \u2014 chords moving in parallel motion, breaking classical voice-leading rules. Uniform directional movement on the Tonnetz.",
    tempo: 56,
    chords: ["Db", "Gb", "Db", "Bbm", "Gb", "Ab7", "Db", "Db"],
  },
  {
    id: "let-it-be",
    title: "Let It Be",
    composer: "The Beatles / Paul McCartney",
    genre: "Pop / Rock",
    harmonicFeature: ["I-V-vi-IV pop progression"],
    comment:
      "I-V-vi-IV \u2014 the most reused pop progression. On the Tonnetz, the C-G-Am-F path traces a compact rectangular loop through closely related triads.",
    tempo: 70,
    chords: ["C", "G", "Am", "F"],
  },
  {
    id: "doo-wop",
    title: "Doo-Wop Progression (Stand By Me)",
    composer: "Traditional / Ben E. King",
    genre: "Pop / Rock",
    harmonicFeature: ["I-V-vi-IV pop progression"],
    comment:
      "I-vi-IV-V \u2014 the \"50s progression.\" On the Tonnetz, the I-vi relationship is a single edge, making this the most compact major-minor oscillation.",
    tempo: 118,
    chords: ["C", "Am", "F", "G"],
  },
  {
    id: "giant-steps",
    title: "Giant Steps",
    composer: "John Coltrane",
    genre: "Jazz",
    harmonicFeature: ["Chromatic mediant / Coltrane changes"],
    comment:
      "Three key centers (B, G, Eb) related by major thirds. On the Tonnetz this traces a perfect equilateral triangle at the macro level.",
    tempo: 572,
    chords: [
      "Bmaj7", "Bmaj7", "D7", "D7", "Gmaj7", "Gmaj7", "Bb7", "Bb7",
      "Ebmaj7", "Ebmaj7", "Am7", "D7", "Gmaj7", "Gmaj7", "Bb7", "Bb7",
      "Ebmaj7", "Ebmaj7", "F#7", "F#7", "Bmaj7", "Bmaj7", "Fm7", "Bb7",
      "Ebmaj7", "Ebmaj7", "Am7", "D7", "Gmaj7", "C#m", "F#7", "Bmaj7",
    ],
  },
  {
    id: "girl-from-ipanema",
    title: "The Girl from Ipanema",
    composer: "Ant\u00f3nio Carlos Jobim",
    genre: "Jazz",
    harmonicFeature: ["Tritone substitution"],
    comment:
      "Bossa nova\u2019s signature tune. Gb7 is a tritone substitution for C7 (V), creating a chromatic descending bass line (G-G-Gb-F).",
    tempo: 138,
    chords: ["Fmaj7", "G7", "Gm7", "Gb7", "Fmaj7", "G7", "Gm7", "Gb7"],
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    genre: "Traditional / Folk",
    harmonicFeature: ["Modal / Dorian"],
    comment:
      "The Am-G alternation (i-bVII) creates a modal color predating the major/minor system. The E major (V) adds a leading tone.",
    tempo: 192,
    chords: [
      "Am", "Am", "G", "G", "Am", "Am", "E", "E",
      "Am", "Am", "G", "G", "Am", "E", "Am", "Am",
    ],
  },
  {
    id: "hallelujah",
    title: "Hallelujah",
    composer: "Leonard Cohen",
    genre: "Pop / Rock",
    harmonicFeature: ["Harmonic ambiguity"],
    comment:
      "\"The fourth, the fifth, the minor fall, the major lift\" \u2014 Cohen narrating his own chord progression. The song teaches music theory while performing it.",
    tempo: 56,
    chords: ["C", "Am", "C", "Am", "F", "G", "Am", "F", "G", "C"],
  },
  {
    id: "house-of-rising-sun",
    title: "House of the Rising Sun",
    genre: "Traditional / Folk",
    harmonicFeature: ["Mixolydian / modal mixture"],
    comment:
      "The D major (IV) creates a Dorian inflection — in natural minor it would be Dm. Am-C-D-F outlines a haunting minor-major ambiguity.",
    tempo: 80,
    chords: ["Am", "C", "D", "F", "Am", "C", "E", "E"],
  },
  {
    id: "misty",
    title: "Misty",
    composer: "Erroll Garner",
    genre: "Jazz",
    harmonicFeature: ["Key center modulation"],
    comment:
      "Lush ballad harmony. Ebmaj7-Bbm7-Eb7 is a I to ii-V of IV (Ab) \u2014 a textbook secondary dominant chain with smooth voice-leading.",
    tempo: 144,
    chords: [
      "Ebmaj7", "Ebmaj7", "Bbm7", "Eb7",
      "Abmaj7", "Abmaj7", "Abm", "Db7",
      "Ebmaj7", "Ebmaj7", "Cm7", "Cm7",
      "Fm7", "Fm7", "Bb7", "Bb7",
    ],
  },
  {
    id: "jesu-joy",
    title: "Jesu, Joy of Man's Desiring",
    composer: "Johann Sebastian Bach",
    genre: "Classical / Baroque",
    harmonicFeature: ["I-IV-V diatonic"],
    comment:
      "Diatonic stepwise motion through the key of G. Almost entirely I, IV, V, and vi with no chromatic surprises.",
    tempo: 72,
    chords: ["G", "C", "G", "D", "Em", "C", "D", "G"],
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    composer: "Ludwig van Beethoven",
    genre: "Classical / Baroque",
    harmonicFeature: ["I-IV-V diatonic"],
    comment:
      "Radical simplicity from the 9th Symphony\u2019s finale. Almost exclusively I and V, with a single IV chord providing the only departure.",
    tempo: 108,
    chords: ["C", "C", "G", "C", "C", "F", "C", "G", "C"],
  },
  {
    id: "prelude-e-minor",
    title: "Prelude in E Minor, Op. 28, No. 4",
    composer: "Fr\u00e9d\u00e9ric Chopin",
    genre: "Classical / Baroque",
    harmonicFeature: ["Descending bass line", "Chromatic voice-leading"],
    comment:
      "Chromatically descending inner voice (B-Bb-A-Ab-G-F#) while the melody holds still. On the Tonnetz, each step slides one node along the chromatic axis.",
    tempo: 52,
    chords: ["Em", "Em", "Am", "Am", "B7", "B7", "Em", "Em"],
  },
  {
    id: "rhythm-changes",
    title: "I Got Rhythm (Rhythm Changes)",
    composer: "George Gershwin",
    genre: "Jazz",
    harmonicFeature: ["Rhythm changes"],
    comment:
      "The second most important chord progression in jazz after the blues. Rapid I-vi-ii-V turnarounds and a chromatic iv (Ebm).",
    tempo: 336,
    chords: [
      "Bb", "Gm7", "Cm7", "F7", "Bb", "Gm7", "Cm7", "F7",
      "Bb", "Bb7", "Eb", "Ebm", "Bb", "F7", "Bb", "Bb",
    ],
  },
  {
    id: "scarborough-fair",
    title: "Scarborough Fair",
    genre: "Traditional / Folk",
    harmonicFeature: ["Modal / Dorian"],
    comment:
      "Pure Dorian mode \u2014 the natural 6th degree gives this melody its \"not quite minor\" quality. Avoids dominant function almost entirely.",
    tempo: 88,
    chords: ["Dm", "C", "Dm", "Dm", "F", "C", "Dm", "Dm"],
  },
  {
    id: "stairway-to-heaven",
    title: "Stairway to Heaven",
    composer: "Led Zeppelin",
    genre: "Pop / Rock",
    harmonicFeature: ["Descending bass line"],
    comment:
      "The intro\u2019s chromatic descending bass (A-G#-G-F#-F-E) over a sustained Am triad. Each bass note recontextualizes the harmony.",
    tempo: 72,
    chords: ["Am", "G", "F", "F", "Am", "G", "F", "E"],
  },
  {
    id: "tristan-chord",
    title: "Tristan Chord Sequence",
    composer: "Richard Wagner",
    genre: "Classical / Baroque",
    harmonicFeature: ["Harmonic ambiguity", "Chromatic voice-leading"],
    comment:
      "The opening of Tristan und Isolde: arguably the most analyzed four bars in music history. The \"Tristan chord\" resists tonal classification, pointing toward atonality.",
    tempo: 48,
    chords: ["Fm", "E7", "Dm", "E7", "Am"],
  },
  {
    id: "vse-idyot-po-planu",
    title: "\u0412\u0441\u0451 \u0438\u0434\u0451\u0442 \u043F\u043E \u043F\u043B\u0430\u043D\u0443",
    composer: "\u0413\u0440\u0430\u0436\u0434\u0430\u043D\u0441\u043A\u0430\u044F \u041E\u0431\u043E\u0440\u043E\u043D\u0430",
    genre: "Pop / Rock",
    harmonicFeature: ["Minor key i-iv-V"],
    comment:
      "Am-F-C-E (i-VI-III-V). Stark minor-key cycle with a bVI detour that adds weight before the dominant resolution.",
    tempo: 112,
    chords: ["Am", "F", "C", "E"],
  },
  {
    id: "yesterday",
    title: "Yesterday",
    composer: "The Beatles / Paul McCartney",
    genre: "Pop / Rock",
    harmonicFeature: ["Chromatic voice-leading"],
    comment:
      "The chromatic descending bass F-E-Eb-D creates the melancholy. Em7-A7-Dm borrows A7 from D minor \u2014 a secondary dominant (V/vi).",
    tempo: 96,
    chords: ["F", "Em7", "A7", "Dm", "Dm", "Bb", "C7", "F"],
  },
];

/** All unique genre tags in the library. */
export function getGenres(entries: readonly LibraryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.genre))].sort();
}

/** All unique harmonic feature tags in the library. */
export function getFeatures(entries: readonly LibraryEntry[]): string[] {
  return [...new Set(entries.flatMap((e) => e.harmonicFeature))].sort();
}
