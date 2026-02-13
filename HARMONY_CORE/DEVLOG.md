# DEVLOG — Harmony Core

Module: Harmony Core
Date started: 2026-02-13
DEVPLAN reference: DEVPLAN.md v1.0

---

## Log

### Phase 1a: Types and pitch-class mapping
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/types.ts`: `NodeCoord`, `NodeId`, `TriId`, `EdgeId` (branded), `Orientation`, `TriRef`
- Created `src/coords.ts`: `pc(u,v)`, `nodeId(u,v)`, `coord(u,v)`
- Created `src/__tests__/coords.test.ts`

**Tests passed:**
- [x] `pc(0,0)` = 0 (C)
- [x] `pc(1,0)` = 7 (G, fifth above C)
- [x] `pc(0,1)` = 4 (E, major third above C)
- [x] `pc(1,1)` = 11 (B)
- [x] `pc(-1,0)` = 5 (F, fifth below C)
- [x] Negative coordinates wrap correctly: `pc(-2,-3)` = 10
- [x] Result always in 0..11 (sweep -10..10 for u and v)
- [x] `nodeId(3,-1)` = `"N:3,-1"`
- [x] `nodeId(0,0)` = `"N:0,0"`
- [x] Branded NodeId works as Map key
- [x] `coord()` constructs correct fields

**Issues encountered:**
- None

**Decisions made:**
- HC-DEV-D4: NodeCoord as readonly object interface (closed)
- HC-DEV-D5: Branded string IDs (closed)

---

### Phase 1b: Triangle types and vertex computation
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/triangles.ts`: `triId(tri)`, `triVertices(tri)`, `getTrianglePcs(tri)`
- Created `src/__tests__/triangles.test.ts`

**Tests passed:**
- [x] `triId` U at (2,3) = `"T:U:2,3"`
- [x] `triId` D at (-1,0) = `"T:D:-1,0"`
- [x] Up triangle (0,0): vertices (0,0), (1,0), (0,1)
- [x] Down triangle (0,0): vertices (1,1), (1,0), (0,1)
- [x] Up triangle (0,0) → sorted [0, 4, 7] (C major)
- [x] Down triangle (0,0) → sorted [4, 7, 11] (E minor)
- [x] Returns exactly 3 pitch classes, each in 0..11 (4 cases)
- [x] Triangle pcs match individual node pcs

**Issues encountered:**
- None

---

