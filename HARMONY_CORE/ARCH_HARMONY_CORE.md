# ARCH_HARMONY_CORE.md

Version: Draft 0.5
Date: 2026-02-22

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
* extensions: 6, add9, 6/9, maj7, 7, m7, dim7, m7b5

Excluded from MVP:

* extended chords built on augmented triads (e.g., aug7, augMaj7)
* extended tensions (9, 11, 13) and compound extensions (maj9, 7#9, etc.)

Augmented extended chords are deferred to a future grammar expansion (see Section 12). `dim7` and `m7b5` were added per POL-D7.

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
4. select candidate closest to focus `(u0,v0)` using **world-coordinate** Euclidean distance:
   ```
   dx = (a.u - b.u) + (a.v - b.v) * 0.5
   dy = (a.v - b.v) * √3/2
   dist² = dx² + dy²
   ```
   (Revised per MVP Polish Entry 16 — lattice-coordinate distance distorts diagonal comparisons in the equilateral layout.)
5. output as main triangle

Focus coordinate supplied by UI (or by the progression mapper — see HC-D11).

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
  tonal_centroid_uv: (u,v)
  placed_nodes: NodeCoord[]
```

`main_tri` and `root_vertex_index` are `null` for dot-only shapes (e.g., diminished and augmented triads).

`placed_nodes` contains the resolved lattice coordinates for each chord tone:
- **Triangulated shapes:** unique triangle vertices from `main_tri` + `ext_tris`, plus nearest lattice nodes for any `dot_pcs` (extension notes not covered by triangles).
- **Dot-only shapes:** nodes resolved via greedy chain (root node nearest to focus, then each subsequent pc nearest to any already-placed node). This matches the grid-highlighter's display algorithm.

### HC-D9: Centroid computation

Status: Closed (revised 2026-02-18 per POL-D15)

Centroid is always set to the **root vertex position** — the lattice node whose pitch class matches the chord's root.

**Triangulated shapes (maj, min):**
```
centroid_uv = mainVerts[root_vertex_index]   (integer lattice coordinate)
```
Fallback: if root vertex cannot be identified (should not occur for valid chords), falls back to the arithmetic mean of all unique vertices across the triangle cluster.

**Dot-only shapes (dim, aug):**
```
centroid_uv = nearest lattice node matching root pitch class, relative to focus
```
This places the centroid on the root note (musically intuitive) and aligns with the grid-highlighter's greedy chain anchor. See POL-D13.

**Consequences:**
- All chord types consistently use root-note position as centroid
- Progression path traces root motion (orange dots sit on root vertices)
- Chain focus (HC-D11) propagates root-to-root, producing tighter placements
- Centroids are integer lattice coordinates (not fractional cluster centers)

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

### HC-D11: Blended chain focus policy

Status: Closed (revised 2026-02-20 per MVP Polish Entry 18)

When mapping a progression to shapes, each chord's placement focus is a blend of the previous chord's triangle centroid and a running cluster center:

```
focus_0        = initial focus (supplied by UI, e.g., viewport center)
triCentroid_n  = geometric centroid of shape_{n-1}'s main triangle
                 (arithmetic mean of three vertices, NOT centroid_uv which is the root vertex)
clusterCenter  = running mean of all triCentroids placed so far
focus_n        = CHAIN_BLEND × triCentroid_{n-1} + (1 − CHAIN_BLEND) × clusterCenter
```

**Constants:**
- `CHAIN_BLEND = 0.61` — weights the previous chord's centroid slightly over the cluster center. Tuned empirically to balance local continuity (chain) with global compactness (cluster gravity).
- `REUSE_THRESHOLD = 1.5` (world units) — distance-gated root reuse (see below).

**Why triangle centroid, not root vertex:** `centroid_uv` (HC-D9) is the root vertex position, used for path rendering. For placement focus, using a triangle corner systematically overshoots by ~50% per step because the focus starts at the far corner rather than the geometric center. Triangle centroid (`triCentroid`) eliminates this bias.

**Why cluster gravity:** Pure chain focus (previous centroid only) has no memory of where the overall cluster lives. When equidistant candidates exist, it can pick the directionally wrong one (observed in Adagio's `Gm Cm → D7`). The running cluster center acts as a gravity well that biases placement toward the existing cluster.

**Distance-gated root reuse:**

`mapProgressionToShapes` maintains a `placedRoots: Map<number, NodeCoord>` remembering the first placement of each root pitch class. When the same root recurs:
- `proximityTri` = candidate nearest to blended focus (normal behavior)
- `reuseTri` = candidate nearest to prior root placement
- Reuse wins if `reuseDist ≤ proxDist × REUSE_THRESHOLD` (within 50% of proximity distance)

This prevents visually confusing leaps when a root repeats (e.g., `Dm C Dm` → second Dm snaps to first Dm's position).

**All distances** in both `placement.ts` and `progression.ts` use world-coordinate Euclidean distance (see HC-D6), ensuring visual perception matches algorithmic selection.

**Known limitations:**
- Giant Steps: symmetric tritone jumps produce visually spreading paths. The local greedy algorithm cannot resolve this — requires a future two-pass global optimizer.
- Tristan chord Am: local algorithm picks the geometrically nearest Am, which may not be the musically expected one. No `CHAIN_BLEND` value fixes this.

If the resulting path drifts beyond the visible viewport, the camera auto-centers to frame the entire path (POL-D20, via `camera.fitToBounds()` in the integration module). The harmonic subsystem does not constrain placement to viewport bounds.

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
- `mapProgressionToShapes` uses blended chain focus policy (HC-D11). The `initialFocus` parameter sets the focus for the first chord; subsequent chords use a blend of the preceding shape's triangle centroid and the running cluster center (`CHAIN_BLEND = 0.61`). Distance-gated root reuse (`REUSE_THRESHOLD = 1.5`) snaps repeated roots to their prior placement when nearby.

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
* HC-D9: centroid as root vertex position (revised per POL-D15)
* HC-D10: edge union chord computation
* HC-D11: blended chain focus policy for progressions (revised: centroid focus + cluster gravity + root reuse)

---

## 14. Future Extensions

* extended chord grammars (9, 11, 13, altered)
* augmented extended chords (aug7, augMaj7, etc.)
* corpus-scale harmonic graph indexing
* Tonnetz-based similarity metrics
* transformation-based harmonic navigation
