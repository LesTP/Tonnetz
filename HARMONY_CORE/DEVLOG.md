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
