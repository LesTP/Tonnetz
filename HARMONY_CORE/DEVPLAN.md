# DEVPLAN — Harmony Core

Module: Harmony Core
Version: 1.0
Date: 2026-02-13
Architecture reference: ARCH_HARMONY_CORE.md (Draft 0.4)

---

## Cold Start Summary

**What this is:**
Pure-logic harmonic subsystem for the Tonnetz Interactive Harmonic Explorer. Responsible for Tonnetz lattice math, chord parsing, chord → geometric shape decomposition, edge union chords, and progression path computation. Zero UI/audio/storage dependencies — consumed by Rendering/UI, Audio, and Persistence modules through a public API.

**Key constraints:**
- All geometry is integer lattice coordinates `(u, v)` with `pc(u,v) = (7u + 4v) mod 12`
- Diminished triads don't form lattice triangles → represented as dot clusters (HC-D5)
- Augmented extended chords (aug7, augMaj7) excluded from MVP (HC-D4)
- Chain focus policy: each chord in a progression is placed relative to the previous shape's centroid (HC-D11)
- Centroid = arithmetic mean of unique vertex coordinates; dot-only shapes use focus as centroid (HC-D9)

**Gotchas:**
- JavaScript `%` operator returns negative values for negative operands — must use `((n % 12) + 12) % 12` for pitch-class mod
- Edge IDs must be canonical (lexicographic node ordering) or adjacency lookups will silently fail
- `sigToTris` keys are sorted pitch-class signatures (`"0-4-7"` not `"4-7-0"`) — inconsistent sorting breaks placement

---

## Current Status

**Phase:** 1a — Types and pitch-class mapping
**Focus:** Implement `NodeCoord` (readonly object), branded IDs (`NodeId`), and `pc(u,v)`
**Blocked/Broken:** Nothing — scaffold complete, all discuss decisions closed

---

## Overview

Implement the pure-logic harmonic subsystem as defined in ARCH_HARMONY_CORE.md.
All work is UI-agnostic, audio-agnostic, and storage-agnostic.
Output: a self-contained module with a public API consumable by Rendering/UI, Audio, and Persistence subsystems.

---

## Phase 1: Coordinate System & Primitives

**Objective:** Establish the foundational types, coordinate mapping, and ID generation for nodes, triangles, and edges.

### Phase 1a: Types and pitch-class mapping

Implement core types and the `pc(u,v)` function.

**Scope:**
- Define `NodeCoord` as `(u, v)` integer pair
- Define `NodeId` string format `"N:u,v"`
- Implement `pc(u,v) = (pc0 + 7*u + 4*v) mod 12` with `pc0 = 0`
- Implement `nodeId(u, v)` → `NodeId`

**Tests:**
- [ ] `pc(0,0)` = 0 (C)
- [ ] `pc(1,0)` = 7 (G, fifth above C)
- [ ] `pc(0,1)` = 4 (E, major third above C)
- [ ] `pc(1,1)` = 11 (B)
- [ ] `pc(-1,0)` = 5 (F, fifth below C)
- [ ] Negative coordinates wrap correctly: `pc(-2, -3)` = `(0 + 7*(-2) + 4*(-3)) mod 12` = `(-26) mod 12` = 10
- [ ] `nodeId(3, -1)` = `"N:3,-1"`

### Phase 1b: Triangle types and vertex computation

Implement `TriRef`, `TriId`, and triangle vertex/pitch-class computation.

**Scope:**
- Define `TriRef` as `{ orientation: "U" | "D", anchor: (u, v) }`
- Define `TriId` string format `"T:U:u,v"` / `"T:D:u,v"`
- Implement `triVertices(tri)` → three `NodeCoord` per HC-D2
- Implement `getTrianglePcs(tri)` → sorted array of 3 pitch classes

**Tests:**
- [ ] Up triangle `(0,0)`: vertices `(0,0), (1,0), (0,1)` → pcs `{0, 7, 4}` → sorted `[0, 4, 7]` (C major)
- [ ] Down triangle `(0,0)`: vertices `(1,1), (1,0), (0,1)` → pcs `{11, 7, 4}` → sorted `[4, 7, 11]` (E minor)
- [ ] `triId({orientation:"U", anchor:(2,3)})` = `"T:U:2,3"`
- [ ] `triId({orientation:"D", anchor:(-1,0)})` = `"T:D:-1,0"`
- [ ] `getTrianglePcs` returns exactly 3 pitch classes, each in 0..11

### Phase 1c: Edge types and canonical ID

Implement `EdgeId` construction and triangle-edge enumeration.

