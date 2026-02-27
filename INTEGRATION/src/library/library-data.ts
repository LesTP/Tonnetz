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
      "The most common chord progression in jazz, a cadential succession whose roots descend in fifths from the supertonic to the dominant to the tonic. The iim7–V7–Imaj7 voicing provides smooth voice leading: the third of one chord becomes the seventh of the next, and the seventh falls a half-step to become the third. It has been used for a hundred years and is a staple of virtually every type of popular music.<br><br><b>Other examples:</b><ul><li>\"Honeysuckle Rose\" (1928)</li><li>\"If I Fell\" (The Beatles)</li><li>\"I'd Really Love To See You Tonight\" (England Dan &amp; John Ford Coley, 1976)</li><li>\"It Never Rains In Southern California\" (Albert Hammond, 1972)</li><li>Bach — Well-Tempered Clavier, Book I, Prelude I, opening: I–ii–V–I</li></ul>",
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
      "The infamous three-chord Rock and Roll Progression is a staple of rock 'n' roll. The Rock Progression omitted the softer-sounding vi chord from the doo-wop changes to create a harder rock sound. Common variations include I-IV-V-I and I-IV-V-IV.<br><br><b>Other examples:</b><ul><li>\"Do You Love Me\" (Contours, 1962)</li><li>\"Mr. Jones\" (Counting Crows, 1993) — chorus</li><li>\"Love Me Do\" (The Beatles, 1964)</li><li>\"Sunshine On My Shoulders\" (John Denver, 1974)</li><li>\"Glory Days\" (Bruce Springsteen, 1985)</li><li>\"My Life\" (Billy Joel, 1979)</li></ul>",
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
      "A common chord progression popular across several genres. The vi-IV-I-V rotation was dubbed the sensitive female chord progression after Boston Globe columnist Marc Hirsh noticed it in Joan Osborne's \"One of Us.\" Both rotations are a variant of the doo-wop I-vi-IV-V progression.<br><br><b>Other examples:</b><ul><li>\"Forever Young\" (Alphaville)</li><li>\"Beast of Burden\" (The Rolling Stones)</li><li>\"Someone Like You\" (Adele) — chorus</li><li>\"Africa\" (Toto)</li><li>\"When I Come Around\" (Green Day)</li><li>vi-IV-I-V rotation: \"Poker Face\" (Lady Gaga), \"Zombie\" (The Cranberries), \"Stronger\" (Kelly Clarkson)</li></ul>",
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
      "The 50s progression is a chord progression and turnaround common in the 1950s and early '60s, particularly associated with doo-wop. The vi chord before IV prolongs the tonic by substitution and creates a bass line descending in thirds: I down to vi down to IV. The doo-wop progression has been a rock staple since the late 1950s.<br><br><b>Other examples:</b><ul><li>\"Earth Angel\" (The Penguins, 1954)</li><li>\"Duke of Earl\" (Gene Chandler, 1962)</li><li>\"Wonderful World\" (Sam Cooke, 1960)</li><li>\"Eternal Flame\" (The Bangles, 1989)</li><li>\"Happiness Is a Warm Gun\" (The Beatles) — chorus</li><li>\"Those Magic Changes\" (from Grease) — self-parody: \"C-C-C-C / A-A-A-A-minor / F-F-F-F / G-G-G-G-seven\"</li></ul>",
    tempo: 118,
    chords: ["C", "Am", "F", "G7"],
  },
  {
    id: "12-bar-blues",
    title: "Johnny B. Goode",
    composer: "Chuck Berry",
    genre: "Blues / Trad / Folk",
    harmonicFeature: ["12-Bar Blues"],
    comment:
      "One of the most popular chord progressions in popular music, based on the I-IV-V chords of a key. The dominant seventh chords on each degree fall in a grey area between the strong major chord and the somber minor chord. Mastery of the blues and rhythm changes are critical elements for building a jazz repertoire.<br><br><b>Standard 12-bar form (in C):</b><ul><li>Bars 1–4: C7 C7 C7 C7</li><li>Bars 5–8: F7 F7 C7 C7</li><li>Bars 9–12: G7 F7 C7 G7</li></ul><b>Other examples:</b><ul><li>\"Sweet Home Chicago\" (Robert Johnson, 1936)</li><li>\"Hound Dog\" (Elvis Presley)</li><li>\"What'd I Say\" (Ray Charles, 1959)</li><li>\"Folsom Prison Blues\" (Johnny Cash)</li><li>\"Ball and Biscuit\" (White Stripes)</li><li>\"Empty Bed Blues\" (Bessie Smith)</li></ul>",
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
      "Undoubtedly the most common and the strongest of all harmonic progressions, consisting of adjacent roots in ascending fourth or descending fifth relationship. Diatonic circle progressions use only chords from the diatonic scale. If there is one winning formula at the poppy end of popular music, it is those progressions whose roots follow a predetermined movement descending in intervals of a fifth.<br><br><b>Other examples:</b><ul><li>\"Autumn Leaves\" (1946) — Dm7 / G7 / Cmaj7 / Fmaj7 / Bm7b5 / E7 / Am7</li><li>\"The Shadow of Your Smile\" (1965)</li><li>\"Fly Me To The Moon\" (1954)</li><li>\"I Will Survive\" (1979)</li><li>vi-ii-V-I in Mozart's Sonata, K. 545</li></ul>",
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
      "The ragtime progression is a chain of secondary dominants — each dominant chord acquired its own dominant, which in turn acquired yet another dominant. The third and seventh of each chord descend by half-step to become the seventh and third of the next, creating two chromatic lines. It may be perceived as a harder, bouncier sounding progression than the diatonic vi-ii-V7-I.<br><br><b>Other examples:</b><ul><li>\"Hello! Ma Baby\" (Howard &amp; Emerson, 1899) — chorus</li><li>\"Charleston\" (James P. Johnson, 1923)</li><li>\"Doxy\" (Sonny Rollins, 1954)</li><li>\"Alice's Restaurant\" (Arlo Guthrie, 1967)</li><li>Liszt, Liebesträume (1850) — opening</li></ul>",
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
      "The Andalusian cadence is a term adopted from flamenco music for a chord progression comprising four chords descending stepwise — a i-♭VII-♭VI-V progression, otherwise known as the minor descending tetrachord. Traceable back to the Renaissance, its effective sonorities made it one of the most popular progressions in classical music. Despite the name it is not a true cadence; it is most often used as an ostinato.<br><br><b>Other examples:</b><ul><li>\"Runaway\" (Del Shannon, 1961)</li><li>\"Hit The Road Jack\" (Ray Charles, 1961)</li><li>\"Good Vibrations\" (The Beach Boys, 1966)</li><li>\"Sultans Of Swing\" (Dire Straits, 1979)</li><li>\"California Dreamin'\" (The Mamas & the Papas, 1965) — reordered: i-♭VI-♭VII-V</li><li>\"Comfortably Numb\" (Pink Floyd, 1979) — altered: i-♭VII-♭VI-iv</li><li>Flamenco keys: por arriba (Am-G-F-E), por medio (Dm-C-B♭-A)</li></ul>",
    tempo: 150,
    chords: ["Am", "G", "F", "E"],
  },
  {
    id: "lament-bass",
    title: "Greensleeves",
    genre: "Blues / Trad / Folk",
    harmonicFeature: ["Lament Bass", "Passamezzo antico"],
    comment:
      "The passamezzo antico was a ground bass popular during the Italian Renaissance. The romanesca is a variant where the first chord is III. La Folia is one of the oldest European musical themes — over three centuries, more than 150 composers have used it.<br><br><b>Forms:</b><ul><li>Passamezzo antico: i-VII-i-V / III-VII-i-V-i</li><li>La Folia: i-V-i-VII / III-VII-i-V (16-bar form)</li><li>Romanesca: III-VII-i-V variant</li></ul><b>Other examples:</b><ul><li>\"Greensleeves\" — refrain follows the romanesca; verses follow the passamezzo antico</li><li>\"Before He Cheats\" (Carrie Underwood, 2006) — passamezzo antico variant</li><li>\"Stairway to Heaven\" (Led Zeppelin) — \"essentially a variant of the passamezzo antico progression\"</li><li>La Folia composers: Lully (1672), Corelli (1700), Vivaldi (1705), Bach (1742), Rachmaninov (1931)</li><li>\"Lamento della Ninfa\" (Monteverdi, 1638) — earliest noted use of descending tetrachord with triad chords</li></ul>",
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
      "Ascending bass line progressions move the bass notes higher, typically following 1-♯1-2-♯2 patterns. The I-♯I°7-ii7-V \"diminished cliché\" forms a 1-♯1-2 ascending chromatic bass line and was used to write numerous 1920s and 1930s ballads. Scott Joplin and other ragtime writers frequently used the IV-♯IV°-V7 progression to brighten their songs.<br><br><b>Other examples:</b><ul><li>\"Like A Rolling Stone\" (Bob Dylan, 1965) — diatonic 1-2-3-4-5 bass: C / Dm / Em / F / G</li><li>\"Stormy Weather\" (1933) — definitive diminished cliché</li><li>\"Lean On Me\" (Bill Withers, 1972)</li><li>\"Jingle Bell Rock\" (Bobby Helms, 1957)</li><li>\"Bennie And The Jets\" (Elton John, 1974)</li></ul>",
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
      "The descending minor cliché (vi-vi(M7)-vi7-vi6) is often used to provide a feeling of movement when a chord is sustained. Bass descends chromatically: A-G♯-G-F♯. Adding declining bass lines to minor cliché progressions creates even more interesting textures.<br><br><b>Other examples:</b><ul><li>\"Stairway To Heaven\" (Led Zeppelin, 1972)</li><li>\"Time In A Bottle\" (1973)</li><li>\"Michelle\" (The Beatles, 1966) — bridge</li><li>\"Piano Man\" (Billy Joel, 1974)</li><li>\"Whiter Shade of Pale\" (1967)</li><li>Pachelbel Canon in D — ground bass with descending bass D-C♯-B-A-G-F♯-G-A</li></ul>",
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
      "The Andalusian cadence is the primary expression of the Aeolian descent — the same progression as the Descending Tetrachord, but emphasising the modal rather than bass-line perspective. The bass descends stepwise through a Phrygian tetrachord (A-G-F-E). The i-♭VII-♭VI-♭VII variant avoids dominant function entirely.<br><br><b>Other examples:</b><ul><li>See Descending Tetrachord entry for full list</li><li>i-♭VII-♭VI-♭VII variant avoids the dominant V chord entirely</li></ul>",
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
      "A double tonic is a chord progression consisting of a regular back-and-forth motion between two chords. It is extremely common in African music, Asian music, and European music. Double tonic patterns may repeat open-endedly, though they are often closed through a tonic close or varied through a binary scheme ending on the dominant then tonic.<br><br><b>Other examples:</b><ul><li>\"My Sweet Lord\" (George Harrison, 1970) — relative minor vamp: C / Am</li><li>\"Monday, Monday\" (Mamas & Papas, 1966) — suspension vamp: C / Csus4</li><li>\"Sumer is Icumen in\" (medieval) — double tonic beginning on lower note</li><li>\"(Ghost) Riders In The Sky\" (1961), \"It Won't Be Long\" (Beatles, 1963), \"El Condor Pasa\" (Simon & Garfunkel, 1970), \"I'm On Fire\" (Springsteen, 1985) — Am-C displacement vamp</li></ul>",
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
      "The I-♭VII-IV Classic Rock Progression follows the Circle of Fifths movement and the chords are usually played without embellishment. The main characteristic is the use of borrowed chords from another key, in particular the ♭III, ♭VI, or ♭VII chords to create an overall blues feel.<br><br><b>Common variations:</b><ul><li>♭VII-IV-I: D-A-E</li><li>I-IV-♭VII-IV: E-A-D-A</li><li>I-♭III-IV-I: E-G-A-E</li><li>I-♭VII: E-D</li></ul><b>Other examples:</b><ul><li>\"More Than A Feeling\" (Boston, 1976)</li><li>\"You Got It\" (Roy Orbison, 1989)</li></ul>",
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
      "Switching the subdominant from major to minor before returning to I — the IV→iv→I motion. This idea dates back most famously to Cole Porter's \"Every Time We Say Goodbye,\" where the lyric <em>how strange the change from major to minor</em> narrates the chord itself. The ♭VII7 chord, borrowed from the parallel minor, can also resolve to I.<br><br><b>Other examples:</b><ul><li>\"Every Time We Say Goodbye\" (Cole Porter)</li><li>\"If I Fell\" (The Beatles)</li><li>\"My Romance\" — measures 9 and 11 (backdoor progression)</li><li>\"There Will Never Be Another You\" — measures 10 and 28</li><li>Minor plagal cadence: iv7→I or ♭VII7→I (the backdoor progression)</li></ul>",
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
      "The harmonic use of the chromatic third relation originated in the Romantic era and may occur on any structural level. Precisely because of the equidistancy, the roots of three chords a major third apart can produce a destabilizing effect; the identity of the tonal center can only be determined by the closure of the composition. On the circle of fifths, three key centers a major third apart form an equilateral triangle; there are only four unique thirds cycles.<br><br><b>Other examples:</b><ul><li>\"Giant Steps\" (John Coltrane, 1960) — three key centers B, G, E♭</li><li>\"Countdown\" (John Coltrane) — reharmonization of \"Tune Up\"</li><li>See also Coltrane Changes for the systematic substitution method</li></ul>",
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
      "The Coltrane changes use substitute chords over common jazz progressions, with root movement by major thirds creating an augmented triad of key centers (thus the \"giant steps\"). Slonimsky's Thesaurus of Scales and Melodic Patterns (1947) contains the first half of Giant Steps in its preface. The bridge of \"Have You Met Miss Jones?\" (1937) may have inspired the innovation.<br><br><b>Other examples:</b><ul><li>\"Countdown\" — reharmonization of Miles Davis's \"Tune Up\"</li><li>\"Lazy Bird\" — two tonal centers a major third apart</li><li>\"26-2\" — reharmonization of Charlie Parker's \"Confirmation\"</li><li>\"Satellite\" — based on \"How High the Moon\"</li><li>\"Body and Soul\" — Coltrane's arrangement (bridge)</li></ul>",
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
      "The ♭II7 substitutes for V7 because both share the same tritone (in C: G7 contains B–F, D♭7 contains F–C♭/B). Performing this substitution (Dm7–G7–Cmaj7 becomes Dm7–D♭7–Cmaj7) creates smooth chromatic root descent: D→D♭→C. The tritone was historically known as <em>diabolus in musica</em> and was banned by the church for centuries.<br><br><b>Other examples:</b><ul><li>I-vi-ii-V with tritone on vi and V: C–E♭7–D7–D♭7</li><li>I-vi-ii-V with tritone on every chord but I: C–E♭7–A♭M7–D♭7</li><li>\"Lazy Bird\" uses IV-♭VII-I (backdoor) together with tritone substitution</li><li>Bird Blues uses tritone substitution of dominant chords leading by half-step</li></ul>",
    tempo: 176,
    chords: ["Dm7", "Db7", "Cmaj7"],
  },
  {
    id: "backdoor-progression",
    title: "Cherokee",
    genre: "Jazz",
    harmonicFeature: ["Backdoor Progression"],
    comment:
      "The backdoor progression (iv7→♭VII7→I) is nicknamed the backdoor ii-V because it arrives at the tonic through an unexpected route — the normal ii-V7-I being the \"front door.\" The ♭VII7, a pivot chord borrowed from the parallel minor, can resolve to I and is considered a bluesy cadence. It is commonly preceded by IV going to iv, then ♭VII7, then I.<br><br><b>Other examples:</b><ul><li>\"Cherokee\" — measures 7–8 of the A section</li><li>\"My Romance\" — measures 9 and 11</li><li>\"There Will Never Be Another You\" — measures 10 and 28</li><li>\"In My Life\" (The Beatles)</li><li>\"Lazy Bird\" (Coltrane) — IV-♭VII-I used repeatedly</li></ul>",
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
      "A turnaround is a passage at the end of a section that leads back to the beginning, typically starting on I and ending on V7 (or ♭II7 as dominant substitute). The stock jazz-blues turnaround is I7-VI7-ii7-V7 — if there is one turnaround that has to become second nature, this is it. The I-vi-ii-V may be transformed through chord substitutions: replacing vi and ii with dominants gives I-VI7-II7-V7 (the Ragtime progression).<br><br><b>Turnaround types (in C):</b><ul><li>Folk: C / G7</li><li>Jazz: C / Dm7 / G7</li><li>Standard: C / Am7 / Dm7 / G7</li><li>Ragtime: C / A7 / D7 / G7</li><li>Diminished cliché: C / C#o7 / Dm7 / G7</li><li>Circle: Em7 / Am7 / Dm7 / G7</li><li>Circle (dominant): E7 / A7 / D7 / G7</li><li>Dameron: Cmaj7 / EbMaj7 / AbMaj7 / DbMaj7</li><li>Henderson: C7 / A7 / Gb7 / Eb7</li></ul><b>Other examples:</b><ul><li>\"Heart and Soul\" (1938) — standard I-vi-ii-V turnaround</li><li>V-IV-I blues turnaround (e.g. in A: E7-D7-A7-E7)</li><li>Tadd Dameron: I-♭III-♭VI-♭II7 (Cmaj7-E♭Maj7-A♭Maj7-D♭Maj7)</li><li>Joe Henderson's \"Isotope\" (1964): I7-VI7-♭V7-♭III7</li></ul>",
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
      "Rhythm changes refers to the chord progression from Gershwin's \"I Got Rhythm,\" a thirty-two-bar AABA form and one of the most common vehicles for jazz improvisation. The bridge consists of dominant sevenths following the circle of fifths — known as the Sears Roebuck bridge. The A and B sections were often used separately: Parker's \"Scrapple from the Apple\" uses \"Honeysuckle Rose\" for the A but Rhythm's III7-VI7-II7-V7 bridge.<br><br><b>Other examples:</b><ul><li>\"Cotton Tail\" (Duke Ellington, 1940)</li><li>\"Anthropology\" (Charlie Parker / Dizzy Gillespie)</li><li>\"Oleo\" (Sonny Rollins)</li><li>\"Rhythm-a-Ning\" (Thelonious Monk)</li><li>\"Straighten Up and Fly Right\" (Nat King Cole)</li><li>\"Meet the Flintstones\" (Hoyt Curtin)</li></ul>",
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
      "A modulating sequence (rosalia) begins in the home key and moves diatonically or chromatically, with harmonic function subordinate to the sequential motion. The sequence may end at a point suggesting a new tonality, and the composition continues naturally in that key. In \"All The Things You Are,\" the A section uses a common-tone chord to modulate to a new key and repeats this three more times.<br><br><b>Other examples:</b><ul><li>\"All The Things You Are\" (1939) — four modulations using common-tone chords</li><li>Circle of fifths traversal: C-G-D-A-E-B-F♯-C♯-G♯-D♯-A♯(B♭)-F-C</li></ul>",
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
      "The Neapolitan chord prepares the dominant, substituting for IV or ii, and is found far more often in minor keys. Named for the Neapolitan School (Scarlatti, Pergolesi, Paisiello, Cimarosa), it was already established by the late 17th century. It is called a \"sixth\" because in first inversion the interval between the bass note and the root is a minor sixth.<br><br><b>Voice leading:</b> The ♭II root moves down by a diminished third to the leading tone, the bass rises by step to the dominant root, and the fifth resolves down a semitone.<br><br><b>Classical examples:</b><ul><li>Vivaldi, <em>The Four Seasons</em>, \"Summer\" — Neapolitan-sixth descent</li><li>J.S. Bach, <em>St Matthew Passion</em>, No. 19</li><li>Beethoven, <em>Moonlight Sonata</em>, Op. 27 No. 2 — opening bars</li></ul><b>Pop/rock examples:</b><ul><li>\"Because\" (The Beatles)</li><li>\"Do You Want to Know a Secret\" (The Beatles)</li><li>\"Mother's Little Helper\" (The Rolling Stones)</li><li>\"Ne me quitte pas\" (Jacques Brel)</li></ul>",
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
      "The ♭VI-♭VII-I cadence approaches the tonic from below via two borrowed major chords, producing a bright, triumphant resolution that sidesteps dominant function entirely. Unlike the authentic cadence (V-I) which resolves by descending fifth, and unlike the plagal cadence (IV-I) which resolves by descending fourth, the Mario cadence resolves by ascending whole step — giving it a distinctive sense of arrival through upward momentum. Named for its prominent use in Super Mario Bros. music (Koji Kondo).<br><br><b>Other examples:</b><ul><li>\"King of the World\" (Steely Dan)</li><li>\"Thanksgiving\" (Vince Guaraldi)</li><li>\"SOS\" (ABBA)</li><li>\"All I Wanna Do\" (Sheryl Crow)</li></ul>",
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
    genre: "Blues / Trad / Folk",
    harmonicFeature: ["I-IV-V"],
    comment:
      "Three chords and the truth. The entire harmonic vocabulary is the three primary triads — I, IV, and V — with nothing else. This simplicity makes it one of the purest demonstrations of tonal harmony on the Tonnetz: three adjacent triangles forming a compact cluster.<br><br><b>Harmonic structure:</b><ul><li>I (G) — tonic, home base</li><li>IV (C) — subdominant, departure</li><li>V (D) — dominant, tension and return</li></ul><b>Other examples:</b><ul><li>\"Swing Low, Sweet Chariot\" — same I-IV-V framework</li><li>\"When the Saints Go Marching In\"</li><li>\"Oh! Susanna\" (Stephen Foster)</li><li>\"Home on the Range\"</li></ul>",
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
    genre: "Blues / Trad / Folk",
    harmonicFeature: ["Aeolian Descent"],
    comment:
      "The D major chord (IV) creates a Dorian inflection — in natural minor (Aeolian) it would be Dm. The progression Am-C-D-F outlines a haunting minor-major ambiguity that defines the song's character. On the Tonnetz, the raised 6th degree (F# in D major vs F♮ in Dm) shifts the triangle position, visualizing the modal colour change.<br><br><b>Harmonic analysis (in Am):</b><ul><li>Am (i) → C (III) — relative major, brief brightness</li><li>D (IV) → F (VI) — Dorian IV instead of natural minor iv</li><li>Am (i) → C (III) → E (V) — cadential return via dominant</li></ul><b>Other examples:</b><ul><li>\"Stairway to Heaven\" (Led Zeppelin) — similar Am arpeggiation with Dorian inflection</li><li>\"All Along the Watchtower\" (Bob Dylan / Jimi Hendrix) — Am-G-F-G minor descent</li><li>\"Jolene\" (Dolly Parton) — Am-C-G-Am Aeolian</li></ul>",
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
    genre: "Blues / Trad / Folk",
    harmonicFeature: ["Dorian Vamp"],
    comment:
      "Pure Dorian mode — the natural 6th degree (B♮ in D Dorian, vs B♭ in D natural minor) gives this melody its distinctive not-quite-minor quality. The progression avoids dominant function almost entirely, hovering between Dm and its upper neighbour chords without ever resolving via a traditional V-i cadence.<br><br><b>Modal characteristics:</b><ul><li>Dm (i) — Dorian tonic, darker than major but brighter than Aeolian</li><li>C (♭VII) — the characteristic Dorian chord, a whole step below tonic</li><li>F (III) — relative major, provides momentary brightness</li><li>No A or A7 (V) — dominant function deliberately absent</li></ul><b>Other examples:</b><ul><li>\"Eleanor Rigby\" (The Beatles) — Em Dorian vamp</li><li>\"Oye Como Va\" (Santana / Tito Puente) — Am Dorian two-chord vamp</li><li>\"So What\" (Miles Davis) — D Dorian, the quintessential modal jazz piece</li></ul>",
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
