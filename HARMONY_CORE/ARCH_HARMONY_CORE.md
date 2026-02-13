# ARCH_HARMONY_CORE.md

Version: Draft 0.4
Date: 2026-02-13

---

## 1. Purpose and Scope

Harmony Core is the pure-logic subsystem responsible for:

* Tonnetz lattice coordinate system
* node, triangle, and edge indexing
* chord parsing and pitch-class computation
* chord → Tonnetz shape decomposition
* progression modeling (harmonic paths)
* edge-based union chord computation
* providing deterministic harmonic geometry to other subsystems

Harmony Core is **UI-agnostic, audio-agnostic, and storage-agnostic**.

---

## 2. Tonnetz Coordinate System

### HC-D1: Pitch-class mapping

Status: Closed

Each lattice node is represented by integer coordinates:

```
NodeCoord: (u, v)
```

Pitch class mapping:

```
pc(u,v) = (pc0 + 7*u + 4*v) mod 12
```

Default origin:

* `pc0 = 0` (C)

This mapping ensures:

* horizontal movement corresponds to fifth motion
* diagonal axes correspond to third relations

---

## 3. Node, Triangle, and Edge Definitions

### 3.1 Node

```
NodeId = "N:u,v"
```

### 3.2 Triangle

Triangle is defined by:

```
TriRef:
  orientation: "U" | "D"
  anchor: (u, v)
```

Triangle ID:

```
TriId = "T:orientation:u,v"
```

### HC-D2: Triangle orientation convention

Status: Closed

Up triangle vertices:

```
(u,v)
(u+1,v)
(u,v+1)
```

Down triangle vertices:

```
(u+1,v+1)
(u+1,v)
(u,v+1)
```

---

### 3.3 Edge

Edge ID is canonical unordered node pair:

```
EdgeId = "E:nodeA|nodeB"
```

Edges enable adjacency detection, extension-triangle discovery, and union chord computation.

---

## 4. Indexing Scheme (Active Window)

Harmony Core operates on a **finite active lattice window** supplied by the Rendering subsystem.

### HC-D3: Window ownership

Status: Closed

* Rendering/UI defines the visible `(u,v)` window bounds.
* Harmony Core builds indices for that window (plus margin).

---

### 4.1 Window index maps

#### edgeToTris

```
Map<EdgeId, TriId[]>
```

Used for adjacency lookup and union chord computation.

#### nodeToTris

```
Map<NodeId, TriId[]>
```

Used for node-based queries.

#### sigToTris

Pitch-set signature index:

```
sig(tri) = sorted(pcs(tri)).join("-")
Map<sig, TriId[]>
```

Used to place chord triads near focus coordinates.

---

## 5. Chord Model

### HC-D4: MVP chord grammar

Status: Closed

Supported types (MVP):

* triads: maj, min, dim, aug
* extensions: 6, add9, 6/9, maj7, 7, m7

Excluded from MVP:

* extended chords built on augmented triads (e.g., aug7, augMaj7)

Augmented extended chords are deferred to a future grammar expansion (see Section 12).

Chord structure:

```
Chord:
  root_pc
  quality
  extensions
  chord_pcs
  main_triad_pcs
```

---

## 6. Chord Placement and Shape Decomposition

### 6.1 Diminished and augmented triad handling

**HC-D5: Diminished and augmented triads as dot clusters**
Status: Closed (revised 2026-02-13)

Diminished triads do not form triangles in the (7u + 4v) lattice because their interval structure (stacked minor thirds) does not correspond to adjacent nodes.

Augmented triads similarly do not form triangles: their interval structure (stacked major thirds) places all three nodes along the same diagonal axis rather than forming a closed triangle.

Both are represented entirely as `dot_pcs` clusters positioned near the focus coordinate, with no `main_tri` or `ext_tris`. The `main_tri` field is `null` for these shapes.

---

### 6.2 Main triangle placement

**HC-D6: Placement strategy**
Status: Closed

Algorithm:

1. if triad is diminished or augmented → emit dot-only shape (see HC-D5)
2. compute triad pitch signature
3. find candidate triangles via `sigToTris`
4. select candidate closest to focus `(u0,v0)` using lattice distance
5. output as main triangle

Focus coordinate supplied by UI.

---

### 6.3 Extension triangle discovery

**HC-D7: Decomposition algorithm**
Status: Closed

Procedure:

1. cluster = {main triangle}
2. covered = pcs(main triangle)
3. iteratively:

   * find adjacent triangles
   * keep only those whose pitch sets are subset of chord pitch set
   * select candidate adding maximal uncovered tones
   * tie-break: minimal distance to main triangle, then lexicographic ID
4. stop when no triangle adds new tones
5. remaining tones → dot_pcs

Maximum extension triangles (MVP): configurable (default 2).

