# Progression Library — Content Reference

28 curated progressions for the Tonnetz Interactive Harmonic Explorer.
This document is the authoritative content source for Phase 2a implementation.

**Chord symbol convention:** All symbols must parse through HC `parseChordSymbol()` after Phase 0b grammar expansion (dim7, m7b5) and input cleaning (slash stripping). Slash chords in the `chords[]` array are listed WITHOUT the bass note — input cleaning handles this at load time. Roman numeral analysis is display-only metadata (shown in the card comment).

**Grid convention:** `"1/4"` = quarter-note grid (1 beat per slot). Duration is encoded by repetition per PD-D2. A chord lasting 4 beats (one bar in 4/4) appears 4 times consecutively.

---

## Genre Index

| Genre | Entries |
|-------|---------|
| Classical / Baroque | 1, 2, 3, 4, 5, 25, 26, 27 |
| Traditional / Folk | 6, 7, 8, 9 |
| Blues | 10 |
| Jazz | 11, 12, 15, 16, 17, 18, 19 |
| Pop / Rock | 13, 14, 20, 21, 22, 23, 24 |
| Post-Punk | 28 |

## Harmonic Feature Index

| Feature | Entries |
|---------|---------|
| Descending bass line | 1, 3, 23, 25 |
| ii-V-I | 11, 16, 17 |
| I-IV-V diatonic | 4, 6, 10 |
| Modal / Dorian | 7, 9, 15 |
| Chromatic voice-leading | 13, 25, 26, 27 |
| Chromatic mediant / Coltrane changes | 17 |
| I-V-vi-IV pop progression | 14, 20 |
| Rhythm changes | 12 |
| Mixolydian / modal mixture | 8, 21 |
| Minor key i-iv-V | 5, 28 |
| Tritone substitution | 19 |
| Harmonic ambiguity | 24, 27 |
| Key center modulation | 16, 18 |
| Parallel motion | 26 |

---

## Entries 1–14

### 1. Air on the G String

**Composer:** Johann Sebastian Bach (1731)
**Key:** C major (simplified from D major original)
**Genre:** Classical / Baroque
**Harmonic feature:** Descending bass line
**Tempo:** 56 BPM
**Grid:** `"1/4"`

**Comment:** Iconic descending bass line (C-B-A-G-F-E-F-G). Same bass pattern as Pachelbel's Canon — one of the most reused harmonic frameworks in Western music. The original orchestral suite is in D; transposed here for lattice clarity.

**Roman:** I | V | vi | iii | IV | I | IV | V

**Chords:**
```
C C C C | G G G G | Am Am Am Am | Em Em Em Em | F F F F | C C C C | F F F F | G G G G
```

---

### 2. Jesu, Joy of Man's Desiring

**Composer:** Johann Sebastian Bach (1723)
**Key:** G major
**Genre:** Classical / Baroque
**Harmonic feature:** I-IV-V diatonic
**Tempo:** 72 BPM
**Grid:** `"1/4"`

**Comment:** Diatonic stepwise motion through the key of G. The 9/8 triplet melody floats over a simple chorale harmonization — almost entirely I, IV, V, and vi with no chromatic surprises. Pure diatonic voice-leading.

**Roman:** I | IV | I | V | vi | IV | V | I

**Chords:**
```
G G G G | C C C C | G G G G | D D D D | Em Em Em Em | C C C C | D D D D | G G G G
```

---

### 3. Canon in D

**Composer:** Johann Pachelbel (1680)
**Key:** D major
**Genre:** Classical / Baroque
**Harmonic feature:** Descending bass line
**Tempo:** 66 BPM
**Grid:** `"1/4"`