### Phase 1c: Edge types and canonical ID
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/edges.ts`: `edgeId(a,b)`, `triEdges(tri)`
- Created `src/__tests__/edges.test.ts`

**Tests passed:**
- [x] `edgeId` is order-independent
- [x] Format is `E:N:a,b|N:c,d` with canonical ordering
- [x] Handles negative coordinates
- [x] Up triangle (0,0) produces 3 correct edges
- [x] Down triangle (0,0) produces 3 correct edges
- [x] Adjacent U and D triangles share exactly one edge
- [x] All 3 edges of a triangle are distinct

**Issues encountered:**
- None

---

### Phase 1 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] All type constructors produce well-formed string IDs
- [x] `pc` is consistent with `getTrianglePcs` (triangle pcs match individual node pcs)
- [x] No floating-point math anywhere (all integer arithmetic + mod)

**Test totals:** 27 passed (12 coords + 8 triangles + 7 edges)

**Review notes:**
- Safe modulo `(((n % 12) + 12) % 12)` used throughout as noted in DEVPLAN gotchas
- Branded string types working correctly — compile-time safety with zero runtime overhead
- `triVertices` returns consistent vertex ordering matching HC-D2

**Doc sync:**
- DEVPLAN Current Status updated, HC-DEV-D4 and HC-DEV-D5 closed

**Commit:** `975b217` — "Phase 1: Coordinate system & primitives"

---

### Phase 2a: buildWindowIndices
Date: 2026-02-13
Status: Complete

**Changes:**
- Added `WindowBounds`, `WindowIndices` (with `triIdToRef`) to `src/types.ts`
- Created `src/indexing.ts`: `buildWindowIndices(bounds)`
- Created `src/__tests__/indexing.test.ts`

**Tests passed:**
- [x] 1×1 window produces exactly 2 triangles (one U, one D)
- [x] 2×2 window produces 8 triangles
- [x] `edgeToTris`: shared internal edges map to exactly 2 triangles
- [x] `edgeToTris`: boundary edges map to exactly 1 triangle
- [x] `nodeToTris`: corner node maps to fewer triangles than center node
- [x] `sigToTris`: C major signature `"0-4-7"` maps to correct triangles
- [x] Every triangle in window appears in all three indices
- [x] Stores bounds for reference
- [x] `triIdToRef` allows reverse lookup from TriId to TriRef
- [x] No `edgeToTris` entry has more than 2 triangles

**Issues encountered:**
- None

---

### Phase 2b: getAdjacentTriangles
Date: 2026-02-13
Status: Complete

**Changes:**
- Added `getAdjacentTriangles(tri, indices)` to `src/indexing.ts`
- Added adjacency tests to `src/__tests__/indexing.test.ts`

**Tests passed:**
- [x] Interior up triangle has exactly 3 adjacent triangles
- [x] Interior down triangle has exactly 3 adjacent triangles
- [x] Triangle at window boundary has fewer than 3 adjacents
- [x] A triangle is never adjacent to itself
- [x] Adjacent triangles share exactly one edge

**Issues encountered:**
- None

---

### Phase 2c: getEdgeUnionPcs
Date: 2026-02-13
Status: Complete

**Changes:**
- Added `getEdgeUnionPcs(eid, indices)` to `src/indexing.ts`
- Added edge union tests to `src/__tests__/indexing.test.ts`

**Tests passed:**
- [x] Shared edge between C major U(0,0) and E minor D(0,0) → union {0, 4, 7, 11}
- [x] Union contains exactly the pcs of both triangles, no duplicates
- [x] Shared pcs appear only once in result
- [x] Boundary edge returns null
- [x] Result is sorted

**Issues encountered:**
- None

---

### Phase 2 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] Rebuild indices for 5×5 window; all invariants hold (tested via 7×7 window in edge max-2 test)
- [x] `sigToTris` entries for C major are non-empty in large window
- [x] No triangle referenced in any index is outside the window bounds

**Test totals:** 20 indexing tests + 27 Phase 1 = 47 total

**Review notes:**
- `triIdToRef` reverse lookup map added to `WindowIndices` (design decision from discuss session)
- Single-pass build algorithm: O(n) with constant work per triangle
- `getAdjacentTriangles` uses Set to deduplicate, excludes self
- `getEdgeUnionPcs` returns sorted array for deterministic comparison

**Doc sync:**
- `WindowBounds` and `WindowIndices` types added to `src/types.ts`

**Commit:** `d8d1c30` — "Phase 2: Window indexing"

---

### Phase 3a: parseChordSymbol
Date: 2026-02-13
Status: Complete

**Changes:**
- Added `Quality`, `Extension`, `Chord` types to `src/types.ts`
- Created `src/chords.ts`: `parseChordSymbol(text)`, `computeChordPcs(rootPc, quality, extension)`
- Created `src/__tests__/chords.test.ts`

**Tests passed:**
- [x] `"C"` → root_pc=0, quality=maj, extension=null
- [x] `"Am"` → root_pc=9, quality=min, extension=null
- [x] `"F#dim"` → root_pc=6, quality=dim, extension=null
- [x] `"Bb7"` → root_pc=10, quality=maj, extension=7
- [x] `"Dmaj7"` → root_pc=2, quality=maj, extension=maj7
- [x] `"Cm7"` → root_pc=0, quality=min, extension=7 (m is quality, 7 is extension)
- [x] `"Ebadd9"` → root_pc=3, quality=maj, extension=add9
- [x] `"G6/9"` → root_pc=7, quality=maj, extension=6/9
- [x] `"Caug"` → root_pc=0, quality=aug, extension=null (plain aug allowed)
- [x] `"Caug7"` → rejected (augmented extended excluded from MVP)
- [x] Invalid input `"XYZ"` → error
- [x] Case handling: lowercase root accepted (`"cm7"` → C minor 7)
- [x] All 12 root notes parseable

**Issues encountered:**
- None

**Decisions made:**
- HC-DEV-D3: Root case-insensitive, rest case-sensitive (closed)
- HC-DEV-D6: Regex-based parser with `m(?!aj)` lookahead (closed)
- HC-DEV-D7: Chord.extension is singular `Extension | null` (closed)

---

### Phase 3b: computeChordPcs
Date: 2026-02-13
Status: Complete

**Changes:**
- Implemented within `src/chords.ts` alongside `parseChordSymbol`
- Tests in same file `src/__tests__/chords.test.ts`

**Tests passed:**
- [x] C major: chord_pcs = {0,4,7}, main_triad_pcs = [0,4,7]
- [x] A minor: chord_pcs = {9,0,4}, main_triad_pcs = [9,0,4]
- [x] Bdim: chord_pcs = {11,2,5}, main_triad_pcs = [11,2,5]
- [x] Caug: chord_pcs = {0,4,8}, main_triad_pcs = [0,4,8]
- [x] Cmaj7: chord_pcs = {0,4,7,11}
- [x] C7: chord_pcs = {0,4,7,10}
- [x] Cm7: chord_pcs = {0,3,7,10}
- [x] C6: chord_pcs = {0,4,7,9}
- [x] Cadd9: chord_pcs = {0,4,7,2}
- [x] C6/9: chord_pcs = {0,4,7,9,2}
- [x] All pcs in 0..11

**Issues encountered:**
- None

---

### Phase 3 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] Round-trip: parse symbol → compute pcs → verify against known pitch-class sets for all MVP chord types
- [x] All 12 roots × maj quality produce correct pcs
- [x] All 12 roots × min quality produce correct pcs

**Test totals:** 26 chord tests + 47 prior = 73 total

**Review notes:**
- Regex `m(?!aj)` negative lookahead cleanly disambiguates `Cm7` (quality=min, ext=7) from `Cmaj7` (quality=maj, ext=maj7)
- `computeChordPcs` is a separate exported function, enabling direct use by tests and future callers that already have parsed components
- Extension intervals stored as arrays to support `6/9` which adds two pcs ([9, 2])

**Doc sync:**
- DEVPLAN: HC-DEV-D3, D6, D7 closed; Current Status advanced to Phase 3a

**Commit:** `99f5546` — "Phase 3: Chord parsing and pitch-class computation"

---

### Phase 4a: placeMainTriad
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/placement.ts`: `triCentroid(tri)`, `placeMainTriad(chord, focus, indices)`
- Created `src/__tests__/placement.test.ts`

