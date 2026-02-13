# SPEC.md — Tonnetz Interactive Harmonic Explorer

Version: Draft 0.4
Date: 2026-02-13

---

# Product Vision

## Problem Statement

Musicians understand harmonic relationships conceptually but lack intuitive tools that visualize harmonic motion spatially and interactively. Existing chord charts and theory diagrams do not effectively show voice-leading proximity, harmonic transformations, or progression geometry.

## Solution

Develop an interactive Tonnetz-based harmonic exploration application that allows users to:

* play chords directly from a Tonnetz grid
* visualize chord progressions as geometric paths
* hear smooth voice-led harmonic motion
* explore harmonic relationships spatially
* later: analyze harmonic corpora as graph structures

## Target User

* jazz and contemporary musicians
* composers and improvisers
* music theory students and educators
* music technology researchers

---

# Requirements

## Functional Requirements (MVP)

* interactive Tonnetz lattice
* triangle selection → triad playback
* edge selection → union chord playback (two adjacent triangles, typically 4 pitch classes)
* adjacent triangle selection → extended chord playback
* paste chord progression → render path + playback
* supported chord types:

  * triads (maj, min, dim, aug)
  * 6, add9, 6/9
  * maj7, 7, m7
* local progression save/load
* URL-based progression sharing

### MVP Chord Limitations

* diminished triads are represented as dot clusters (not triangles) on the lattice
* extended chords built on augmented triads (e.g., aug7, augMaj7) are excluded from MVP

---

## Non-Functional Requirements

* responsive desktop and mobile interaction
* modular subsystem architecture
* deterministic harmonic placement
* client-side operation (no accounts required)
* portability to mobile wrappers

---

# Design Specifications

## Technical Architecture

### Subsystem Structure

The system is divided into the following documents:

* SPEC.md (product-level specification)
* ARCH_HARMONY_CORE.md
* ARCH_RENDERING_UI.md
* ARCH_AUDIO_ENGINE.md
* ARCH_PERSISTENCE_DATA.md
* ARCH_DEPLOYMENT_HOSTING.md
* UX_SPEC.md

Subsystem responsibilities:

| Subsystem          | Responsibility                                                   |
| ------------------ | ---------------------------------------------------------------- |
| Harmony Core       | Tonnetz math, chord parsing, decomposition, progression modeling |
| Rendering/UI       | lattice rendering, interaction handling, animations              |
| Audio Engine       | chord voicing, synthesis, playback scheduling                    |
| Persistence/Data   | progression storage, import/export, URL sharing                  |
| Deployment/Hosting | build, hosting topology, caching/versioning                      |
| UX                 | detailed definitions for interaction behaviors                   |


### Development Governance Model

* System architecture is defined by SPEC and subsystem architecture documents.
* UX interaction design is defined in **UX_SPEC.md**, which acts as a cross-cutting design reference affecting multiple modules.
* UX decisions that affect subsystem interfaces are incorporated into architecture documents before module development begins.
* Interaction Architecture precedes module implementation and defines interaction vocabulary, layout zones, and interface contracts affecting multiple subsystems.
* After Interaction Architecture completion, subsystems are developed in **parallel module work tracks**, each maintaining:

  * a module-specific DEVPLAN
  * a module-specific DEVLOG
* SPEC, UX_SPEC, and architecture documents together form the **shared source of truth**.
* A **master integration track** coordinates subsystem integration milestones and manages interface-level changes across modules.

---

# Decisions

### Decision Log

```
D-1: Modular multi-document architecture
Date: 2026-02-12
Status: Closed
Priority: Critical
Decision:
Use one main spec plus subsystem architecture documents.
Rationale:
Supports parallel development, maintainability, and future platform portability.
```

```
D-2: Tonnetz as primary harmonic representation
Date: 2026-02-12
Status: Closed
Priority: Critical
Decision:
All harmonic modeling and visualization occur in Tonnetz coordinate space.
Rationale:
Enables geometric voice-leading representation and harmonic graph analytics.
```

```
D-3: Static-first deployment model
Date: 2026-02-12
Status: Closed
Priority: Critical
Decision:
Deploy MVP as static web application hosted on an existing server.
Rationale:
Simplifies infrastructure and enables rapid iteration without backend systems.
```

