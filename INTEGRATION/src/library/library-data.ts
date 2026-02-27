/**
 * Library data — bundled progression entries.
 *
 * Content curated from prog names.md master list.
 *
 * Duration model (POL-D17): each chord = 4 beats (one bar).
 * To add a progression: append to the LIBRARY array below.
 * All chord symbols must parse via HC parseChordSymbol().
 */

import type { LibraryEntry } from "./library-types.js";

export const LIBRARY: readonly LibraryEntry[] = [
  {
    id: "ii-v-i",
    title: "Satin Doll",
    composer: "Duke Ellington",
    genre: "Jazz",
    harmonicFeature: ["ii-V-I"],
    comment:
      "The most common chord progression in jazz \u2014 roots descend in fifths from supertonic through dominant to tonic. The iim7\u2013V7\u2013Imaj7 voicing provides smooth voice leading: the third of one chord becomes the seventh of the next.",
    tempo: 120,
    chords: ["Dm7", "G7", "Cmaj7"],
  },
  {
    id: "i-iv-v",
    title: "Twist And Shout",
    composer: "The Beatles",
    genre: "Pop / Rock",
    harmonicFeature: ["I-IV-V"],
    comment:
      "The infamous three-chord Rock and Roll Progression. It omitted the softer-sounding vi chord from the doo-wop changes to create a harder rock sound.",
    tempo: 130,
    chords: ["C", "F", "G"],
  },
  {
    id: "i-v-vi-iv",
    title: "Let It Be",
    composer: "The Beatles",
    genre: "Pop / Rock",
    harmonicFeature: ["I-V-vi-IV"],
    comment:
      "A common chord progression popular across several genres. The vi-IV-I-V rotation was dubbed the sensitive female chord progression. Both rotations are a variant of the doo-wop I-vi-IV-V.",
    tempo: 70,
    chords: ["C", "G", "Am", "F"],
  },
  {
    id: "doo-wop",
    title: "Stand by Me",
    composer: "Ben E. King",
    genre: "Pop / Rock",
    harmonicFeature: ["I-vi-IV-V"],
    comment:
      "The 50s progression, common in the 1950s and early \u201960s, particularly associated with doo-wop. The vi chord before IV prolongs the tonic by substitution and creates a bass line descending in thirds.",
    tempo: 118,
    chords: ["C", "Am", "F", "G7"],
  },
  {
    id: "12-bar-blues",
    title: "Johnny B. Goode",
    composer: "Chuck Berry",
    genre: "Blues",
    harmonicFeature: ["12-Bar Blues"],
    comment:
      "One of the most popular chord progressions in popular music, based on the I-IV-V chords of a key. The dominant seventh chords on each degree fall in a grey area between the strong major chord and the somber minor chord.",
    tempo: 168,
    chords: [
      "C7", "C7", "C7", "C7",
      "F7", "F7", "C7", "C7",
      "G7", "F7", "C7", "G7",
    ],
  },
  {
    id: "descending-fifths",
    title: "All The Things You Are",
    composer: "Jerome Kern",
    genre: "Jazz",
    harmonicFeature: ["Descending Fifths Chain"],
    comment:
      "Undoubtedly the most common and the strongest of all harmonic progressions, consisting of adjacent roots in ascending fourth or descending fifth relationship.",
    tempo: 132,
    chords: [
      "Am7", "Dm7", "G7", "Cmaj7",
      "Fmaj7", "B7", "Emaj7",
    ],
  },
  {
    id: "circle-of-fifths-dominants",
    title: "Sweet Georgia Brown",
    composer: "Bernie and Pinkard",
    genre: "Jazz",
    harmonicFeature: ["Circle of Fifths with Dominants"],
    comment:
      "The ragtime progression is a chain of secondary dominants \u2014 each dominant chord acquired its own dominant, which in turn acquired yet another dominant. The third and seventh descend by half-step creating two chromatic lines.",
    tempo: 160,
    chords: ["E7", "A7", "D7", "G7", "C"],
  },
  {
    id: "descending-tetrachord",
    title: "Walk, Don\u2019t Run",
    composer: "The Ventures",
    genre: "Pop / Rock",
    harmonicFeature: ["Descending Tetrachord"],
    comment:
      "The Andalusian cadence \u2014 four chords descending stepwise (i-\u266dVII-\u266dVI-V), otherwise known as the minor descending tetrachord. Traceable back to the Renaissance, it is most often used as an ostinato.",
    tempo: 150,
    chords: ["Am", "G", "F", "E"],
  },
  {
    id: "lament-bass",
    title: "Greensleeves",
    genre: "Traditional / Folk",
    harmonicFeature: ["Lament Bass", "Passamezzo antico"],
    comment:
      "The passamezzo antico was a ground bass popular during the Italian Renaissance. La Folia is one of the oldest European musical themes \u2014 over three centuries, more than 150 composers have used it.",
    tempo: 88,
    chords: [
      "Am", "E7", "Am", "G",
      "C", "G", "Am", "E7",
      "Am", "E7", "Am", "G",
      "C", "G", "Am", "Am",
    ],
  },
  {
    id: "ascending-chromatic-bass",
    title: "Ain\u2019t Misbehavin\u2019",
    composer: "Fats Waller",
    genre: "Jazz",
    harmonicFeature: ["Ascending Chromatic Bass"],
    comment:
      "Ascending bass line progressions move the bass notes higher, typically following 1-\u266f1-2-\u266f2 patterns. The diminished clich\u00e9 was used extensively in 1920s\u20131930s ballads.",
    tempo: 104,
    chords: [
      "C", "Cdim7", "Dm7", "Ddim7",
      "Em7", "E7", "F6", "Fm6",
    ],
  },
  {
    id: "descending-chromatic-bass",
    title: "My Funny Valentine",
    genre: "Jazz",
    harmonicFeature: ["Descending Chromatic Bass"],
    comment:
      "The descending minor clich\u00e9 (vi-vi(M7)-vi7-vi6) provides a feeling of movement when a chord is sustained. Bass descends chromatically: A-G\u266f-G-F\u266f.",
    tempo: 72,
    chords: ["Am", "Ammaj7", "Am7", "Am6"],
  },
  {
    id: "aeolian-descent",
    title: "Hit The Road Jack",
    composer: "Ray Charles",
    genre: "Pop / Rock",
    harmonicFeature: ["Aeolian Descent"],
    comment:
      "The Andalusian cadence emphasising the modal rather than bass-line perspective. The bass descends stepwise through a Phrygian tetrachord (A-G-F-E). The i-\u266dVII-\u266dVI-\u266dVII variant avoids dominant function entirely.",
    tempo: 108,
    chords: ["Am", "G", "F", "E"],
  },
  {
    id: "dorian-vamp",
    title: "On Broadway",
    composer: "The Drifters",
    genre: "Pop / Rock",
    harmonicFeature: ["Dorian Vamp"],
    comment:
      "A double tonic is a regular back-and-forth motion between two chords, extremely common in African, Asian, and European music. Patterns may repeat open-endedly or close through a tonic cadence.",
    tempo: 116,
    chords: ["C", "Bb", "C", "Bb"],
  },
  {
    id: "mixolydian-rock",
    title: "Gloria",
    composer: "Shadows Of Knight",
    genre: "Pop / Rock",
    harmonicFeature: ["Mixolydian Rock"],
    comment:
      "The I-\u266dVII-IV Classic Rock Progression follows the Circle of Fifths movement. The main characteristic is the use of borrowed chords from the parallel minor to create an overall blues feel.",
    tempo: 132,
    chords: ["E", "D", "A"],
  },
  {
    id: "modal-interchange",
    title: "In My Life",
    composer: "The Beatles",
    genre: "Pop / Rock",
    harmonicFeature: ["Modal Interchange"],
    comment:
      "Switching the subdominant from major to minor before returning to I \u2014 the IV\u2192iv\u2192I motion. This idea dates back to Cole Porter\u2019s \u201cEvery Time We Say Goodbye,\u201d where the lyric narrates the chord itself.",
    tempo: 108,
    chords: ["A", "E", "F#m", "D", "Dm", "A"],
  },
  {
    id: "chromatic-mediant",
    title: "Have You Met Miss Jones?",
    composer: "Rodgers and Hart",
    genre: "Jazz",
    harmonicFeature: ["Chromatic Mediant Shift"],
    comment:
      "The chromatic third relation originated in the Romantic era. Three key centers a major third apart form an equilateral triangle on the circle of fifths; there are only four unique thirds cycles.",
    tempo: 160,
    chords: [
      "Bbmaj7", "Bbmaj7", "Abm7", "Db7",
      "Gbmaj7", "Gbmaj7", "Em7", "A7",
      "Dmaj7", "Dmaj7", "Abm7", "Db7",
      "Gbmaj7", "Gbmaj7", "Gm7", "C7",
    ],
  },
  {
    id: "coltrane-changes",
    title: "Giant Steps",
    composer: "John Coltrane",
    genre: "Jazz",
    harmonicFeature: ["Coltrane Changes"],
    comment:
      "Root movement by major thirds creating an augmented triad of key centers (B-G-Eb). Slonimsky\u2019s Thesaurus of Scales (1947) contains the first half of Giant Steps in its preface.",
    tempo: 286,
    chords: [
      "Bmaj7", "D7", "Gmaj7", "Bb7",
      "Ebmaj7", "Ebmaj7", "Am7", "D7",
      "Gmaj7", "Bb7", "Ebmaj7", "F#7",
      "Bmaj7", "Bmaj7",
      "Fm7", "Bb7", "Ebmaj7", "Ebmaj7",
      "Am7", "D7", "Gmaj7", "Gmaj7",
      "C#m7", "F#7", "Bmaj7", "Bmaj7",
      "Fm7", "Bb7", "Ebmaj7", "Ebmaj7",
      "C#m7", "F#7",
    ],
  },
  {
    id: "omnibus",
    title: "Omnibus Progression",
    composer: "Franz Schubert",
    genre: "Classical",
    harmonicFeature: ["Omnibus Progression"],
    comment:
      "Chromatic lines moving in opposite directions \u2014 also known as chromatic wedge progressions. The bass traverses a whole chromatic octave. The pattern divides the octave into four equal parts.",
    tempo: 60,
    chords: ["C", "G7", "Bb7", "Dm", "Bb7", "G7", "C"],
  },
  {
    id: "tritone-substitution",
    title: "Lazy Bird",
    composer: "John Coltrane",
    genre: "Jazz",
    harmonicFeature: ["Tritone Substitution"],
    comment:
      "The \u266dII7 substitutes for V7 because both share the same tritone. Performing this substitution (Dm7\u2013G7\u2013Cmaj7 becomes Dm7\u2013Db7\u2013Cmaj7) creates smooth chromatic root descent: D\u2192Db\u2192C.",
    tempo: 176,
    chords: ["Dm7", "Db7", "Cmaj7"],
  },
  {
    id: "backdoor-progression",
    title: "Cherokee",
    genre: "Jazz",
    harmonicFeature: ["Backdoor Progression"],
    comment:
      "The backdoor progression (iv7\u2192\u266dVII7\u2192I) arrives at the tonic through an unexpected route \u2014 the normal ii-V7-I being the \u201cfront door.\u201d The \u266dVII7 is a pivot chord borrowed from the parallel minor.",
    tempo: 184,
    chords: ["Fm7", "Bb7", "Cmaj7"],
  },
  {
    id: "turnaround",
    title: "I Got Rhythm (Turnaround)",
    composer: "George Gershwin",
    genre: "Jazz",
    harmonicFeature: ["Turnaround"],
    comment:
      "A passage at the end of a section that leads back to the beginning. The stock jazz-blues turnaround is I7-VI7-ii7-V7 \u2014 if there is one turnaround that has to become second nature, this is it.",
    tempo: 176,
    chords: ["C", "Am7", "Dm7", "G7"],
  },
  {
    id: "rhythm-changes",
    title: "I Got Rhythm",
    composer: "George Gershwin",
    genre: "Jazz",
    harmonicFeature: ["Rhythm Changes"],
    comment:
      "Rhythm changes \u2014 a thirty-two-bar AABA form and one of the most common vehicles for jazz improvisation. The bridge consists of dominant sevenths following the circle of fifths (the Sears Roebuck bridge).",
    tempo: 200,
    chords: [
      "C", "Am7", "Dm7", "G7", "C", "Am7", "Dm7", "G7",
      "C", "C7", "F", "F#dim7", "C", "G7", "C", "C",
      "E7", "E7", "E7", "E7", "A7", "A7", "A7", "A7",
      "D7", "D7", "D7", "D7", "G7", "G7", "G7", "G7",
      "C", "Am7", "Dm7", "G7", "C", "Am7", "Dm7", "G7",
      "C", "C7", "F", "F#dim7", "C", "G7", "C", "C",
    ],
  },
  {
    id: "modulating-sequence",
    title: "All The Things You Are (Modulation)",
    composer: "Jerome Kern",
    genre: "Jazz",
    harmonicFeature: ["Modulating Sequence"],
    comment:
      "A modulating sequence (rosalia) begins in the home key and moves diatonically or chromatically. In this tune, the A section uses a common-tone chord to modulate to an entirely new key and repeats this three more times.",
    tempo: 132,
    chords: [
      "Am7", "Dm7", "G7", "Cmaj7",
      "Fmaj7", "B7", "Emaj7", "Emaj7",
      "Em7", "Am7", "D7", "Gmaj7",
      "Cmaj7", "F#7", "Bmaj7", "Bmaj7",
    ],
  },
  {
    id: "neapolitan-sixth",
    title: "Because",
    composer: "The Beatles",
    genre: "Pop / Rock",
    harmonicFeature: ["Neapolitan Sixth"],
    comment:
      "The Neapolitan chord prepares the dominant, substituting for IV or ii, and is found far more often in minor keys. The \u266dII root moves down by a diminished third to the leading tone.",
    tempo: 66,
    chords: [
      "C#m", "C#m", "D#m7b5", "G#7",
      "A", "C#m", "A7", "A7",
      "D", "Ddim7",
    ],
  },
  {
    id: "mario-cadence",
    title: "Lady Madonna",
    composer: "The Beatles",
    genre: "Pop / Rock",
    harmonicFeature: ["Mario Cadence"],
    comment:
      "The \u266dVI-\u266dVII-I cadence approaches the tonic from below via two borrowed major chords, producing a bright, triumphant resolution that sidesteps dominant function entirely. Named for its prominent use in Super Mario Bros. music.",
    tempo: 110,
    chords: [
      "A", "A", "D", "D",
      "A", "A", "D", "D",
      "A", "A", "D", "E",
      "F", "G", "A", "A",
    ],
  },
  {
    id: "adagio-g-minor",
    title: "Adagio in G Minor",
    composer: "Tomaso Albinoni / Remo Giazotto",
    genre: "Classical",
    harmonicFeature: ["Minor key i-iv-V"],
    comment:
      "Textbook minor-key cycle: i-iv-V7-i with a \u266dVI (E\u266d) providing the emotional peak before the final cadence.",
    tempo: 54,
    chords: ["Gm", "Cm", "D7", "Gm", "Eb", "Cm", "D7", "Gm"],
  },
  {
    id: "air-on-g-string",
    title: "Air on the G String",
    composer: "Johann Sebastian Bach",
    genre: "Classical",
    harmonicFeature: ["Descending Chromatic Bass"],
    comment:
      "Iconic descending bass line (C-B-A-G-F-E-F-G). Same bass pattern as Pachelbel\u2019s Canon \u2014 one of the most reused harmonic frameworks in Western music.",
    tempo: 56,
    chords: ["C", "G", "Am", "Em", "F", "C", "F", "G"],
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    genre: "Traditional / Folk",
    harmonicFeature: ["I-IV-V"],
    comment:
      "Three chords and the truth. I-IV-V with nothing else \u2014 the entire harmonic vocabulary is the three primary triads.",
    tempo: 80,
    chords: ["G", "C", "G", "G", "D", "G", "C", "G", "D", "G"],
  },
  {
    id: "canon-in-d",
    title: "Canon in D",
    composer: "Johann Pachelbel",
    genre: "Classical",
    harmonicFeature: ["Descending Chromatic Bass"],
    comment:
      "The most famous chord progression in Western music. I-V-vi-iii-IV-I-IV-V over a two-bar ground bass ostinato.",
    tempo: 66,
    chords: ["D", "A", "Bm", "F#m", "G", "D", "G", "A"],
  },
  {
    id: "clair-de-lune",
    title: "Clair de Lune",
    composer: "Claude Debussy",
    genre: "Classical",
    harmonicFeature: ["Chromatic Mediant Shift"],
    comment:
      "Debussy\u2019s planing technique \u2014 chords moving in parallel motion, breaking classical voice-leading rules. Uniform directional movement on the Tonnetz.",
    tempo: 56,
    chords: ["Db", "Gb", "Db", "Bbm", "Gb", "Ab7", "Db", "Db"],
  },
  {
    id: "house-of-rising-sun",
    title: "House of the Rising Sun",
    genre: "Traditional / Folk",
    harmonicFeature: ["Aeolian Descent"],
    comment:
      "The D major (IV) creates a Dorian inflection \u2014 in natural minor it would be Dm. Am-C-D-F outlines a haunting minor-major ambiguity.",
    tempo: 80,
    chords: ["Am", "C", "D", "F", "Am", "C", "E", "E"],
  },
  {
    id: "jesu-joy",
    title: "Jesu, Joy of Man\u2019s Desiring",
    composer: "Johann Sebastian Bach",
    genre: "Classical",
    harmonicFeature: ["I-IV-V", "Descending Fifths Chain"],
    comment:
      "Diatonic stepwise motion through the key of G. Almost entirely I, IV, V, and vi with no chromatic surprises.",
    tempo: 72,
    chords: ["G", "C", "G", "D", "Em", "C", "D", "G"],
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    composer: "Ludwig van Beethoven",
    genre: "Classical",
    harmonicFeature: ["I-IV-V"],
    comment:
      "Radical simplicity from the 9th Symphony\u2019s finale. Almost exclusively I and V, with a single IV chord providing the only departure.",
    tempo: 108,
    chords: ["C", "C", "G", "C", "C", "F", "C", "G", "C"],
  },
  {
    id: "prelude-e-minor",
    title: "Prelude in E Minor, Op. 28, No. 4",
    composer: "Fr\u00e9d\u00e9ric Chopin",
    genre: "Classical",
    harmonicFeature: ["Descending Chromatic Bass"],
    comment:
      "Chromatically descending inner voice (B-B\u266d-A-A\u266d-G-F\u266f) while the melody holds still. Each step slides one node along the chromatic axis.",
    tempo: 52,
    chords: ["Em", "Em", "Am", "Am", "B7", "B7", "Em", "Em"],
  },
  {
    id: "scarborough-fair",
    title: "Scarborough Fair",
    genre: "Traditional / Folk",
    harmonicFeature: ["Dorian Vamp"],
    comment:
      "Pure Dorian mode \u2014 the natural 6th degree gives this melody its not-quite-minor quality. Avoids dominant function almost entirely.",
    tempo: 88,
    chords: ["Dm", "C", "Dm", "Dm", "F", "C", "Dm", "Dm"],
  },
  {
    id: "tristan-chord",
    title: "Tristan Chord Sequence",
    composer: "Richard Wagner",
    genre: "Classical",
    harmonicFeature: ["Chromatic Mediant Shift"],
    comment:
      "The opening of Tristan und Isolde: arguably the most analyzed four bars in music history. The Tristan chord resists tonal classification, pointing toward atonality.",
    tempo: 48,
    chords: ["Fm", "E7", "Dm", "E7", "Am"],
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