**Scope:**
- Implement `edgeId(nodeA, nodeB)` → canonical `EdgeId` (lexicographic node ordering)
- Implement `triEdges(tri)` → array of 3 `EdgeId` for a given triangle

**Tests:**
- [ ] `edgeId((0,0), (1,0))` = `edgeId((1,0), (0,0))` (order-independent)
- [ ] `edgeId` format is `"E:N:a,b|N:c,d"` with `N:a,b` ≤ `N:c,d` lexicographically
- [ ] Up triangle `(0,0)` produces 3 edges connecting its 3 vertices
- [ ] Down triangle `(0,0)` produces 3 edges connecting its 3 vertices
- [ ] Adjacent up and down triangles sharing an edge produce identical `EdgeId` for that shared edge

### Phase 1 completion tests:
- [ ] All type constructors produce well-formed string IDs
- [ ] `pc` is consistent with `getTrianglePcs` (triangle pcs match individual node pcs)
- [ ] No floating-point math anywhere (all integer arithmetic + mod)

---

## Phase 2: Window Indexing

**Objective:** Build the three index maps (`edgeToTris`, `nodeToTris`, `sigToTris`) for a given lattice window, plus adjacency and edge-union queries.

### Phase 2a: `buildWindowIndices`

Implement full index construction from rectangular bounds.

**Scope:**
- Input: `bounds = { uMin, uMax, vMin, vMax }`
- Enumerate all up and down triangles whose anchors fall within bounds
- Build `edgeToTris: Map<EdgeId, TriId[]>`
- Build `nodeToTris: Map<NodeId, TriId[]>`
- Build `sigToTris: Map<string, TriId[]>` (pitch-set signature → triangle list)

**Tests:**
- [ ] 1×1 window `{uMin:0, uMax:0, vMin:0, vMax:0}` produces exactly 2 triangles (one U, one D)
- [ ] 2×2 window produces 8 triangles
- [ ] `edgeToTris`: shared internal edges map to exactly 2 triangles
- [ ] `edgeToTris`: boundary edges map to exactly 1 triangle
- [ ] `nodeToTris`: corner node of window maps to fewer triangles than center node
- [ ] `sigToTris`: C major signature `"0-4-7"` maps to all triangles with those pcs within window
- [ ] Every triangle in window appears in all three indices

### Phase 2b: `getAdjacentTriangles`

Implement adjacency lookup via shared edges.

**Scope:**
- Given a `TriRef` and indices, return all triangles sharing an edge with it
- Use `edgeToTris` index

**Tests:**
- [ ] Interior up triangle has exactly 3 adjacent triangles (one per edge)
- [ ] Interior down triangle has exactly 3 adjacent triangles
- [ ] Triangle at window boundary has fewer than 3 adjacents
- [ ] Adjacent triangles share exactly one edge
- [ ] A triangle is never adjacent to itself

### Phase 2c: `getEdgeUnionPcs`

Implement edge-based union chord computation (HC-D10).

**Scope:**
- Look up `edgeToTris[edgeId]`
- If 2 triangles share the edge: return `pcs(triA) ∪ pcs(triB)`
- If only 1 triangle (boundary edge): return `null` or empty (boundary edges excluded)

**Tests:**
- [ ] Shared edge between C major up-tri and E minor down-tri → union = `{0, 4, 7, 11}` (4 pcs)
- [ ] Union always contains exactly the pcs of both triangles (no duplicates)
- [ ] Shared pcs between the two triangles appear only once in result
- [ ] Boundary edge returns `null`
- [ ] Result is an unordered set (sorted for comparison)

### Phase 2 completion tests:
- [ ] Rebuild indices for a 5×5 window; all invariants hold
- [ ] `sigToTris` entries for every known triad type are non-empty somewhere in a large enough window
- [ ] No triangle referenced in any index is outside the window bounds

---

## Phase 3: Chord Parsing

**Objective:** Parse chord symbol strings into structured `Chord` objects with computed pitch-class sets.

### Phase 3a: `parseChordSymbol`

Implement text → `Chord` parser for MVP grammar (HC-D4).

**Scope:**
- Parse root note: C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B
- Parse quality: major (default), minor (m), diminished (dim), augmented (aug)
- Parse extensions: 6, add9, 6/9, maj7, 7, m7 (as per HC-D4)
- Reject augmented extended chords (aug7, augMaj7)
- Return `Chord` with `root_pc`, `quality`, `extensions`, `main_triad_pcs`