```
D-4: Local-first persistence and URL-based sharing
Date: 2026-02-12
Status: Closed
Priority: Important
Decision:
Store progressions locally and enable sharing via URL-encoded payloads.
Rationale:
Avoids account systems and backend storage while supporting collaboration.
```

```
D-5: Explicit subsystem interface contracts
Date: 2026-02-12
Status: Closed
Priority: Important
Decision:
Each subsystem defines a public module API; inter-module communication occurs exclusively through these interfaces.
Rationale:
Ensures modularity, testability, and future mobile portability.
```

```
D-6: Chain focus policy for progression placement
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Progression chord placement uses chain focus: each chord's placement focus is the preceding chord shape's centroid.
User corrects viewport drift via pan/zoom.
Rationale:
Simplest policy that produces geometrically coherent progression paths.
See HC-D11 in ARCH_HARMONY_CORE.md.
```

```
D-7: Diminished triads as dot clusters
Date: 2026-02-13
Status: Closed
Priority: Important
Decision:
Diminished triads do not form triangles in the Tonnetz lattice and are represented as dot-cluster shapes.
Rationale:
Stacked minor-third intervals do not correspond to adjacent nodes in the (7u + 4v) lattice.
See HC-D5 in ARCH_HARMONY_CORE.md.
```

```
D-8: Augmented extended chords excluded from MVP
Date: 2026-02-13
Status: Closed
Priority: Minor
Decision:
Extended chords built on augmented triads (aug7, augMaj7, etc.) are excluded from MVP chord grammar.
Rationale:
Augmented triads are uncommon in target repertoire. Simplifies MVP scope; deferred to future grammar expansion.
See HC-D4 in ARCH_HARMONY_CORE.md.
```

---

# Development Phases

## Phase 1: Interactive Tonnetz Instrument (MVP)

**Objective:**
Deliver playable harmonic instrument with progression visualization.

**Steps:**

1. Harmony Core lattice/indexing implementation
2. SVG Tonnetz rendering and interaction
3. Audio engine playback
4. progression parsing and path visualization
5. local persistence and URL sharing

**Tests:**

* chord playback correctness
* adjacency detection
* edge union chord correctness
* progression rendering accuracy
* interaction latency

---

## Phase 2: Progression Tools

* save/load library UI
* loop playback controls
* transposition via Tonnetz motion
* improved voice-leading engine

---

## Phase 3: Harmonic Analytics Platform

* corpus ingestion
* harmonic transition graph construction
* similarity search
* style clustering

---

# Testing Strategy

## Unit Tests

* Tonnetz coordinate math
* adjacency indexing
* chord parsing
* chord decomposition
* edge union pitch-class computation
* diminished triad dot-cluster generation

## Integration Tests

* chord playback synchronization
* edge selection → 4-note playback
* progression playback timing
* renderer interaction correctness

## Manual Acceptance Tests

* create ii–V–I via grid
* paste progression and verify playback
* drag progression across lattice
* verify mobile touch responsiveness
* select edge and verify 4-note playback

---

# Future Enhancements

## Priority 1

* MIDI export
* DAW integration
* extended chord visualization (9/11/13)
* augmented extended chords (aug7, augMaj7, etc.)

## Priority 2

* harmonic resolution suggestions
* corpus density heatmaps

## Priority 3

* AI-assisted reharmonization
* Tonnetz similarity search engine

---

# Known Limitations (v1)

* limited chord grammar (no augmented extended chords)
* diminished triads rendered as dot clusters, not triangles
* no shared progression library
* simple synthesis model
* minimal voice-leading optimization

---

# Glossary

* **Tonnetz** — geometric harmonic lattice representing pitch relationships
* **Triangle** — triad representation on the lattice (maj, min, aug only; dim uses dots)
* **Shape** — chord representation (triangles + dots)
* **Dot Cluster** — non-triangulated pitch-class representation for chords without lattice triangles
* **Edge Union Chord** — 4-note chord formed by the pitch-class union of two adjacent triangles
* **Chain Focus** — progression placement policy where each chord's focus is the preceding shape's centroid
* **Progression Path** — ordered sequence of Tonnetz shapes
