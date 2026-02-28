# Tonnetz — Interactive Harmonic Explorer

A web-based instrument for exploring harmonic relationships on a [Tonnetz](https://en.wikipedia.org/wiki/Tonnetz) lattice. Tap triangles to play chords, paste progressions to see them as geometric paths, and hear voice-led harmonic motion in real time.

**[Try it live →](https://www.mike-y.com/tonnetz/)**

---

## What it does

- **Play chords** by tapping triangles on an interactive Tonnetz grid
- **Edge selection** — tap between two triangles to play their 4-note union chord
- **Paste progressions** (e.g., `Dm7 G7 Cmaj7`) and watch them rendered as connected paths on the lattice
- **Voice-led playback** with greedy minimal-motion voice leading between chords
- **4 synth presets** (Soft Pad, Warm Pad, Cathedral Organ, Electric Organ) with staccato/legato toggle
- **Save & share** — progressions persist locally and can be shared via URL
- **26 curated progressions** spanning jazz standards, pop, classical, and modal harmony
- **Responsive** — works on desktop (sidebar) and mobile (hamburger overlay + floating transport)

### Supported chord types

Triads (maj, min, dim, aug) · 6 · add9 · 6/9 · maj7 · 7 · m7 · dim7 · m7♭5

Input cleaning handles common aliases: `ø`, `Δ`, `–` as minor, slash bass (stripped), sus, 9th shorthands.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| Bundler | Vite 6 |
| Rendering | SVG (no canvas, no framework) |
| Audio | Web Audio API — dual-oscillator pad synthesis, no samples |
| Persistence | `localStorage` + URL-fragment sharing |
| Testing | Vitest |
| UI framework | None — vanilla DOM |
| Hosting | Static files on Apache |

Zero runtime dependencies. The entire app is ~111 KB gzipped.

---

## Architecture

Five independent modules, each with its own `package.json`, `tsconfig.json`, and test suite:

```
┌─────────────────────────────────────────────┐
│              Integration Module              │
│  (wires everything together, owns startup)   │
├──────────┬──────────┬───────────┬────────────┤
│ Harmony  │Rendering │  Audio    │Persistence │
│  Core    │   /UI    │  Engine   │   /Data    │
│          │          │           │            │
│ lattice  │ SVG grid │ voicing   │ save/load  │
│ parsing  │ camera   │ synthesis │ URL encode │
│ placement│ gestures │ transport │ settings   │
│ shapes   │ hit-test │ scheduling│ schema     │
└──────────┴──────────┴───────────┴────────────┘
```

- **Harmony Core** — Tonnetz coordinate math, chord parsing, decomposition, chain-focus progression placement
- **Rendering/UI** — SVG scaffold, equilateral lattice transforms, camera (pan/zoom/pinch), hit-testing, gesture disambiguation, UI state machine
- **Audio Engine** — Voice-leading, dual-oscillator synthesis, `AudioTransport` with scheduled progression playback, loop, tempo control
- **Persistence/Data** — `localStorage` CRUD, URL-fragment encode/decode, settings, schema-versioned records
- **Integration** — Startup sequence, cross-module wiring, sidebar UI, chord input cleaning pipeline

Dependency rule: Integration imports from all four modules. No module imports from Integration. Only Harmony Core types are shared across modules.

### Numbers

| | |
|---|---|
| Source files | 60 |
| Test files | 57 |
| Total tests | 1,205+ |
| Lines of TypeScript | ~25,600 |
| Bundle size | 111 KB (39 KB gzip) |

---

## Running locally

```bash
# Prerequisites: Node.js (LTS)

# Install dependencies (each module is independent)
cd HARMONY_CORE && npm install && cd ..
cd RENDERING_UI && npm install && cd ..
cd AUDIO_ENGINE && npm install && cd ..
cd PERSISTENCE_DATA && npm install && cd ..
cd INTEGRATION && npm install

# Dev server
npm run dev         # opens at localhost:5173

# Build
npm run build       # outputs to dist/

# Preview production build
npm run preview     # opens at localhost:4173/tonnetz/
```

### Running tests

```bash
# Per module
cd HARMONY_CORE && npx vitest run      # 178 tests
cd RENDERING_UI && npx vitest run      # 375 tests
cd AUDIO_ENGINE && npx vitest run      # 305 tests
cd PERSISTENCE_DATA && npx vitest run  # 108 tests
cd INTEGRATION && npx vitest run       # 239 tests
```

No monorepo tooling (no Lerna/Nx/Turborepo). Each module is a standalone npm package.

---

## Project structure

```
Tonnetz/
├── HARMONY_CORE/          # Lattice math, chord parsing, shapes
├── RENDERING_UI/          # SVG rendering, camera, interaction
├── AUDIO_ENGINE/          # Web Audio synthesis, transport, scheduling
├── PERSISTENCE_DATA/      # localStorage, URL sharing, settings
├── INTEGRATION/           # App entry point, cross-module wiring
│   ├── src/
│   │   ├── main.ts        # Startup sequence
│   │   ├── sidebar.ts     # Two-tab sidebar UI
│   │   └── ...
│   ├── public/.htaccess   # Caching + security headers
│   └── vite.config.ts
├── DEPLOYMENT_HOSTING/    # Deployment architecture + runbook
├── MVP_POLISH/            # Polish phase devlogs
├── SPEC.md                # Product specification
└── UX_SPEC.md             # Interaction design spec
```

---

## Design decisions worth noting

- **No framework** — The DOM layer is small enough that vanilla TypeScript is simpler than React/Vue overhead. SVG is generated programmatically.
- **Equilateral geometry** — The lattice uses a proper equilateral triangle layout (not right triangles), so major and minor triads have identical visual shapes distinguished only by orientation (▲ = major, ▽ = minor).
- **Dot clusters** — Diminished and augmented triads don't form triangles on the Tonnetz (their intervals don't map to adjacent nodes), so they're rendered as dot clusters instead.
- **Chain focus** — When placing a progression, each chord is placed relative to the previous chord's centroid. This produces geometrically coherent paths but can drift across the lattice — the user corrects via pan/zoom.
- **No MIDI, no samples** — Everything is synthesized in real time via Web Audio oscillators. This keeps the bundle tiny and avoids asset loading.

---

## Roadmap

**Next up:**
- Transposition via Tonnetz motion
- Improved voice-leading engine
- MIDI export
- Extended chord visualization (9/11/13)

**Future:**
- Corpus ingestion + harmonic transition graphs
- Style clustering and similarity search
- AI-assisted reharmonization

---

## License

This project is not currently licensed for redistribution. All rights reserved.