**Tests:**
- [ ] `"C"` → root_pc=0, quality=maj, extensions=[]
- [ ] `"Am"` → root_pc=9, quality=min, extensions=[]
- [ ] `"F#dim"` → root_pc=6, quality=dim, extensions=[]
- [ ] `"Bb7"` → root_pc=10, quality=maj, extensions=[7]
- [ ] `"Dmaj7"` → root_pc=2, quality=maj, extensions=[maj7]
- [ ] `"Cm7"` → root_pc=0, quality=min, extensions=[m7]  (m prefix is quality, 7 is extension)
- [ ] `"Ebadd9"` → root_pc=3, quality=maj, extensions=[add9]
- [ ] `"G6/9"` → root_pc=7, quality=maj, extensions=[6/9]
- [ ] `"Caug"` → root_pc=0, quality=aug, extensions=[] (plain aug triad: allowed)
- [ ] `"Caug7"` → rejected / error (augmented extended: excluded from MVP)
- [ ] Invalid input `"XYZ"` → error
- [ ] Case handling: `"cm"` vs `"Cm"` — decide and document

### Phase 3b: `computeChordPcs`

Compute full pitch-class set from a parsed `Chord`.

**Scope:**
- Triad pcs from root + quality intervals
- Extension pcs from root + extension intervals
- `main_triad_pcs`: the 3 triad pcs
- `chord_pcs`: triad ∪ extension pcs

**Interval map:**
- maj: [0, 4, 7]
- min: [0, 3, 7]
- dim: [0, 3, 6]
- aug: [0, 4, 8]
- Extensions: 6→9, 7→10, maj7→11, m7→10 (same as 7 but on minor quality), add9→14→2, 6/9→[9,2]

**Tests:**
- [ ] C major: chord_pcs = {0, 4, 7}, main_triad_pcs = {0, 4, 7}
- [ ] A minor: chord_pcs = {9, 0, 4}, main_triad_pcs = {9, 0, 4}
- [ ] Bdim: chord_pcs = {11, 2, 5}, main_triad_pcs = {11, 2, 5}
- [ ] Caug: chord_pcs = {0, 4, 8}, main_triad_pcs = {0, 4, 8}
- [ ] Cmaj7: chord_pcs = {0, 4, 7, 11}, main_triad_pcs = {0, 4, 7}
- [ ] C7: chord_pcs = {0, 4, 7, 10}, main_triad_pcs = {0, 4, 7}
- [ ] Cm7: chord_pcs = {0, 3, 7, 10}, main_triad_pcs = {0, 3, 7}
- [ ] C6: chord_pcs = {0, 4, 7, 9}, main_triad_pcs = {0, 4, 7}
- [ ] Cadd9: chord_pcs = {0, 4, 7, 2}, main_triad_pcs = {0, 4, 7}
- [ ] C6/9: chord_pcs = {0, 4, 7, 9, 2}, main_triad_pcs = {0, 4, 7}
- [ ] All pcs are in 0..11 (mod 12 applied)

### Phase 3 completion tests:
- [ ] Round-trip: parse symbol → compute pcs → verify against known pitch-class sets for all MVP chord types
- [ ] All 12 roots × maj quality produce correct pcs
- [ ] All 12 roots × min quality produce correct pcs

---

## Phase 4: Chord Placement & Shape Decomposition

**Objective:** Map chords to Tonnetz shapes — main triangle placement, extension discovery, diminished dot handling, centroid computation.

### Phase 4a: `placeMainTriad`

Implement main triangle placement (HC-D6).

**Scope:**
- Diminished triad → return `null` (dot-only path, HC-D5)
- Compute pitch signature for triad
- Look up `sigToTris` for candidates
- Select candidate nearest to focus `(u0, v0)` by lattice distance
- Tie-break: lexicographic `TriId`

**Tests:**
- [ ] C major with focus `(0,0)` → selects up triangle at `(0,0)` (pcs 0,4,7)
- [ ] C major with focus `(5,5)` → selects a C major triangle near `(5,5)`, not `(0,0)`
- [ ] Bdim with any focus → returns `null`
- [ ] Augmented triad (e.g., Caug) with focus → returns a valid triangle (aug triads do form lattice triangles)
- [ ] When two candidates are equidistant, lexicographic TriId wins
- [ ] Returned triangle's pcs match the chord's main_triad_pcs

### Phase 4b: `decomposeChordToShape` — triangulated chords

Implement extension discovery and shape assembly for non-diminished chords (HC-D7).