**Tests passed:**
- [x] C major at focus (0,0) → selects U(0,0)
- [x] C major at focus (3,3) → selects nearer candidate, not (0,0)
- [x] Bdim → returns null (dot-only)
- [x] Caug → returns null (dot-only, discovered aug triads don't form lattice triangles)
- [x] Equidistant tie-break: lexicographic TriId wins
- [x] Returned triangle pcs match chord's main_triad_pcs
- [x] Am at origin → valid minor triangle
- [x] F at origin → valid major triangle

**Issues encountered:**
- Caug test failure: augmented triads (stacked major thirds) place all nodes along the same diagonal axis — they don't form lattice triangles. Fixed by adding `chord.quality === "aug"` to the null-return check alongside `"dim"`.

**Decisions made:**
- HC-D5 revised: both dim AND aug triads use dot-cluster representation

---

### Phase 4b: decomposeChordToShape
Date: 2026-02-13
Status: Complete

**Changes:**
- Added `Shape` interface to `src/types.ts`
- Added `decomposeChordToShape(chord, mainTri, focus, indices)` to `src/placement.ts`
- Added 14 decomposition tests to `src/__tests__/placement.test.ts`

**Tests passed:**
- [x] C major triad → main_tri only, ext_tris=[], dot_pcs=[], covered_pcs={0,4,7}
- [x] Cmaj7 → main_tri + ext_tri covering pc 11, dot_pcs=[]
- [x] C7 → extension covers pc 10
- [x] C6/9 (5 pcs) → main_tri + ext_tris + remaining in dot_pcs
- [x] root_vertex_index correctly identifies root vertex
- [x] centroid_uv for single triangle = mean of 3 vertices
- [x] centroid_uv for tri + ext = mean of unique vertices
- [x] covered_pcs ∪ dot_pcs = chord_pcs (coverage invariant)
- [x] ext_tris never exceeds MAX_EXT_TRIS (2)
- [x] Bdim → dot-only: main_tri=null, dot_pcs=[11,2,5], centroid=focus
- [x] Caug → dot-only: main_tri=null, dot_pcs=[0,4,8], centroid=focus
- [x] Dot-only: covered_pcs is empty, root_vertex_index=null
- [x] Am triad decomposition
- [x] Cm7 decomposition

**Issues encountered:**
- Minor ARCH API deviation: `decomposeChordToShape` takes a `focus` parameter not in original ARCH spec, needed for dot-only centroid computation

---

### Phase 4 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] Decompose all MVP chord types for root C — all Shape fields valid
- [x] Coverage invariant: `covered_pcs ∪ dot_pcs == chord_pcs` for all tested chords
- [x] Shape invariant: `main_tri is null` ↔ `quality ∈ {dim, aug}`
- [x] Deterministic: same inputs → identical shape

**Test totals:** 22 placement tests + 73 prior = 95 total

**Review notes:**
- Greedy adjacent-triangle expansion with 3-tier tie-break (new pc count > distance > TriId) is simple and deterministic
- `clusterCentroid` deduplicates shared vertices via coordinate string key
- Aug triad discovery was a valuable find — updated HC-D5 across all three spec docs

**Doc sync:**
- ARCH_HARMONY_CORE.md: HC-D5 revised for aug triads
- SPEC.md: D-7 updated, glossary, known limitations
- UX_SPEC.md: visual encoding updated for aug dot clusters
- DEVPLAN: Current Status advanced to Phase 4b

**Commit:** `883a58f` — "Phase 4: Chord placement & shape decomposition"

---

### Phase 5a: mapProgressionToShapes
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/progression.ts`: `mapProgressionToShapes(chords, initialFocus, indices)`
- Created `src/__tests__/progression.test.ts`

**Tests passed:**
- [x] Empty progression → empty array
- [x] Single chord placed at initialFocus
- [x] Two-chord progression: second focus = first centroid
- [x] Three-chord chain focus (C → F → G)
- [x] Dim chord passes focus through (C → Bdim → Am): centroid preserved
- [x] All shapes satisfy coverage invariant across 7-chord diatonic progression

**Issues encountered:**
- None

**Decisions made:**
- HC-DEV-D8: New file `src/progression.ts` for progression mapping (closed)

---

### Phase 5b: Progression path geometry
Date: 2026-02-13
Status: Complete

**Tests passed:**
- [x] ii–V–I centroids form connected path (distance < 5 between consecutive)
- [x] I–IV–V–I returns to approximately same region (distance < 4)
- [x] Centroids are fractional (not rounded to integers)
- [x] Long progression (12 chords): no NaN/Infinity
- [x] Deterministic: same input → identical output

**Issues encountered:**
- None

---

### Phase 5 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] All shapes from progression mapping satisfy Shape invariants
- [x] Deterministic: same input → identical output
- [x] 12-chord progression completes without degenerate values

**Test totals:** 11 progression tests + 95 prior = 106 total

**Review notes:**
- `mapProgressionToShapes` is pure glue — ~10 lines of logic over Phase 4 APIs
- Chain focus threading is clean: `focus = shape.centroid_uv` after each chord
- Dot-only chords (dim/aug) pass focus through unchanged, which is correct per HC-D11/HC-D9

**Doc sync:**
- DEVPLAN: HC-DEV-D8 closed; Current Status advanced to Phase 5b

**Commit:** `03e2a43` — "Phase 5: Progression mapping (mapProgressionToShapes with chain focus)"

---

### Phase 6a: API surface assembly
Date: 2026-02-13
Status: Complete

**Changes:**
- Rewrote `src/index.ts` as barrel export file: 14 public functions + 14 types
- Updated ARCH_HARMONY_CORE.md Section 11 to match actual function signatures
- Created `src/__tests__/api-surface.test.ts`

**Tests passed:**
- [x] All 14 public functions exported and callable (pc, nodeId, triId, triVertices, getTrianglePcs, edgeId, buildWindowIndices, getAdjacentTriangles, getEdgeUnionPcs, parseChordSymbol, computeChordPcs, placeMainTriad, decomposeChordToShape, mapProgressionToShapes)
- [x] Exactly 14 functions exported (no extras)
- [x] `coord` not exported (internal helper)
- [x] `triEdges` not exported (internal helper)
- [x] `triCentroid` not exported (internal helper)
- [x] `dist2` not exported (internal helper)
- [x] `pc` returns a number
- [x] `nodeId` returns a branded string
- [x] `buildWindowIndices` returns object with expected maps (edgeToTris, nodeToTris, sigToTris, triIdToRef, bounds)
- [x] `parseChordSymbol` returns object with root_pc, quality, extension

**Issues encountered:**
- ARCH Section 11 had 3 signature mismatches vs implementation (getAdjacentTriangles missing indices param, computeChordPcs taking 3 args not 1, decomposeChordToShape extra focus param). Updated ARCH to match reality.

**Decisions made:**
- Export `nodeId`, `triId`, `edgeId`, `triVertices` in addition to the 9 ARCH-spec functions — consumers need ID construction and vertex positions for rendering

---

### Phase 6b: End-to-end integration tests
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/__tests__/integration.test.ts`

**Tests passed:**
- [x] Cmaj7: parse → place → decompose → verify shape (coverage invariant, root_vertex_index, centroid)
- [x] Bdim: parse → place → decompose → verify dot-only shape
- [x] Edge union: shared edge → getEdgeUnionPcs → verify 4 pcs {0,4,7,11}
- [x] Progression Dm → G7 → Cmaj7: 3 shapes with chained centroids, connected path
- [x] Different window sizes → same chord produces different (but valid) placement
- [x] Invalid input produces clear errors (XYZ, empty, Caug7 all throw)
- [x] No circular dependencies (all imports resolve via barrel)
- [x] Module has zero runtime dependencies on UI, audio, or storage

**Issues encountered:**
- None

---

### Phase 6 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] Full test suite passes (137 tests across 10 files)
- [x] No circular dependencies within the module
- [x] Module has zero runtime dependencies on UI, audio, or storage code
- [x] All API calls with invalid input produce clear errors

**Test totals:** 23 API surface + 8 integration + 106 prior = 137 total

**Review notes:**
- Barrel export in index.ts is clean and organized by concern (coords, IDs, indexing, chords, placement, progression)
- ARCH Section 11 now documents actual signatures with notes explaining deviations from original spec
- Integration tests exercise the full consumer workflow through the public API only — no internal imports

**Doc sync:**
- ARCH_HARMONY_CORE.md: Section 11 rewritten with full signatures and notes
- DEVPLAN: HC-DEV-D8 closed; Current Status advanced to Phase 6b

**Commit:** (pending — will be committed with Phase 6)

---

### Phase 6c: Performance & edge case tests
Date: 2026-02-13
Status: Complete

**Changes:**
- Created `src/__tests__/perf-edge.test.ts`

**Tests passed:**
- [x] buildWindowIndices for 10×10 window completes in < 50ms
- [x] 50-chord progression completes in < 100ms
- [x] 100-chord progression completes in < 200ms
- [x] Large window (20×20) builds in < 500ms (882 triangles)
- [x] Large negative/positive coordinates produce valid pcs (±100)
- [x] nodeId with large coordinates produces valid string
- [x] Zero-area window produces 2 triangles
- [x] Negative-anchored window works correctly
- [x] Asymmetric window works correctly
- [x] Every enharmonic root (17 spellings) parses correctly
- [x] Every MVP chord type × 12 roots produces valid pcs (120 combinations)
- [x] Every MVP chord type decomposes with valid Shape invariants (root C)
- [x] Same set for root F# (non-zero root stress test)
- [x] Focus far from origin still finds valid placement
- [x] Boundary edge returns null from getEdgeUnionPcs (or valid result)
- [x] Non-existent edge returns null from getEdgeUnionPcs
- [x] Every interior edge has exactly 4 union pcs
- [x] Progression of all same chord is stable (focus converges)
- [x] Alternating dim/aug progression never produces NaN
- [x] Progression with non-origin initial focus

**Issues encountered:**
- Triangle count for 20×20 window was 882, not 800 as initially calculated (off-by-one in inclusive bounds formula). Fixed assertion.
- Unused `getAdjacentTriangles` import found during code review — removed.

**Test totals:** 21 perf/edge tests + 137 prior = 158 total

---

### Phase 7a: Optimization
Date: 2026-02-13
Status: Complete

**Changes:**
- Refactored `src/indexing.ts`: `buildWindowIndices` now computes `triVertices` once per triangle and derives edges/pcs from that single result (eliminates 2 redundant calls per triangle)
- Added `edgesFromVerts()` internal helper to compute edges from pre-computed vertices
- Refactored `src/indexing.ts`: `getEdgeUnionPcs` now uses array with `includes()` instead of Set for small fixed-size arrays
- Refactored `src/placement.ts`: `clusterCentroid` now uses array with coordinate comparison instead of Map<string, NodeCoord>

**Tests passed:**
- [x] All 168 existing tests pass after optimization
- [x] buildWindowIndices produces identical output (verified via existing tests)
- [x] getEdgeUnionPcs produces identical sorted results
- [x] clusterCentroid produces identical centroids

**Issues encountered:**
- None

---

### Phase 7b: Simplification
Date: 2026-02-13
Status: Complete

**Changes:**
- Removed redundant `parse()` helper from `src/__tests__/integration.test.ts` — now uses `parseChordSymbol` directly
- Removed redundant `parse()` helper from `src/__tests__/progression.test.ts` — now uses `parseChordSymbol` directly
- Added JSDoc to `placeMainTriad` documenting why `main_triad_pcs` re-sort is required (sigToTris keys are sorted)
- Updated `edgeId` parameter types from inline `{ u: number; v: number }` to `NodeCoord` in `src/edges.ts`

**Tests passed:**
- [x] All tests pass after removing parse() helper
- [x] edgeId accepts NodeCoord parameters

**Issues encountered:**
- None

**Rationale:**
- The `parse()` helper was calling `computeChordPcs` twice — once inside `parseChordSymbol` and once explicitly. Since `parseChordSymbol` already returns a complete `Chord` with computed pcs, the wrapper was redundant.

---

### Phase 7c: Disambiguation
Date: 2026-02-13
Status: Complete

**Changes:**
- Enhanced `NodeCoord` JSDoc in `src/types.ts` to clarify dual semantics (integer lattice nodes vs. fractional centroid points)
- Added `CentroidCoord` type alias in `src/types.ts` for documentation clarity (zero runtime cost)
- Exported `CentroidCoord` from `src/index.ts` barrel
- Added JSDoc to `coord()` helper in `src/coords.ts` explaining it's an internal test utility, not exported from barrel
- Added JSDoc to `Chord.chord_pcs` documenting insertion order (triad intervals then extensions, NOT sorted)
- Added JSDoc to `Chord.main_triad_pcs` documenting interval order [root, 3rd, 5th] (NOT sorted by pc value)

**Tests passed:**
- [x] CentroidCoord exported from barrel (verified via import)
- [x] All existing tests pass

**Issues encountered:**
- None

**API changes:**
- New type export: `CentroidCoord` (alias for `NodeCoord`, documentation-only purpose)

---

### Phase 7d: Bug Prevention & Edge Cases
Date: 2026-02-13
Status: Complete

**Changes:**
- Added empty string guard in `parseChordSymbol` in `src/chords.ts` — now throws `'Invalid chord symbol: ""'` immediately
- Added JSDoc to `ROOT_MAP` in `src/chords.ts` documenting enharmonic limitations (Cb, Fb, E#, B#, double-accidentals omitted for MVP)
- Added JSDoc to `getTrianglePcs` in `src/triangles.ts` documenting sort guarantee and per-call allocation

**Tests passed:**
- [x] parseChordSymbol("") throws with clear error message (tested in integration.test.ts)
- [x] All existing tests pass

**Issues encountered:**
- None

**Known limitations documented:**
- ROOT_MAP omits: Cb (=B), Fb (=E), E# (=F), B# (=C), all double-accidentals
- Can be added post-MVP if needed

---

### Phase 7 Completion
Date: 2026-02-13

**Phase tests passed:**
- [x] All 168 tests pass
- [x] No regressions from optimization changes
- [x] API surface unchanged (16 functions, new CentroidCoord type alias)
- [x] No linter errors

**Test totals:** 168 tests across 11 files (10 tests added since Phase 6c via test file changes)

**Review notes:**
- Optimization in `buildWindowIndices` reduces vertex computation from 3× to 1× per triangle
- `getEdgeUnionPcs` optimization eliminates Set allocation for what is always a 3+3→4 element union
- `clusterCentroid` optimization eliminates string key allocation for small vertex sets (4-6 vertices)
- Test redundancy removed — `parse()` helper was computing pcs twice
- Type disambiguation via JSDoc and `CentroidCoord` alias improves code clarity without runtime cost
- Empty string edge case now produces clear error instead of confusing "undefinedundefined" failure

**Doc sync:**
- DEVPLAN.md: Phase 7 added with all sub-phases
- DEVLOG.md: Phase 7 log entries added
- ARCH_HARMONY_CORE.md: No changes needed (internal optimizations don't affect architecture)

**Files modified:**
| File | Changes |
|------|---------|
| `src/types.ts` | Enhanced `NodeCoord` JSDoc, added `CentroidCoord` alias, documented `chord_pcs`/`main_triad_pcs` ordering |
| `src/coords.ts` | Documented `coord()` helper purpose |
| `src/edges.ts` | Changed `edgeId` params to use `NodeCoord` type |
| `src/triangles.ts` | Documented `getTrianglePcs` sort guarantee |
| `src/indexing.ts` | Optimized `buildWindowIndices` (single `triVertices` call), optimized `getEdgeUnionPcs` (no Set) |
| `src/chords.ts` | Added empty string guard, documented enharmonic limitations |
| `src/placement.ts` | Optimized `clusterCentroid`, documented `main_triad_pcs` re-sort rationale |
| `src/index.ts` | Exported `CentroidCoord` type |
| `src/__tests__/integration.test.ts` | Removed redundant `parse()` helper |
| `src/__tests__/progression.test.ts` | Removed redundant `parse()` helper |

---

## Template

Each entry follows this format:

```
### Phase Xa: [Step Title]
Date: YYYY-MM-DD
Status: Complete | Partial | Blocked

**Changes:**
- [files created/modified]

**Tests passed:**
- [x] test description
- [ ] test description (if failed, explain)

**Issues encountered:**
- [description, resolution]

**Lessons learned:**
- [anything useful for future steps]

**Decisions made:**
- [reference HC-DEV-D# if applicable]
```

---

## Phase Completion Template

```
### Phase X Completion
Date: YYYY-MM-DD

**Phase tests passed:**
- [x] / [ ] each phase-level test

**Review notes:**
- [code review observations, simplifications made]

**Doc sync:**
- [any updates to ARCH_HARMONY_CORE.md, DEVPLAN.md, or README.md]
```