---

### 6.4 Simplification mode

**HC-D8: Simplification**
Status: Deferred

Exact decomposition is default.
Optional triangle-only simplification may be added later.

---

## 7. Shape Representation

```
Shape:
  chord
  main_tri: TriRef | null
  ext_tris: TriRef[]
  dot_pcs: int[]
  covered_pcs: Set<int>
  root_vertex_index: 0|1|2 | null
  centroid_uv: (u,v)
```

`main_tri` and `root_vertex_index` are `null` for dot-only shapes (e.g., diminished and augmented triads).

### HC-D9: Centroid computation

Status: Closed

Centroid is computed as the arithmetic mean of all unique vertex coordinates in the shape's triangle cluster:

```
centroid_uv = mean of all unique (u,v) among main_tri and ext_tris vertices
```

For dot-only shapes (no triangles), centroid defaults to the focus coordinate used during placement.

---

## 8. Edge Union Chord

### HC-D10: Edge-to-union-chord computation

Status: Closed

Selecting an edge plays the **union** of the pitch classes of the two triangles sharing that edge.

Algorithm:

1. look up `edgeToTris[edgeId]` → `[triA, triB]`
2. compute `pcs(triA) ∪ pcs(triB)`
3. return union as unordered pitch-class set (typically 4 pitch classes)

Boundary edges (shared by only one triangle within the active window) are excluded from edge selection.

Public API provides `getEdgeUnionPcs(edgeId, indices)`.

---

## 9. Progression Focus Policy

### HC-D11: Chain focus policy

Status: Closed

When mapping a progression to shapes, each chord's placement focus is derived from the preceding chord's centroid:

```
focus_0 = initial focus (supplied by UI, e.g., viewport center)
focus_n = centroid_uv(shape_{n-1})   for n > 0
```

If the resulting path drifts beyond the visible viewport, the user corrects via pan/zoom. The harmonic subsystem does not constrain placement to viewport bounds.

---

## 10. Progression Model

```
HarmonyEvent:
  t
  kind
  chord
  shape
```

Progression = ordered list of events.
Event-stream storage handled by Persistence subsystem.

---

## 11. Public API (Module Interface)

```text
// Coordinate system & ID construction
pc(u, v) → number
nodeId(u, v) → NodeId
triId(tri) → TriId
triVertices(tri) → [NodeCoord, NodeCoord, NodeCoord]
getTrianglePcs(tri) → number[]
edgeId(a, b) → EdgeId

// Window indexing
buildWindowIndices(bounds) → WindowIndices
getAdjacentTriangles(tri, indices) → TriId[]
getEdgeUnionPcs(edgeId, indices) → number[] | null

// Chord parsing
parseChordSymbol(text) → { root_pc, quality, extension }
computeChordPcs(rootPc, quality, extension) → { chord_pcs, main_triad_pcs }

// Placement & decomposition
placeMainTriad(chord, focus, indices) → TriRef | null
decomposeChordToShape(chord, mainTri, focus, indices) → Shape

// Progression mapping
mapProgressionToShapes(chords, initialFocus, indices) → Shape[]
```

Notes:
- `getAdjacentTriangles` requires `indices` for edge-based adjacency lookup.
- `computeChordPcs` takes decomposed args (rootPc, quality, extension), not a Chord object, to allow use independent of the parser.
- `decomposeChordToShape` takes a `focus` parameter (in addition to `mainTri` and `indices`) for dot-only centroid computation (HC-D9 fallback).
- `mapProgressionToShapes` uses chain focus policy (HC-D11). The `initialFocus` parameter sets the focus for the first chord; subsequent chords use the preceding shape's centroid.

---

## 12. Testing Strategy

* coordinate mapping tests
* adjacency correctness tests
* chord parsing tests
* decomposition correctness tests
* deterministic placement tests
* diminished triad dot-cluster tests
* augmented triad dot-cluster tests
* edge union pitch-class tests
* chain focus progression placement tests

---

## 13. Decision Summary

* HC-D1: Tonnetz pitch mapping (7u + 4v)
* HC-D2: triangle orientation convention
* HC-D3: renderer supplies window bounds
* HC-D4: MVP chord grammar (aug extended excluded)
* HC-D5: diminished and augmented triads as dot clusters
* HC-D6: nearest-placement strategy
* HC-D7: greedy adjacent-triangle decomposition
* HC-D8: simplification deferred
* HC-D9: centroid as mean of unique vertex coordinates
* HC-D10: edge union chord computation
* HC-D11: chain focus policy for progressions

---

## 14. Future Extensions

* extended chord grammars (9, 11, 13, altered)
* augmented extended chords (aug7, augMaj7, etc.)
* corpus-scale harmonic graph indexing
* Tonnetz-based similarity metrics
* transformation-based harmonic navigation