**Scope:**
- Starting from main triangle, greedily expand via adjacent triangles
- Keep only adjacents whose pcs ⊆ chord_pcs
- Select candidate adding maximal uncovered tones; tie-break: distance then TriId
- Stop when no candidate adds new tones, or ext_tris limit reached (default 2)
- Remaining uncovered chord_pcs → `dot_pcs`
- Compute `root_vertex_index` (which vertex of main_tri is the root)
- Compute `centroid_uv` (HC-D9: mean of unique vertices)

**Tests:**
- [ ] C major triad → main_tri only, ext_tris=[], dot_pcs=[], covered_pcs={0,4,7}
- [ ] Cmaj7 → main_tri = C major, ext_tris includes a triangle covering pc 11, dot_pcs=[]
- [ ] C7 → main_tri = C major, extension covers pc 10 (if adjacent triangle exists), otherwise dot_pcs=[10]
- [ ] C6/9 (5 pcs) → main_tri + up to 2 ext_tris, remaining pcs in dot_pcs
- [ ] `root_vertex_index` correctly identifies which vertex (0, 1, or 2) of main_tri has root_pc
- [ ] `centroid_uv` for single triangle = mean of 3 vertices
- [ ] `centroid_uv` for tri + 1 ext = mean of all unique vertices (shared vertices counted once)
- [ ] `covered_pcs` = union of all triangle pcs (main + ext)
- [ ] `covered_pcs ∪ dot_pcs` = chord_pcs (complete coverage)
- [ ] ext_tris never exceeds configured maximum

### Phase 4c: `decomposeChordToShape` — diminished dot-only path

Implement the dot-cluster fallback for diminished triads (HC-D5).

**Scope:**
- If chord quality is dim: main_tri=null, ext_tris=[], dot_pcs=all chord_pcs
- root_vertex_index=null
- centroid_uv=focus coordinate (HC-D9 fallback)
- Extended diminished chords (e.g., dim7 if added later): same dot-only path

**Tests:**
- [ ] Bdim → main_tri=null, dot_pcs=[11,2,5], centroid_uv=focus
- [ ] F#dim → main_tri=null, dot_pcs=[6,9,0], centroid_uv=focus
- [ ] root_vertex_index=null for all dim shapes
- [ ] covered_pcs is empty set (no triangles cover anything)
- [ ] dot_pcs = chord_pcs (all tones are dots)

### Phase 4 completion tests:
- [ ] Decompose every MVP chord type (maj, min, dim, aug, 6, add9, 6/9, maj7, 7, m7) for root C → verify all Shape fields
- [ ] Decompose same set for root F# → verify all Shape fields (non-zero root stress test)
- [ ] Shape invariant: `covered_pcs ∪ set(dot_pcs) == set(chord_pcs)` holds for all chords
- [ ] Shape invariant: `main_tri is null` ↔ `quality == dim`
- [ ] Deterministic: same chord + same focus + same indices → identical shape every time

---

## Phase 5: Progression Mapping

**Objective:** Map a sequence of chords to a sequence of shapes using chain focus (HC-D11).

### Phase 5a: `mapProgressionToShapes`

Implement full progression-to-shape mapping.

**Scope:**
- Input: array of `Chord`, `initialFocus`, `indices`
- For each chord in order:
  - focus = initialFocus (first chord) or centroid of previous shape
  - place main triad with current focus
  - decompose to shape
- Return array of `Shape`

**Tests:**
- [ ] Single chord progression → shape placed at initialFocus
- [ ] Two-chord progression (C → Am): second chord's focus = first chord's centroid
- [ ] Three-chord progression (C → F → G): focus chains correctly through all three
- [ ] Progression with diminished chord (C → Bdim → Am): dim chord's centroid = its focus (the preceding centroid), next chord uses that
- [ ] Empty progression → empty array
- [ ] All returned shapes satisfy the Shape invariants from Phase 4

### Phase 5b: Progression path geometry

Verify centroid path produces usable geometry for rendering.

**Tests:**
- [ ] ii–V–I in C (Dm → G → C): three shapes with centroids forming a connected path
- [ ] I–IV–V–I (C → F → G → C): centroid path returns to approximately the same region
- [ ] Centroid coordinates are fractional (not rounded to integer lattice points)
- [ ] Long progression (8+ chords): no NaN, no Infinity, no degenerate values in any centroid

### Phase 5 completion tests:
- [ ] Round-trip: parse progression string → map to shapes → verify all shapes are well-formed
- [ ] Deterministic: same input → identical output
- [ ] Performance: 50-chord progression completes in < 100ms (sanity check, not hard requirement)

---

## Phase 6: Public API Integration