**Comment:** The most famous chord progression in Western music. Descending bass line (D-C#-B-A-G-F#-G-A) with the I-V-vi-iii-IV-I-IV-V pattern that reappears in countless pop songs — from "Let It Be" to "No Woman No Cry."

**Roman:** I | V | vi | iii | IV | I | IV | V

**Chords:**
```
D D D D | A A A A | Bm Bm Bm Bm | F#m F#m F#m F#m | G G G G | D D D D | G G G G | A A A A
```

---

### 4. Ode to Joy

**Composer:** Ludwig van Beethoven (1824)
**Key:** C major (simplified from D major original)
**Genre:** Classical / Baroque
**Harmonic feature:** I-IV-V diatonic
**Tempo:** 108 BPM
**Grid:** `"1/4"`

**Comment:** Radical simplicity from the 9th Symphony's finale. Almost exclusively I and V, with a single IV chord providing the only departure. Beethoven's point: universal joy needs no harmonic complexity. The melody does all the work.

**Roman:** I | I | V | I | I | IV | I | V | I

**Chords:**
```
C C C C | C C C C | G G G G | C C C C | C C C C | F F F F | C C C C | G G G G | C C C C
```

---

### 5. Adagio in G Minor

**Composer:** Tomaso Albinoni / Remo Giazotto (1958)
**Key:** G minor
**Genre:** Classical / Baroque
**Harmonic feature:** Minor key i-iv-V
**Tempo:** 54 BPM
**Grid:** `"1/4"`

**Comment:** Textbook minor-key harmonic cycle: i-iv-V7-i with a bVI (Eb) providing the emotional peak before the final cadence. Actually composed by Giazotto (1958) based on a fragment attributed to Albinoni — one of classical music's most successful misattributions.

**Roman:** i | iv | V7 | i | VI | iv | V7 | i

**Chords:**
```
Gm Gm Gm Gm | Cm Cm Cm Cm | D7 D7 D7 D7 | Gm Gm Gm Gm | Eb Eb Eb Eb | Cm Cm Cm Cm | D7 D7 D7 D7 | Gm Gm Gm Gm
```

---

### 6. Amazing Grace

**Composer:** Traditional / John Newton (1772)
**Key:** G major
**Genre:** Traditional / Folk
**Harmonic feature:** I-IV-V diatonic
**Tempo:** 80 BPM
**Grid:** `"1/4"`

**Comment:** Three chords and the truth. I-IV-V with nothing else — no vi, no ii, no chromatic passing. The entire harmonic vocabulary is the three primary triads. This is what I-IV-V sounds like when nothing gets in the way.

**Roman:** I | IV | I | I | V | I | IV | I | V | I

**Chords:**
```
G G G G | C C C C | G G G G | G G G G | D D D D | G G G G | C C C C | G G G G | D D D D | G G G G
```

---

### 7. Greensleeves

**Composer:** Traditional English (16th century)
**Key:** A minor
**Genre:** Traditional / Folk
**Harmonic feature:** Modal / Dorian
**Tempo:** 96 BPM
**Grid:** `"1/4"`

**Comment:** The alternation between Am and G (i and bVII) creates a modal color that predates the major/minor system. The E major (V) rather than Em adds a Picardy-like leading tone. Some versions use F# (Dorian 6th), reinforcing the modal ambiguity.

**Roman:** i | bVII | i | V | i | bVII | i-V | i

**Chords:**
```
Am Am Am Am | G G G G | Am Am Am Am | E E E E | Am Am Am Am | G G G G | Am Am E E | Am Am Am Am
```

---

### 8. House of the Rising Sun

**Composer:** Traditional American (arranged 1964)
**Key:** A minor
**Genre:** Traditional / Folk
**Harmonic feature:** Mixolydian / modal mixture
**Tempo:** 80 BPM
**Grid:** `"1/4"`

**Comment:** The D major chord (IV) is the tension — in natural minor it would be Dm, but the major IV creates a Dorian inflection. Combined with the arpeggiated 6/8 pattern, Am-C-D-F outlines a haunting minor-major ambiguity.

**Roman:** i | III | IV | VI | i | III | V | V

**Chords:**
```
Am Am Am Am | C C C C | D D D D | F F F F | Am Am Am Am | C C C C | E E E E | E E E E
```

---

### 9. Scarborough Fair

**Composer:** Traditional English
**Key:** D minor (Dorian)
**Genre:** Traditional / Folk
**Harmonic feature:** Modal / Dorian
**Tempo:** 88 BPM
**Grid:** `"1/4"`

**Comment:** Pure Dorian mode — the natural 6th degree gives this melody its characteristic "not quite minor" quality. The progression avoids dominant function almost entirely, hovering between i and bVII. Medieval modal harmony that predates tonal conventions.

**Roman:** i | bVII | i | i | bIII | bVII | i | i

**Chords:**
```
Dm Dm Dm Dm | C C C C | Dm Dm Dm Dm | Dm Dm Dm Dm | F F F F | C C C C | Dm Dm Dm Dm | Dm Dm Dm Dm
```

---

### 10. 12-Bar Blues

**Composer:** Traditional
**Key:** A
**Genre:** Blues
**Harmonic feature:** I-IV-V diatonic
**Tempo:** 120 BPM
**Grid:** `"1/4"`

**Comment:** Foundation of blues, rock, and jazz. All three chords are dominant 7ths — in classical theory this is "wrong" (only V should be dominant), but in blues every chord IS the tonic of its moment. The I7-IV7-V7 cycle is a complete harmonic language.

**Roman:** I7 | I7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7

**Chords:**
```
A7 A7 A7 A7 | A7 A7 A7 A7 | A7 A7 A7 A7 | A7 A7 A7 A7 | D7 D7 D7 D7 | D7 D7 D7 D7 | A7 A7 A7 A7 | A7 A7 A7 A7 | E7 E7 E7 E7 | D7 D7 D7 D7 | A7 A7 A7 A7 | E7 E7 E7 E7
```

---

### 11. Autumn Leaves

**Composer:** Joseph Kosma (1945)
**Key:** G minor (relative Bb major)
**Genre:** Jazz
**Harmonic feature:** ii-V-I
**Tempo:** 132 BPM
**Grid:** `"1/4"`

**Comment:** The textbook ii-V-I study piece. First a ii-V-I in the relative major (Bb: Cm7-F7-Bbmaj7), then the same pattern in the parallel minor (Gm: Am7b5-D7-Gm). Watch the Tonnetz path — the two ii-V-I chains create parallel geometric motion in different regions of the lattice.

**Roman (Bb):** ii7 | V7 | Imaj7 | IVmaj7 | viiø7 | III7 | vi | vi

**Chords:**
```
Cm7 Cm7 Cm7 Cm7 | F7 F7 F7 F7 | Bbmaj7 Bbmaj7 Bbmaj7 Bbmaj7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Am7b5 Am7b5 Am7b5 Am7b5 | D7 D7 D7 D7 | Gm Gm Gm Gm | Gm Gm Gm Gm
```

---

### 12. I Got Rhythm (Rhythm Changes)

**Composer:** George Gershwin (1930)
**Key:** Bb major
**Genre:** Jazz
**Harmonic feature:** Rhythm changes
**Tempo:** 168 BPM
**Grid:** `"1/4"`

**Comment:** "Rhythm changes" — the second most important chord progression in jazz after the blues. The A section's rapid I-vi-ii-V turnarounds and the chromatic iv (Ebm) create the template for hundreds of bebop compositions.

**Roman:** I vi7 | ii7 V7 | I vi7 | ii7 V7 | I I7 | IV iv | I V7 | I

**Chords:**
```
Bb Bb Gm7 Gm7 | Cm7 Cm7 F7 F7 | Bb Bb Gm7 Gm7 | Cm7 Cm7 F7 F7 | Bb Bb Bb7 Bb7 | Eb Eb Ebm Ebm | Bb Bb F7 F7 | Bb Bb Bb Bb
```

---

### 13. Yesterday

**Composer:** The Beatles / Paul McCartney (1965)
**Key:** F major
**Genre:** Pop / Rock
**Harmonic feature:** Chromatic voice-leading
**Tempo:** 96 BPM
**Grid:** `"1/4"`

**Comment:** The chromatic descending line F-E-Eb-D in the bass creates the melancholy. Em7-A7-Dm borrows A7 from D minor — a secondary dominant (V/vi) that pulls into the relative minor. One of the most covered songs ever written.

**Roman:** I | vii7 | III7 | vi | vi | IV | V7 | I

**Chords:**
```
F F F F | Em7 Em7 Em7 Em7 | A7 A7 A7 A7 | Dm Dm Dm Dm | Dm Dm Dm Dm | Bb Bb Bb Bb | C7 C7 C7 C7 | F F F F
```

---

### 14. Doo-Wop Progression (Stand By Me)

**Composer:** Traditional / Ben E. King (1961)
**Key:** C major
**Genre:** Pop / Rock
**Harmonic feature:** I-V-vi-IV pop progression
**Tempo:** 118 BPM
**Grid:** `"1/4"`

**Comment:** I-vi-IV-V — the "doo-wop" or "50s progression." On the Tonnetz, the I-vi relationship is a single edge (two shared notes), making this the most compact possible major-minor oscillation. The IV-V turnaround pushes back to I.

**Roman:** I | vi | IV | V

**Chords:**
```
C C C C | Am Am Am Am | F F F F | G G G G
```

---

## Entries 15–21

### 15. Take Five

**Composer:** Paul Desmond / Dave Brubeck Quartet (1959)
**Key:** Eb minor (Dorian)
**Genre:** Jazz
**Harmonic feature:** Modal / Dorian
**Tempo:** 172 BPM
**Grid:** `"1/4"`

**Comment:** 5/4 time signature and Dorian mode — two departures from jazz convention in one piece. The entire vamp is just two chords, Ebm and Bbm7, oscillating i-v in Dorian. The bridge shifts to Cb (bVI) and Ab (IV) before returning. Proof that modal jazz can swing.

**Roman:** i | v7 | i | v7 | bVI | IV | i | v7

**Chords:**
```
Ebm Ebm Ebm Ebm Ebm | Bbm7 Bbm7 Bbm7 Bbm7 Bbm7 | Ebm Ebm Ebm Ebm Ebm | Bbm7 Bbm7 Bbm7 Bbm7 Bbm7 | Cb Cb Cb Cb Cb | Ab Ab Ab Ab Ab | Ebm Ebm Ebm Ebm Ebm | Bbm7 Bbm7 Bbm7 Bbm7 Bbm7
```

---

### 16. Blue Bossa

**Composer:** Kenny Dorham (1963)
**Key:** C minor
**Genre:** Jazz
**Harmonic feature:** Key center modulation
**Tempo:** 144 BPM
**Grid:** `"1/4"`

**Comment:** Textbook Latin jazz harmony: a ii-V-i in C minor, then a sudden ii-V-I shift to Db major (down a half step), then back. The modulation to bII is a whole-tone root motion that creates a dramatic geographic leap on the Tonnetz before snapping back.

**Roman (Cm):** i | i | iv7 | VII7 | IIImaj7 | IIImaj7 | ii-V (Db) | ii-V (Db) | IImaj7 | IImaj7 | ii7 | V7 | i | i | ii7 V7 | i

**Chords:**
```
Cm Cm Cm Cm | Cm Cm Cm Cm | Fm7 Fm7 Fm7 Fm7 | Bb7 Bb7 Bb7 Bb7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Ebm Ebm Ebm Ebm | Ab7 Ab7 Ab7 Ab7 | Dbmaj7 Dbmaj7 Dbmaj7 Dbmaj7 | Dbmaj7 Dbmaj7 Dbmaj7 Dbmaj7 | Dm Dm Dm Dm | G7 G7 G7 G7 | Cm Cm Cm Cm | Cm Cm Cm Cm | Dm Dm G7 G7 | Cm Cm Cm Cm
```

---

### 17. Giant Steps

**Composer:** John Coltrane (1960)
**Key:** B major (multi-tonic)
**Genre:** Jazz
**Harmonic feature:** Chromatic mediant / Coltrane changes
**Tempo:** 286 BPM
**Grid:** `"1/4"`

**Comment:** Three key centers (B, G, Eb) related by major thirds — dividing the octave into equal parts. Each key gets a V-I cadence before the root drops a major third. On the Tonnetz this traces a perfect equilateral triangle at the macro level, mirroring the micro-triangles of the lattice itself.

**Roman:** Imaj7 | V7/bVI | bVImaj7 | V7/III | IIImaj7 | V7/I | Imaj7 | V7/bVI | bVImaj7 | V7/III | IIImaj7 | V7/I | Imaj7 | Imaj7 | V7/bVI bVImaj7 | V7/III IIImaj7

**Chords:**
```
Bmaj7 Bmaj7 Bmaj7 Bmaj7 | D7 D7 D7 D7 | Gmaj7 Gmaj7 Gmaj7 Gmaj7 | Bb7 Bb7 Bb7 Bb7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Am7 Am7 D7 D7 | Gmaj7 Gmaj7 Gmaj7 Gmaj7 | Bb7 Bb7 Bb7 Bb7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | F#7 F#7 F#7 F#7 | Bmaj7 Bmaj7 Bmaj7 Bmaj7 | Fm7 Fm7 Bb7 Bb7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Am7 Am7 D7 D7 | Gmaj7 Gmaj7 C#m C#m | F#7 F#7 Bmaj7 Bmaj7
```

---

### 18. Misty

**Composer:** Erroll Garner (1954)
**Key:** Eb major
**Genre:** Jazz
**Harmonic feature:** Key center modulation
**Tempo:** 72 BPM
**Grid:** `"1/4"`

**Comment:** Lush ballad harmony built on descending root motion. The opening Ebmaj7-Bbm7-Eb7 is a I to ii-V of IV (Ab), a textbook secondary dominant chain. The chromatic passing chords create smooth voice-leading that maps as short, connected steps on the Tonnetz.

**Roman:** Imaj7 | v7 I7 | IVmaj7 | iv7 bVII7 | Imaj7 | vi7 | ii7 | V7

**Chords:**
```
Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Bbm7 Bbm7 Eb7 Eb7 | Abmaj7 Abmaj7 Abmaj7 Abmaj7 | Abm Abm Db7 Db7 | Ebmaj7 Ebmaj7 Ebmaj7 Ebmaj7 | Cm7 Cm7 Cm7 Cm7 | Fm7 Fm7 Fm7 Fm7 | Bb7 Bb7 Bb7 Bb7
```

---

### 19. The Girl from Ipanema

**Composer:** Antônio Carlos Jobim (1962)
**Key:** F major
**Genre:** Jazz
**Harmonic feature:** Tritone substitution
**Tempo:** 138 BPM
**Grid:** `"1/4"`

**Comment:** Bossa nova's signature tune. The Fmaj7-G7-Gm7-Gb7 turnaround uses Gb7 as a tritone substitution for C7 (V), creating a chromatic descending bass line (G-G-Gb-F). The bridge modulates up a half step to Gbmaj7, a jarring geographical leap on the Tonnetz.

**Roman:** Imaj7 | II7 | ii7 | bII7 | Imaj7 | II7 | ii7 | bII7

**Chords:**
```
Fmaj7 Fmaj7 Fmaj7 Fmaj7 | G7 G7 G7 G7 | Gm7 Gm7 Gm7 Gm7 | Gb7 Gb7 Gb7 Gb7 | Fmaj7 Fmaj7 Fmaj7 Fmaj7 | G7 G7 G7 G7 | Gm7 Gm7 Gm7 Gm7 | Gb7 Gb7 Gb7 Gb7
```

---

### 20. Don't Stop Believin'

**Composer:** Journey / Jonathan Cain, Steve Perry, Neal Schon (1981)
**Key:** E major
**Genre:** Pop / Rock
**Harmonic feature:** I-V-vi-IV pop progression
**Tempo:** 118 BPM
**Grid:** `"1/4"`

**Comment:** The anthem that proved I-V-vi-IV is the most commercially powerful progression in pop. The constant cycling through these four chords without ever resolving to a full cadence creates the "never-ending" uplifting feel. Same geometric Tonnetz path as "Let It Be," "With or Without You," and hundreds of others.

**Roman:** I | V | vi | IV

**Chords:**
```
E E E E | B B B B | C#m C#m C#m C#m | A A A A
```

---

### 21. Sweet Home Alabama

**Composer:** Lynyrd Skynyrd / Ed King, Gary Rossington, Ronnie Van Zant (1974)
**Key:** D major (Mixolydian)
**Genre:** Pop / Rock
**Harmonic feature:** Mixolydian / modal mixture
**Tempo:** 98 BPM
**Grid:** `"1/4"`

**Comment:** D-C-G (I-bVII-IV) — the "Mixolydian turnaround." The C major chord is borrowed from D Mixolydian (or the parallel minor). This three-chord riff avoids the dominant (A) entirely, creating a laid-back gravity-free feel. Compare with "Sympathy for the Devil" (same changes in E).

**Roman:** I | bVII | IV | IV

**Chords:**
```
D D D D | C C C C | G G G G | G G G G
```

---

## Entries 22–28

### 22. Wonderwall

**Composer:** Oasis / Noel Gallagher (1995)
**Key:** F# minor (capo 2 → effectively Em shape)
**Genre:** Pop / Rock
**Harmonic feature:** Modal / Dorian
**Tempo:** 87 BPM
**Grid:** `"1/4"`

**Comment:** The sus2 and sus4 chords are simplified here to their parent triads. The progression uses bVII (E) instead of the diatonic vii°, creating a Dorian-flavored minor. The Em-G-D-A cycle is harmonically ambiguous — could be vi-I-V-II in G or i-bIII-bVII-IV in Em.

**Roman (Em):** i | bIII | bVII | IV | i | bIII | bVII | IV

**Chords:**
```
Em Em Em Em | G G G G | D D D D | A A A A | Em Em Em Em | G G G G | D D D D | A A A A
```

---

### 23. Stairway to Heaven

**Composer:** Led Zeppelin / Jimmy Page, Robert Plant (1971)
**Key:** A minor
**Genre:** Pop / Rock
**Harmonic feature:** Descending bass line
**Tempo:** 72 BPM
**Grid:** `"1/4"`

**Comment:** The intro's chromatic descending bass (A-G#-G-F#-F-E) over a sustained Am triad creates one of rock's most recognizable openings. Each bass note recontextualizes the harmony — the same three upper notes sound different over each bass. Simplified here to the basic chord changes.

**Roman:** i | bVII | bVI | bVI | i | bVII | bVI | V

**Chords:**
```
Am Am Am Am | G G G G | F F F F | F F F F | Am Am Am Am | G G G G | F F F F | E E E E
```

---

### 24. Hallelujah

**Composer:** Leonard Cohen (1984)
**Key:** C major
**Genre:** Pop / Rock
**Harmonic feature:** Harmonic ambiguity
**Tempo:** 56 BPM
**Grid:** `"1/4"`

**Comment:** "It goes like this: the fourth, the fifth, the minor fall, the major lift" — Cohen narrating his own chord progression (IV-V-vi-IV). The vi (Am) is the "minor fall," the IV (F) is the "major lift." The song literally teaches music theory while performing it.

**Roman:** I | vi | I | vi | IV | V | vi | IV | V | I

**Chords:**
```
C C C C | Am Am Am Am | C C C C | Am Am Am Am | F F F F | G G G G | Am Am Am Am | F F F F | G G G G | C C C C
```

---

### 25. Prelude in E Minor, Op. 28, No. 4

**Composer:** Frédéric Chopin (1839)
**Key:** E minor
**Genre:** Classical / Baroque
**Harmonic feature:** Descending bass line / Chromatic voice-leading
**Tempo:** 52 BPM
**Grid:** `"1/4"`

**Comment:** Sustained chords with a chromatically descending inner voice (B-Bb-A-Ab-G-F#) while the melody holds still. The effect is of the harmonic ground slowly sinking beneath a fixed point. On the Tonnetz, each step slides exactly one node along the chromatic axis. Simplified here to the structural chords.

**Roman:** i | i | iv | iv | V7 | V7 | i | i

**Chords:**
```
Em Em Em Em | Em Em Em Em | Am Am Am Am | Am Am Am Am | B7 B7 B7 B7 | B7 B7 B7 B7 | Em Em Em Em | Em Em Em Em
```

---

### 26. Clair de Lune

**Composer:** Claude Debussy (1905)
**Key:** Db major
**Genre:** Classical / Baroque
**Harmonic feature:** Parallel motion / Chromatic voice-leading
**Tempo:** 56 BPM
**Grid:** `"1/4"`

**Comment:** Debussy's planing technique — chords moving in parallel motion, breaking every classical voice-leading rule. Triads slide chromatically or by whole steps, maintaining their shape but shifting position. On the Tonnetz this creates uniform directional movement rather than the zigzag of functional harmony. Simplified to key structural changes.

**Roman:** I | IV | I | vi | IV | V7 | I | I

**Chords:**
```
Db Db Db Db | Gb Gb Gb Gb | Db Db Db Db | Bbm Bbm Bbm Bbm | Gb Gb Gb Gb | Ab7 Ab7 Ab7 Ab7 | Db Db Db Db | Db Db Db Db
```

---

### 27. Tristan Chord Sequence

**Composer:** Richard Wagner (1865)
**Key:** A minor (chromatic)
**Genre:** Classical / Baroque
**Harmonic feature:** Harmonic ambiguity / Chromatic voice-leading
**Tempo:** 48 BPM
**Grid:** `"1/4"`

**Comment:** The opening of Tristan und Isolde: arguably the most analyzed four bars in music history. The "Tristan chord" (F-B-D#-G#) resists tonal classification — is it an augmented sixth? A half-diminished seventh? Wagner deliberately leaves it unresolved, pointing toward atonality. Simplified here to an approximation of the functional roots.

**Roman:** ? | V7 | ? | V7 | i

**Chords:**
```
Fm Fm Fm Fm | E7 E7 E7 E7 | Dm Dm Dm Dm | E7 E7 E7 E7 | Am Am Am Am
```

---

### 28. Всё идёт по плану (Everything Goes According to Plan)

**Composer:** Grazhdanskaya Oborona (GrOb) / Yegor Letov (1988)
**Key:** A minor
**Genre:** Post-Punk
**Harmonic feature:** Minor key i-iv-V
**Tempo:** 112 BPM
**Grid:** `"1/4"`

**Comment:** Soviet post-punk anthem built on the starkest possible minor-key cycle: Am-Dm-E-Am (i-iv-V-i). No extensions, no color chords, no passing tones — just the three pillars of minor tonality hammered with distortion. The harmonic bleakness mirrors the lyrical bleakness. On the Tonnetz, this traces the tightest possible triangle in minor space.

**Roman:** i | iv | V | i

**Chords:**
```
Am Am Am Am | Dm Dm Dm Dm | E E E E | Am Am Am Am
```

---

## Parser Compatibility Notes

**Currently parseable (HC grammar as of Phase 0a):**
All major, minor, dim, aug triads + 6, 7, maj7, add9, 6/9 extensions.

**Requires Phase 0b grammar expansion:**
- Entry 11 (Autumn Leaves): `Am7b5` — needs m7b5 support in HC

**Requires Phase 0b input cleaning:**
- No slash chords in current library (stripped at source)

**All other entries:** Use only symbols within current HC parser capability.