**Objective:** Wire all components into the public API surface defined in ARCH_HARMONY_CORE.md Section 11. Verify the full API contract.

### Phase 6a: API surface assembly

**Scope:**
- Export all public functions:
  - `buildWindowIndices(bounds)`
  - `getTrianglePcs(tri)`
  - `getAdjacentTriangles(tri)`
  - `getEdgeUnionPcs(edgeId, indices)`
  - `parseChordSymbol(text)`
  - `computeChordPcs(chord)`
  - `placeMainTriad(chord, focus, indices)`
  - `decomposeChordToShape(chord, mainTri, indices)`
  - `mapProgressionToShapes(chords, initialFocus, indices)`
- Ensure no internal implementation details leak through the module boundary

**Tests:**
- [ ] All 9 public functions are exported and callable
- [ ] No internal helpers (e.g., `sigToTris` map directly) are accessible from outside the module
- [ ] Each function's return type matches ARCH_HARMONY_CORE.md specification

### Phase 6b: End-to-end integration tests

Full workflow simulating how Rendering/UI would call Harmony Core.

**Tests:**
- [ ] Build indices → parse "Cmaj7" → place → decompose → verify shape
- [ ] Build indices → parse "Bdim" → decompose → verify dot-only shape
- [ ] Build indices → get edge → getEdgeUnionPcs → verify 4 pcs
- [ ] Build indices → parse progression ["Dm", "G7", "Cmaj7"] → mapProgressionToShapes → verify 3 shapes with chained centroids
- [ ] Rebuild indices with different window → same chord produces different (but valid) placement
- [ ] All API calls with invalid input produce clear errors (not crashes)

### Phase 6 completion tests:
- [ ] Full test suite passes
- [ ] No circular dependencies within the module
- [ ] Module has zero runtime dependencies on UI, audio, or storage code

---

## Decision Log (Module-Level)

```
HC-DEV-D1: Language & module format
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision: TypeScript
Rationale: Module is a typed algebra over coordinates, shapes, and index maps.
Architecture types (Shape, Chord, TriRef, indices) map directly to TS interfaces.
Compile-time enforcement prevents silent type mismatches across the public API boundary.
Revisit if: Platform target changes.
```

```
HC-DEV-D2: Test framework
Date: 2026-02-13
Status: Closed
Priority: Critical
Decision: Vitest
Rationale: Native TS support with zero config. ESM-first aligns with browser delivery target.
Jest-compatible API. Fast watch mode for ~100 test cases across 6 phases.
Revisit if: Build toolchain decision constrains choice.
```

```
HC-DEV-D4: NodeCoord as readonly object interface
Date: 2026-02-13
Status: Closed
Priority: Important
Decision: NodeCoord is an interface { readonly u: number; readonly v: number }.
Rationale: Named properties (coord.u, coord.v) prevent u/v transposition bugs.
Readonly fields enforce value semantics. Consistent with TriRef object shape.
Revisit if: Performance profiling shows object allocation is a bottleneck.
```

```
HC-DEV-D5: Branded string IDs (NodeId, TriId, EdgeId)
Date: 2026-02-13
Status: Closed
Priority: Important
Decision: IDs are branded strings (string & { readonly __brand: "NodeId" } etc.).
Constructor functions (nodeId, triId, edgeId) are the only way to produce them.
Rationale: Zero runtime overhead (plain strings, valid Map keys).
Compile-time type safety prevents cross-map key confusion in the index system.
Revisit if: Branding causes ergonomic issues with third-party code.
```

```
HC-DEV-D3: Chord symbol case sensitivity
Date: 2026-02-13
Status: Open
Priority: Important
Decision: TBD — to be decided in Phase 3a discuss session
Rationale: "cm" vs "Cm" ambiguity. Needs explicit rule.
Revisit if: User testing reveals confusion.
```

---

## Summary

| Phase | Scope | Steps | Key API Functions |
|-------|-------|-------|-------------------|
| 1 | Coordinate system & primitives | 3 | `pc`, `nodeId`, `triId`, `edgeId`, `getTrianglePcs` |
| 2 | Window indexing | 3 | `buildWindowIndices`, `getAdjacentTriangles`, `getEdgeUnionPcs` |
| 3 | Chord parsing | 2 | `parseChordSymbol`, `computeChordPcs` |
| 4 | Placement & decomposition | 3 | `placeMainTriad`, `decomposeChordToShape` |
| 5 | Progression mapping | 2 | `mapProgressionToShapes` |
| 6 | Public API integration | 2 | Full API surface |
