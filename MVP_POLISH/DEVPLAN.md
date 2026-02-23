# DEVPLAN — MVP Polish Track

Module: MVP Polish (cross-cutting)
Version: 0.4
Date: 2026-02-21
References: SPEC.md, UX_SPEC.md, ARCH_AUDIO_ENGINE.md, ARCH_RENDERING_UI.md

---

## Cold Start Summary

**What this is:**
Product-level polish track for the Tonnetz Interactive Harmonic Explorer. All four subsystems are integrated and functional. This track covers UI layout, progression library, audio quality, placement heuristics, and mobile UAT.

**Predecessor:** `INTEGRATION/DEVPLAN.md` (closed). Design Passes 1–4 migrated to DEVLOG as Entries 0a–0e.

**Key constraints:**
- No new subsystem modules — changes touch RU, AE, HC, Integration, PD
- Sidebar: permanent on desktop, hamburger overlay on mobile
- Library: bundled static data, not user-generated
- Max 4 simultaneous voices; per-voice gain fixed at 0.24 (no dynamic normalization)
- Mobile UAT is a distinct phase, not a checkbox

**Gotchas:**
- `grid-highlighter.ts` mutates `layer-grid` directly — layout changes must not break this
- `injectCSS()` deduplicates by style ID — CSS changes require full page reload (not just HMR)
- Library data uses `LibraryEntry` type (extends PD schema with metadata)
- Mobile proximity radius 0.12 world units tuned on desktop — may need mobile adjustment (POL-D5)

---

## Current Status

**Phase:** Phases 0–3, header redesign, and Phase 4a (mobile touch + layout) complete. Next: Phase 3d (synthesis exploration), then Phase 4b–4d (remaining mobile UAT), then Phase 4e (node interaction), then Phase 5.
**Blocked/Broken:** None.
**Open decisions:** D14 (m7b5 triangles — deferred post-MVP).
**Known limitations:** Mobile audio crackling on budget tablets (see Entry 21); iOS Safari rendering + audio issues (see Entry 22). Giant Steps and Tristan chord placement deferred post-MVP.

---

## Completed Phases

### Phase 0: Pre-Polish Bug Fixes ✅

- **0a:** Interactive press = triad only, playback = full Shape (resolved as non-bug, POL-D6)
- **0b:** Chord grammar expansion — input cleaning (slash bass, ø, Δ, -, sus) + HC dim7/m7b5 (POL-D7)

### Phase 1: UI Layout Redesign ✅

Replaced three-zone layout with two-tab sidebar (Play | Library) in `INTEGRATION/src/sidebar.ts`. Transport controls ▶ ■ 🔁 ✕, tempo slider 20–960 BPM, info overlay modals. Title "Tone Nets". Active chord labels on path markers.

Key decisions: POL-D1 (sidebar), D9 (two tabs), D11 (transport), D15 (root vertex centroid), D16 (Root Motion / Tonal Centroid toggle), D17 (4 beats/chord, no collapsing).

### Phase 2: Progression Library ✅

26 curated progressions in `INTEGRATION/src/library/`. Three browsing views (All, By Genre, By Harmonic Feature). Expandable accordion cards (POL-D12). Library load → auto-switch to Play tab.

### Phase 3: Audio Quality ✅

**3a — Envelope Cleanup:** Hard-stop previous voices before new attack with 10ms fade-out. Fixed crackling at chord transitions.

**Shared Infrastructure — VoiceHandle.cancelRelease():** Resets released flag, clears pending cleanup timer, restores sustain level. `release()` no longer calls `osc.stop()`. Enables voice carry-forward for 3b/3c.

**3b — Sustained Repeated Chords:** Pitch-class equality gate at chord boundaries. Identical consecutive chords carry voices forward. Both modes.

**3c — Per-Voice Continuation (Legato Mode):** Voice-diff at chord boundaries: common tones sustain, departing tones release (500ms tail), arriving tones fresh attack. Staccato/Legato toggle in sidebar.

**Crackling fixes:** Per-voice `mixGain = 0.24`; `release()` uses known sustain level; graceful end-of-progression cleanup.

**Tests:** AE 202 (was 172).

### Header Redesign (POL-D18) ✅

- Title enlarged (30px) with subtitle (17px), centered, full-width, visually separated from tabs
- Info buttons moved from header to sidebar bottom: "How / to use" (pink) + "What / this is" (blue)
- Clear button absorbs Reset View (D21): resets camera + clears textarea + dismisses progression
- Library tab icon: ● (circle, replaces 📚 emoji)
- Loop button: geometric SVG cycle icon (replaces ⟳ Unicode)
- Staccato/Legato labels (replaces Piano/Pad)

### Placement Heuristics (HC) ✅

**Entry 16:** World-coordinate `dist2()` in placement.ts. Distance-gated root reuse (`REUSE_THRESHOLD = 1.5`).

**Entry 18:** Triangle centroid focus (not root vertex). Blended focus: `CHAIN_BLEND = 0.61` × previous tri centroid + 0.39 × running cluster center. World-coordinate `dist2()` in progression.ts.

**Tests:** HC 178.

### Chord Input Improvements ✅

9th chord aliases (`X9`, `X+9` → `Xadd9`). Unrecognized chord symbols silently stripped (progression plays whatever parsed). Pipeline always returns `ok: true`.

### Phase 4a: Mobile Touch + Responsive Layout ✅

- **Pinch-to-zoom:** Two-finger gesture tracking in gesture-controller.ts; computes scale factor from inter-pointer distance change; wires to `cameraController.zoom()` via new `onPinchZoom` callback. Audio stops on pinch start (same as drag).
- **Grid size:** `MIN_TRI_SIZE_PX` lowered from 40 to 25 — roughly doubles the lattice on tablets.
- **Context menu prevention:** `contextmenu` event + `-webkit-touch-callout: none` on SVG — suppresses Android tablet long-press "Download/Share" dialog.
- **Breakpoint raised:** 768px → 1024px — sidebar is always hamburger-overlay on phones and tablets (both orientations).
- **Floating transport strip:** Play/Stop, Loop, Share, Clear buttons below hamburger on mobile. Visible when progression loaded + sidebar closed. Auto-syncs with sidebar button states.
- **Auto-hide on Play:** Sidebar closes automatically on mobile when Play is tapped.
- **Scrollable sidebar:** Content (title, tabs, panels) scrolls; info footer buttons stay pinned at bottom.
- **Default tempo:** 150 BPM on page load and Clear (was 120).
- **Share button:** Link SVG icon in transport row + floating strip. Generates full URL from `window.location` + `encodeShareUrl(chords, tempo, grid)`. Copies to clipboard with textarea+execCommand fallback for non-HTTPS. Brief ✓ feedback on button.

**Files:** `RU/src/gesture-controller.ts`, `camera-controller.ts`, `interaction-controller.ts`, `resize-controller.ts`, `renderer.ts`; `INT/src/sidebar.ts`, `main.ts`, `index.ts`, `progression-pipeline.ts`; `AE/src/audio-context.ts`; `PD/src/types.ts`.
**Tests:** RU 367, INT 239.

### Supported Chord Reference

**Directly parsed:** maj, min, dim, aug, 7, m7, maj7, 6, add9, 6/9, dim7, m7b5

**Accepted via input cleaning (aliases):**

| Input | Cleaned to | Notes |
|-------|-----------|-------|
| `C9`, `C+9` | `Cadd9` | 9th chord shorthand |
| `Cø7`, `Cø` | `Cm7b5` | Half-diminished |
| `CΔ7`, `CΔ`, `C△7`, `C△` | `Cmaj7` | Triangle symbol |
| `C-7`, `C-` | `Cm7`, `Cm` | Dash-as-minor |
| `C/E` | `C` | Slash bass stripped |
| `C(b9)` | `C` | Parenthesized alterations stripped |
| `Csus4`, `Csus2`, `Csus` | `C` | Sus stripped |
| `Caug7` | `Caug` | Aug extension stripped (excluded from MVP) |

**Unrecognized symbols** are silently stripped — the progression plays with whatever parsed successfully.

**Not supported:** aug extended chords (aug7, augMaj7), 11/13 tensions

---

## Upcoming Work

### Phase 3d: Synthesis Exploration (Refine)

**Objective:** Improve the pad sound toward an ethereal/angelic quality through three cumulative experiments. Each adds a different dimension: richer tone → organic motion → spatial depth. Values are starting points — final values emerge from listening sessions (Refine regime).

**Reference:** `AUDIO_ENGINE/SOUND_SCULPTING.md` — deep research on Web Audio pad synthesis techniques, filter design heuristics, LFO modulation, delay-based space, and three recipe presets.

**Regime:** Refine. Goals and constraints specified; parameter values emerge from the feedback loop. Each experiment: apply change → listen to progressions (Staccato + Legato) + interactive taps → keep / adjust / revert.

**Constraints:**
- Per-voice changes confined to `AUDIO_ENGINE/src/synth.ts` (signal chain + defaults)
- Global effects (delay) added in `synth.ts` or a new `effects.ts`, wired once in `createImmediatePlayback` / scheduler
- No changes to `VoiceHandle` interface, scheduler, transport, or integration wiring
- Node budget: ≤8 nodes per voice × 4 voices = 32 per-voice nodes + ≤8 global nodes
- Fixed per-voice gain 0.24 stays (AE-D16)
- Experiments are cumulative — each builds on the previous, but must be testable independently

**Current signal chain (5 nodes/voice):**
```
Osc1 (triangle, +3¢) ──┐
                         ├──► mixGain (0.24) ──► LP (1500Hz, Q=1) ──► ADSR envelope ──► destination
Osc2 (sine, −3¢)     ──┘
```

**Current parameters:** attack 120ms, decay 200ms, sustain 0.7, release 500ms, filter 1500Hz.

**Why the current sound is thin:** Triangle+sine doesn't give the filter much harmonic material to sculpt. Pad lushness comes from the ear hearing slow beating/chorus and a wide band of harmonics being gently shaped by filtering and modulation. The current ±3 cent detune is on the subtle end. (See SOUND_SCULPTING.md §Oscillator choices.)

**Test progressions:** ii–V–I (Dm7 G7 Cmaj7), Adagio for Strings, 12-Bar Blues, Giant Steps. Test both Staccato and Legato modes, interactive taps, and hold-then-release.

#### 3d-A: Richer Oscillators + Filter Bloom ("Warm Pad Foundation")

Swap one oscillator to sawtooth for harmonic richness. Add filter bloom envelope (cutoff rises during attack, settles during sustain). Widen detune. Slow the attack. This is the highest-ROI change — richer source + filter sculpting is the core of every pad preset.

**Signal chain change (6 nodes/voice — +1 for separate osc mix gains):**
```
Osc1 (sawtooth, −5¢) ──► oscGain1 (0.10) ──┐
                                              ├──► LP filter ──► ADSR envelope ──► destination
Osc2 (triangle, +5¢) ──► oscGain2 (0.07) ──┘
```

Separate mix gains allow balancing saw (loud, buzzy) against triangle (soft, mellow). The saw provides harmonic material for the filter; the triangle adds body without harshness.

| Parameter | Current | Starting value | Rationale |
|-----------|---------|----------------|-----------|
| `osc1Type` | triangle | **sawtooth** | Rich harmonics — the classic subtractive pad starting point. Filter removes harshness. |
| `osc2Type` | sine | **triangle** | Warmer than sine, adds odd-harmonic body without saw's buzziness |
| `detuneCents` | 3 | **5** | Wider chorus — noticeably lusher. ±5 is in the "warm, stable" range. |
| `osc1Gain` | 0.24 (shared) | **0.10** | Saw is louder/brighter — lower mix level |
| `osc2Gain` | (shared) | **0.07** | Triangle quieter to sit behind the saw |
| `filterCutoff` | 1500 Hz | **900 Hz** | Lower cutoff tames saw harmonics — warm, not buzzy |
| `filterQ` | 1.0 | **0.85** | Slightly lower Q — gentle rolloff, no resonant peak |
| `attackTime` | 0.12s | **0.35s** | Slower attack — notes fade in as washes |
| `decayTime` | 0.2s | **0.6s** | Longer decay — more gradual settle to sustain |
| `sustainLevel` | 0.7 | **0.78** | Slightly higher — less "punch then drop" |
| `releaseTime` | 0.5s | **1.4s** | Longer release tail — notes linger and blend |

**Filter bloom envelope** (new — schedule on `filter.frequency` alongside ADSR):
```
note-on:  setValueAtTime(550, oscStart)
attack:   linearRampToValueAtTime(1250, oscStart + attackTime)
settle:   setTargetAtTime(900, oscStart + attackTime, 0.35)
```
Start dark (550Hz), brighten during attack (1250Hz), settle to steady-state (900Hz). The `setTargetAtTime` with time constant 0.35s creates an exponential decay toward the sustain cutoff — sounds more natural than a linear ramp back down.

**Crackling hypothesis:** The 350ms attack (vs current 120ms) buries mobile onset crackling — the same `ctx.currentTime` staleness produces an inaudible difference in a slow ramp. The longer release (1.4s) similarly smooths offset artifacts.

**Interactive feel concern:** 350ms attack may feel sluggish for taps. If so, split by context:
- `attackTime` = 0.15s for interactive (keep snappy)
- `padAttackTime` = 0.35s for scheduled playback
- `createVoice()` accepts optional `attackOverride`; scheduler passes `padAttackTime` when `padMode` is true

**Listen for:**
- Does the saw+triangle combo feel "warm and full" or "buzzy"? Adjust `osc1Gain` (saw level) and `filterCutoff` (how much buzz the filter removes).
- Does the filter bloom add a pleasant "opening" to each chord? Or is it too dramatic? Reduce bloom range (try 700→1100 instead of 550→1250).
- Legato mode: do common-tone sustains blend better with the richer harmonics?
- Staccato mode: does the longer release cause overlap issues? (Should not — hard-stop at boundary still fires.)

#### 3d-B: Slow LFO on Filter Cutoff ("Breathing Motion")

Add one LFO oscillator per voice modulating the LP filter cutoff. Creates organic "breathing" — the harmonics gently open and close. Much slower than my original proposal, based on research: 0.07–0.15 Hz reads as organic drift, not wobble.

**Signal chain addition (8 nodes/voice — +2 for LFO + depth gain):**
```
Osc1 (saw, −5¢) ──► oscGain1 ──┐
                                 ├──► LP filter ◄── LFO depth gain ◄── LFO (sine, 0.09Hz)
Osc2 (tri, +5¢) ──► oscGain2 ──┘        │
                                     ADSR envelope ──► destination
```

| Parameter | Starting value | Rationale |
|-----------|----------------|-----------|
| LFO type | sine | Smooth, symmetrical sweep |
| LFO rate | **0.09 Hz** | One cycle every ~11 seconds. Research: 0.05–0.15Hz for "breathing." Slow enough to feel organic, not a musical effect. |
| LFO depth | **±120 Hz** | Filter sweeps ~780–1020Hz around the 900Hz cutoff. Harmonic content gently opens and closes. |

**Implementation (in `createVoice`):**
```ts
const lfo = ctx.createOscillator();
lfo.type = "sine";
lfo.frequency.value = 0.09;
const lfoDepth = ctx.createGain();
lfoDepth.gain.value = 120;
lfo.connect(lfoDepth);
lfoDepth.connect(filter.frequency);  // modulates cutoff ± depth
lfo.start(oscStart);
```

LFO lifecycle: starts with the voice's oscillators, stopped/disconnected in `stop()` and release cleanup. No ADSR needed.

**Why per-voice, not global:** Each voice starts its LFO at a different time, so the LFOs naturally phase-drift. 4 voices with unsynchronized 11-second LFO cycles create a complex, evolving harmonic texture — far richer than a single global LFO that moves all voices in lockstep.

**Listen for:**
- Is the breathing audible as gentle movement, or inaudible? If too subtle, increase depth to ±180–200Hz.
- Is it too obvious / swooshy? Reduce depth to ±80Hz or slow rate to 0.06Hz.
- Does the filter bloom (3d-A) interact well with the LFO, or do they fight? The bloom is a one-shot onset event; the LFO is continuous. They should complement — bloom provides the attack character, LFO provides the sustain animation.

#### 3d-C: Global Feedback Delay with Damping ("Room Space")

Add a shared delay effect after the per-voice chain. A single feedback delay in the early-reflection range (35–80ms) with LP damping in the feedback path creates a sense of space without muddiness. This is **not** a reverb — it's a "room smear" that adds depth cheaply.

**Global effect chain (4 nodes, shared — NOT per-voice):**
```
Per-voice destination (master gain)
    │
    ├──► dryGain (0.84) ──────────────────────────────────────┐
    │                                                          ├──► final output
    └──► DelayNode (55ms) ──► dampingLP (2400Hz) ──► feedbackGain (0.33) ──┐  │
              ▲                                                              │  │
              └──────────────────────────────────────────────────────────────┘  │
              │                                                                 │
              └──► wetGain (0.16) ─────────────────────────────────────────────┘
```

| Parameter | Starting value | Rationale |
|-----------|----------------|-----------|
| Delay time | 55 ms | Early reflection zone — perceived as "room" not "echo" |
| Feedback gain | 0.33 | Moderate — 3–4 audible repeats before silence |
| Damping LP cutoff | 2400 Hz | Repeats get progressively darker — prevents metallic ringing |
| Damping LP Q | 0.3 | Gentle rolloff |
| Wet mix | 0.16 | Subtle — space without washing out chord clarity |
| Dry mix | 0.84 | Dry + wet ≈ 1.0 |

**Implementation location:** New function `createDelayEffect(ctx, destination)` in `synth.ts` (or new `effects.ts`). Returns an AudioNode that per-voice chains connect to (replaces direct connection to `ctx.destination`). Called once during audio init, not per voice.

**Node budget:** 4 global nodes (DelayNode + BiquadFilterNode + 2× GainNode). Total system: 8 per-voice × 4 voices + 4 global = 36. Acceptable.

**Web Audio cycle rule:** `DelayNode` in a feedback loop requires `delayTime` ≥ one render quantum (~2.9ms at 44.1kHz). Our 55ms is well above this threshold.

**Listen for:**
- Does the delay add a sense of depth/space? Or is it audible as a distinct echo? If echoey, reduce delay time to 35–40ms and/or reduce wet mix to 0.12.
- Does the damping keep repeats clean? If metallic, lower the damping LP cutoff to 1800Hz.
- Does it muddy fast chord changes in Staccato mode? If so, reduce feedback to 0.2 so repeats die faster.
- Interactive taps: does a single note feel "placed in a room"? Or does the delay add an unwanted slap?

#### Experiment Execution Order (Direction 1)

1. **A first** — establishes the tonal foundation. The oscillator swap + filter bloom is the biggest perceptual change. If the saw+triangle combo feels right, keep for B and C. If too buzzy, try saw+sine or triangle+triangle as fallbacks.
2. **B on top of A** — adds organic motion. The slow LFO animates the harmonics that A introduced. If A's lower cutoff makes the sound too dark, the LFO's sweep reopens it periodically.
3. **C on top of A+B** — adds spatial depth. The delay should be tried last because it's a global effect that may mask or enhance issues in the per-voice chain.

**If the "angelic choir" direction is preferred over "warm dark pad":** Try square+sawtooth (instead of sawtooth+triangle) with higher cutoff (1850Hz), higher Q (1.25), and longer attack (0.65s). See SOUND_SCULPTING.md "Bright angelic choir pad" recipe.

---

#### Direction 2: Cathedral Organ (alternative tonal character)

A fundamentally different approach based on organ emulation research (see `AUDIO_ENGINE/SOUND_SCULPTING_1.md`). Instead of sculpting a pad from raw oscillator waveforms, use **PeriodicWave** to bake a precise harmonic spectrum into a single oscillator — the same technique real drawbar organs use. Combined with a dual-delay cathedral bloom, this produces a warm, spacious, recognizably "organ" sound.

**Why consider this direction:** The current triangle+sine sound is thin because the filter has little harmonic material to work with. Direction 1 fixes this by switching to sawtooth. Direction 2 fixes it differently — by designing the exact harmonic spectrum upfront with `PeriodicWave`, controlling each partial's amplitude individually. This gives organ-like warmth without the saw's buzziness, and uses **fewer nodes per voice** (no separate mix gains needed).

##### 3d-D: PeriodicWave Organ Tone + Sub-Octave ("Cathedral Voice")

Replace both oscillators with: one `PeriodicWave` oscillator (warm principal spectrum) + one sine sub-octave. The PeriodicWave encodes a custom harmonic series — fundamental + controlled upper partials — in a single oscillator node.

**Signal chain (6 nodes/voice):**
```
Osc1 (PeriodicWave "principal") ──► oscGain1 (0.55) ──┐
                                                        ├──► LP filter ──► ADSR envelope ──► destination
Osc2 (sine, noteHz/2)           ──► oscGain2 (0.30) ──┘
```

**PeriodicWave "warm principal" partial amplitudes:**
```
Partial  1: 1.00   (8′ foundation)
Partial  2: 0.42   (4′ octave)
Partial  3: 0.18   (12th flavor)
Partial  4: 0.10   (2′)
Partial  5: 0.06
Partial  6: 0.05
Partial  8: 0.03
```

Built once at init, reused across all voices: `ctx.createPeriodicWave(real, imag)` where `imag[n]` = partial amplitude, `real[n]` = 0. Normalize so `Σ amplitudes × 1.8 < 1.0` to prevent clipping.

| Parameter | Starting value | Rationale |
|-----------|----------------|-----------|
| `osc1` | PeriodicWave at `noteHz` | Custom harmonic spectrum — warm principals with gentle upper brightness |
| `osc2` | sine at `noteHz / 2` | Sub-octave foundation — adds depth and body |
| `osc1Gain` | 0.55 | Principal voice carries the timbre |
| `osc2Gain` | 0.30 | Sub sits underneath — felt more than heard |
| `filterCutoff` | 4200 Hz | Higher than Direction 1 — PeriodicWave harmonics are already controlled, filter mainly removes harshness |
| `filterQ` | 0.75 | Gentle — no resonant peak |
| `attackTime` | 0.012s | Near-instant organ onset — not a pad wash |
| `releaseTime` | 0.080s | Quick release — bloom comes from the delay, not the voice |

**Optional "chiff"** (pipe speech cue, no extra nodes): on note-on, briefly open filter cutoff to 6200Hz, ramp back to 4200Hz over 30ms. Adds subtle articulation to each chord.

**Listen for:**
- Does the PeriodicWave sound "organ-like" or "synthetic"? Adjust partial amplitudes — more upper partials = brighter/reedier, fewer = warmer/flutier.
- Does the sub-octave add body or muddiness? Reduce `osc2Gain` to 0.15 if muddy.
- Is the instant attack jarring compared to the pad? If the app "needs" to feel pad-like, try 0.05–0.10s attack as a compromise.

##### 3d-E: Dual Feedback Delay ("Cathedral Bloom")

Upgrade from Direction 1's single delay to **two feedback delays with different times**. Different delay times create denser, more natural-sounding early reflections — closer to a real room than a single echo.

**Global effect chain (8 nodes, shared):**
```
Per-voice destination (master gain)
    │
    ├──► dryGain (0.78) ────────────────────────────────────────────────────┐
    │                                                                        ├──► final output
    └──► wetGain (0.22) ──┬──► Delay1 (61ms) ──► dampLP1 (2900Hz) ──► fb1 (0.33) ──► Delay1
                          │                                    │
                          └──► Delay2 (89ms) ──► dampLP2 (2400Hz) ──► fb2 (0.28) ──► Delay2
                                                               │
                              Delay1 out + Delay2 out ──────────────────────┘
```

| Parameter | Delay 1 | Delay 2 | Rationale |
|-----------|---------|---------|-----------|
| Delay time | 61 ms | 89 ms | Different prime-ish values — avoids phase alignment that sounds metallic |
| Feedback gain | 0.33 | 0.28 | Delay 2 slightly shorter-lived — creates asymmetric decay |
| Damping LP cutoff | 2900 Hz | 2400 Hz | Delay 2 darker — mimics distant reflections absorbing highs |
| Damping LP Q | 0.3 | 0.3 | Gentle rolloff in both |
| Wet mix | 0.22 | | Slightly wetter than Direction 1's single delay |
| Dry mix | 0.78 | | |

**Node count:** 8 global (2× DelayNode + 2× BiquadFilterNode + 2× GainNode feedback + dryGain + wetGain). With 6-node voices: 6 × 4 + 8 = 32 nodes total.

**Listen for:**
- Does the dual delay create a sense of "room" or "cathedral"? Compare with Direction 1's single delay.
- Is the bloom too long / too washy? Reduce feedback gains to 0.25/0.20.
- Does the asymmetric decay sound natural? If it sounds like two distinct echoes instead of a diffuse wash, reduce delay time difference (try 55ms/72ms).

##### Direction 2 Execution Order

1. **D first** — PeriodicWave + sub-octave establishes the organ character. Use Direction 1's single delay (3d-C) as initial space for quick comparison.
2. **E replaces C** — swap single delay for dual delay. Listen for the bloom improvement.
3. **Compare D+E (organ) vs A+B+C (pad)** — play the same progressions through both. The organ direction should feel more "spacious and churchy"; the pad direction more "floating and synthetic."

---

#### Final Deliverable

The Refine outcome may be:
- **(a) One preset** — the winner from the A/B/C vs D/E comparison, locked into `SYNTH_DEFAULTS`.
- **(b) Two or three selectable presets** — if both directions sound good for different music. This would require a preset selector UI element in the sidebar (small scope: dropdown or toggle next to Staccato/Legato).

If (b): presets are baked parameter sets (not user-adjustable knobs). Each preset defines oscillator config, filter, envelope, and delay parameters. The `createVoice()` function takes a preset object instead of reading `SYNTH_DEFAULTS` directly. Global delay is reconfigured per preset (or shared with preset-specific wet/dry). **UI decision deferred to the Refine feedback loop.**

Update `ARCH_AUDIO_ENGINE.md §2b` with final parameter values, signal chain diagram, and node budget. If PeriodicWave is used, document the partial amplitude table.

**Files touched:** `AUDIO_ENGINE/src/synth.ts` (per-voice chain + defaults + PeriodicWave construction), possibly new `AUDIO_ENGINE/src/effects.ts` (global delay), `AUDIO_ENGINE/src/immediate-playback.ts` and `AUDIO_ENGINE/src/scheduler.ts` (wire global delay as destination). ARCH doc on completion.

**Reference material:** `AUDIO_ENGINE/SOUND_SCULPTING.md` (pad synthesis), `AUDIO_ENGINE/SOUND_SCULPTING_1.md` (organ emulation + PeriodicWave technique).

### Phase 4: Mobile UAT (remaining)

**4b:** Responsive layout — mobile keyboard interaction with textarea, library scrolling, button tap targets ≥44×44px.
**4c:** Performance — 60fps, <100ms audio latency, SVG element count.
**4d:** iOS Safari remediation (see expanded section below).

### Phase 4d: iOS Safari Remediation (Build)

**Objective:** Fix iOS Safari audio init (app-breaking, confirmed across devices) and verify two cosmetic issues that may be version-specific.

**Testing data:**

| Device / Environment | Audio (Issue 3) | Labels (Issue 1) | Colors (Issue 2) |
|---------------------|-----------------|-------------------|-------------------|
| iPhone 12 mini, iOS 18.6.2 (physical) | ✗ No audio | ✗ Mispositioned | ✗ White after load |
| iPhone 11/12/13, iOS 14.6 (Firefox emulator) | ✗ No audio | ✓ OK | ✓ OK |

**Interpretation:** The audio issue is confirmed across all iOS devices and versions — it's a fundamental WebKit autoplay policy problem. The label positioning (Issue 1) and color bleed (Issue 2) were observed only on physical iOS 18.6.2 and **not reproduced** in the iOS 14.6 emulator. Two possibilities: (a) these are iOS 18.x regressions in WebKit's SVG renderer, or (b) the Firefox emulator doesn't faithfully reproduce Safari's SVG rendering quirks. Either way, they are lower priority than the audio fix and should be verified on a physical device after 4d-1.

**Device matrix:** Primary: Firefox iOS emulator (iPhone 11/12/13, iOS 14.6). Verification: physical iPhone 12 mini (iOS 18.6.2) if available. Regression-check: Chrome desktop + Android after each step.

**Step ordering:** 4d-1 is the only confirmed blocker. 4d-2 and 4d-3 are conditional — execute only if reproduced on a physical device after 4d-1 is complete.

#### 4d-1: Synchronous AudioContext creation (Issue 3 + Issue 4)

iOS Safari requires `AudioContext` creation and `resume()` to occur **synchronously within the user gesture call stack**. The current `ensureAudio()` is async — `await initAudio()` yields to the event loop, breaking the gesture chain. Safari blocks `resume()` when it resolves outside the gesture.

Issue 4 (playback not progressing) is a downstream consequence: if the transport never initializes, `play()` is never called and the UI never transitions to `playback-running`.

**Changes:**

| File | Change |
|------|--------|
| `AUDIO_ENGINE/src/audio-context.ts` | Add `initAudioSync(options?): AudioTransport` — creates `AudioContext` and calls `ctx.resume()` synchronously (no `await`). Existing `initAudio()` becomes a thin async wrapper: `initAudioSync()` + `await ctx.resume()` for callers that need the fully-resolved promise. |
| `INTEGRATION/src/interaction-wiring.ts` | `ensureAudio()` calls `initAudioSync()` on first invocation (synchronous, in gesture stack). `createImmediatePlayback()` runs in same synchronous frame. Subsequent calls return cached state (existing fast path, unchanged). Remove `async` from `ensureAudio()` signature — return type becomes `{ transport, immediatePlayback }` (not Promise). |
| `INTEGRATION/src/interaction-wiring.ts` | `onPointerDown()`: remove `void ensureAudio(...).then(...)` async pattern — call `ensureAudio()` synchronously, then `playPitchClasses()` in same frame. |
| `INTEGRATION/src/main.ts` | All other `ensureAudio()` call sites: update to synchronous usage (no `await`). |
| `AUDIO_ENGINE/src/index.ts` | Export `initAudioSync` alongside `initAudio`. |

**Why this works:** `ctx.resume()` returns a Promise, but on iOS Safari the context is unblocked as a side effect of calling `resume()` synchronously inside a gesture handler — the Promise resolution is irrelevant. On Chrome, `resume()` resolves immediately regardless of sync/async. The `AudioContext` enters `"running"` state before the current frame's audio buffer is processed, so `createVoice()` / `osc.start()` calls in the same tick work correctly.

**Risk:** `createImmediatePlayback()` connects a master gain to `ctx.destination`. This must succeed even if the context is technically still transitioning from `"suspended"` → `"running"` in the same tick. Web Audio spec guarantees that node connections are valid in any context state — only `start()` scheduling depends on the context running. Low risk, but verify on-device.

**Tests:**
- [ ] `initAudioSync()` returns `AudioTransport` synchronously (no Promise)
- [ ] `initAudioSync()` calls `ctx.resume()` (verify via mock)
- [ ] `ensureAudio()` returns cached state on second call (unchanged behavior)
- [ ] `ensureAudio()` is synchronous — no Promise in return type
- [ ] Existing `initAudio()` still works (async wrapper, test compat preserved)
- [ ] `onPointerDown` → `playPitchClasses` in same synchronous frame (no `.then()`)
- [ ] Regression: Chrome desktop interactive + scheduled playback still works
- [ ] Device: iOS Safari — tap triangle → audio plays
- [ ] Device: iOS Safari — Play button → playback progresses, chord animation runs

#### 4d-2: SVG label positioning — `dominant-baseline` → `dy` (Issue 1) — CONDITIONAL

**Status:** Not reproduced in iOS 14.6 emulator. Execute only if confirmed on physical iOS 18.6.2+ device after 4d-1.

Safari/WebKit may ignore or misinterpret `dominant-baseline: "central"` on SVG `<text>` elements, causing vertical misalignment of note name labels relative to node circles. Observed on iOS 18.6.2 physical device only. The `dy` fix is low-risk and could be applied preemptively as a cross-browser hardening measure, but is not a confirmed regression on iOS 14.x.

**Changes:**

| File | Lines | Change |
|------|-------|--------|
| `RENDERING_UI/src/renderer.ts` | 208 | Single note label: remove `dominant-baseline`, add `dy="0.35em"` |
| `RENDERING_UI/src/renderer.ts` | 223 | Enharmonic sharp label (top): remove `dominant-baseline`, add `dy="-0.1em"` (shifted up from center) |
| `RENDERING_UI/src/renderer.ts` | 239 | Enharmonic flat label (bottom): remove `dominant-baseline`, add `dy="0.85em"` (shifted down from center) |
| `RENDERING_UI/src/path-renderer.ts` | 230 | Centroid note label: remove `dominant-baseline`, add `dy="0.35em"` |
| `RENDERING_UI/src/path-renderer.ts` | 265 | Active chord label: remove `dominant-baseline`, add `dy="0.35em"` |

**Enharmonic label note:** The sharp (top) and flat (bottom) labels are positioned via `y` offsets from the node center. The `dy` values above are starting points — the split labels need visual tuning so both names are readable within the circle. Single-name labels use the standard `0.35em` centering constant.

**Tests:**
- [ ] All 5 `dominant-baseline` usages replaced with `dy`
- [ ] Existing RU tests pass (text elements still created with correct attributes)
- [ ] Device: iOS Safari — labels centered in node circles
- [ ] Regression: Chrome desktop — labels still centered (no visible shift)

#### 4d-3: Grid label color bleed after progression load (Issue 2) — CONDITIONAL

**Status:** Not reproduced in iOS 14.6 emulator. Execute only if confirmed on physical iOS 18.6.2+ device after 4d-1.

After loading a progression, grid node labels turn white instead of dark grey (`#555`). Observed on iOS 18.6.2 physical device only. Two likely causes:

**(A) Fill inheritance from grid-highlighter:** `activateGridHighlight()` in `grid-highlighter.ts` mutates `fill` on circle elements. If `<text>` labels are children of the same `<g>` group and inherit `fill`, the highlight color (or the `deactivate()` restore value) may bleed into text. Alternatively, `deactivate()` may not restore text `fill` at all if text elements are not in its mutation list.

**(B) Path renderer z-order:** `path-renderer.ts` renders white note-name labels on centroid markers (`layer-path`). If Safari composites `layer-path` text on top of `layer-grid` text differently than Chrome, the white centroid label could occlude the dark grid label at the same node position.

**Diagnosis steps (before fixing):**
1. In `grid-highlighter.ts`, log which elements `deactivate()` restores — check if `<text>` elements are included
2. Add `fill="#555"` explicitly on grid `<text>` elements in `renderer.ts` (breaks inheritance chain regardless of parent mutations)
3. Check if `layer-path` centroid labels overlap `layer-grid` labels at the same `(x, y)` — if so, either offset or suppress the grid label when a centroid label is present

**Changes (preliminary — may expand after diagnosis):**

| File | Change |
|------|--------|
| `RENDERING_UI/src/renderer.ts` | Set `fill="#555"` explicitly on all grid `<text>` elements (currently may be inherited from parent or CSS) |
| `RENDERING_UI/src/grid-highlighter.ts` | Audit `deactivate()` restore list — if text elements are children of mutated groups, either exclude them from mutation or add them to the restore list with their original fill |
| `RENDERING_UI/src/path-renderer.ts` | If centroid labels overlap grid labels: add `pointer-events="none"` and verify z-order, or suppress grid label rendering at centroid positions |

**Tests:**
- [ ] Grid `<text>` elements have explicit `fill` attribute (not inherited)
- [ ] `deactivate()` restores all grid elements including text (if mutated)
- [ ] Device: iOS Safari — load progression → labels remain dark grey
- [ ] Regression: Chrome desktop — label colors unchanged at rest and during playback

### Phase 4e: Node Interaction — Single-Note Playback (Build + Refine)

**Objective:** Tapping a lattice node plays that single pitch. Nodes are enlarged for comfortable touch targets. Visual feedback reuses the orange active-chord marker from path playback. Interaction policy revised: exploration (tap triangle/edge/node + audio) is allowed when a progression is loaded but not playing.

**Decisions:**
- POL-D28: Relax interaction suppression in `progression-loaded` state (allow audio + highlight; suppress only during `playback-running`)
- POL-D29: Node selection highlight = orange disc (same as active chord path marker, `ACTIVE_MARKER_FILL` #e76f51, radius `ACTIVE_MARKER_RADIUS` 0.32) positioned on the tapped node, with note name label inside

#### 4e-1: Interaction policy revision (POL-D28)

Revises INT-D6 (Option A → Option C). Currently `isPlaybackSuppressed()` returns `true` for both `"progression-loaded"` and `"playback-running"`. After this step, only `"playback-running"` suppresses interaction. Transport controls (Stop, Loop, Clear) remain active during playback as before.

**Changes:**

| File | Change |
|------|--------|
| `INTEGRATION/src/interaction-wiring.ts` | `isPlaybackSuppressed()`: remove `"progression-loaded"` from suppression check |
| `RENDERING_UI/src/ui-state.ts` | `selectChord()`: remove `"progression-loaded"` guard — allow `progression-loaded → chord-selected` transition |
| `UX_SPEC.md` §5 | Add `Progression Loaded → Chord Selected (tap/click)` transition; remove "tap/click is ignored while a progression is loaded" rule (revises INT-D6) |

**Tests:**
- [ ] `isPlaybackSuppressed()` returns `false` for `"progression-loaded"`, `true` for `"playback-running"`
- [ ] `selectChord()` succeeds from `"progression-loaded"` state
- [ ] Pointer down on triangle during `"progression-loaded"` → audio plays
- [ ] Pointer down on triangle during `"playback-running"` → suppressed (unchanged)
- [ ] UI state: `progression-loaded → chord-selected` on tap, progression path remains visible

**Note:** The progression path overlay should remain rendered when transitioning to `chord-selected` — user sees both the path and the interactive highlight. Clearing happens only via Clear button.

#### 4e-2: HitNode in hit-test (Build)

Add `HitNode` to the `HitResult` discriminated union. Node proximity check runs before edge proximity, because nodes are smaller targets and need priority when the pointer is near a vertex.

**Changes:**

| File | Change |
|------|--------|
| `RENDERING_UI/src/hit-test.ts` | Add `HitNode` type: `{ type: "node", nodeId: NodeId, pc: number }`. In `hitTest()`, after identifying containing triangle, compute distance to each of 3 vertices. If any vertex is within `nodeHitRadius`, return `HitNode` (nearest wins). Fall through to existing edge/triangle logic otherwise. |
| `RENDERING_UI/src/hit-test.ts` | Export `NODE_HIT_RADIUS` constant (initially 0.20 world units; tunable in 4e-5) |

**Tests:**
- [ ] Pointer exactly on a node → `HitNode` with correct `nodeId` and `pc`
- [ ] Pointer at node + 0.15 (inside radius) → `HitNode`
- [ ] Pointer at node + 0.25 (outside radius) → `HitTriangle` or `HitEdge` (not node)
- [ ] When equidistant from two nodes, nearest wins
- [ ] Existing triangle and edge hit-tests unaffected for points far from nodes
- [ ] Boundary node (edge of window) → `HitNode` still works

#### 4e-3: Interaction dispatch for nodes (Build)

Wire `HitNode` through the interaction and audio paths.

**Changes:**

| File | Change |
|------|--------|
| `RENDERING_UI/src/interaction-controller.ts` | Add `onNodeSelect?: (nodeId: NodeId, pc: number) => void` to `InteractionCallbacks`. In `onTap()`, handle `hit.type === "node"` → call `onNodeSelect`. |
| `INTEGRATION/src/interaction-wiring.ts` | In `onPointerDown()`, add `hit.type === "node"` branch → `playPitchClasses(immediatePlayback, [hit.pc])`. In `onNodeSelect`, no additional work needed (audio already playing from pointer-down, same pattern as triangles). |

**Audio:** No Audio Engine changes. `playPitchClasses(state, [pc])` already handles a single pitch class → one voice at 0.24 gain.

**Tests:**
- [ ] Pointer down on node → `playPitchClasses` called with single-element array `[pc]`
- [ ] `onNodeSelect` callback fires with correct `nodeId` and `pc`
- [ ] Pointer down on node during `"playback-running"` → suppressed
- [ ] Pointer down on node during `"progression-loaded"` → audio plays (per POL-D28)
- [ ] Pointer up after node tap → `stopAll()` called (existing behavior)

#### 4e-4: Node selection highlight — orange disc (Build)

Reuse the active chord path marker visual (orange filled disc with note label) for node selection feedback.

**Changes:**

| File | Change |
|------|--------|
| `INTEGRATION/src/main.ts` | On `onPointerDown` → `HitNode`: create/show an orange disc SVG group (`<g>` with `<circle>` + `<text>`) at the node's world position. Radius = `ACTIVE_MARKER_RADIUS` (0.32). Fill = `ACTIVE_MARKER_FILL` (#e76f51). Text = note name (e.g., "C", "F#", "Bb"). Hide on pointer-up or drag-start. |
| `RENDERING_UI/src/path-renderer.ts` | Export `ACTIVE_MARKER_RADIUS` and `ACTIVE_MARKER_FILL` constants (currently module-private) so the integration module can reuse them. Alternatively, extract a shared `createMarkerDisc(layer, x, y, label, options?)` helper. |

**Design spec:**
- Same orange disc as progression playback active chord marker
- Note name label inside (white, same font as path centroid labels)
- Appears on pointer-down, disappears on pointer-up (matches chord highlight lifecycle)
- Renders on `layer-path` (above grid, below UI) — same layer as progression markers

**Tests:**
- [ ] Node tap creates orange disc at correct world coordinates
- [ ] Disc displays correct note name (enharmonic: use sharp-preferred spelling)
- [ ] Disc hidden after pointer-up
- [ ] Disc hidden when drag begins
- [ ] Disc does not appear during `"playback-running"`
- [ ] Disc coexists with progression path when in `"progression-loaded"` state

#### 4e-5: Node size increase (Refine)

Enlarge node circles for better touch targets. This is a tuning pass — initial values provided, final values from visual feedback.

**Changes:**

| File | Change |
|------|--------|
| `RENDERING_UI/src/renderer.ts` | `NODE_RADIUS`: 0.15 → 0.20 (starting value; tune visually) |
| `RENDERING_UI/src/renderer.ts` | `LABEL_FONT_SIZE`: may need proportional adjustment |
| `RENDERING_UI/src/shape-renderer.ts` | `VERTEX_MARKER_RADIUS`: 0.15 → match new `NODE_RADIUS` |
| `RENDERING_UI/src/hit-test.ts` | `NODE_HIT_RADIUS`: tune relative to visual radius (≥ visual radius) |
| `RENDERING_UI/src/grid-highlighter.ts` | `ACTIVE_ROOT_WIDTH` / `ACTIVE_NODE_WIDTH`: may need adjustment for visual balance with larger circles |

**Constraints:**
- Adjacent nodes are 1.0 world units apart → max visual radius ~0.40 before circles touch
- Node circles must not obscure triangle fills or edge lines
- Labels must remain readable inside larger circles
- Mobile touch target ≥44×44px met at zoom levels where grid is usable

**Tests:** Visual only (Refine regime). Verified by human inspection at desktop and mobile zoom levels.

### Phase 5: Final Polish & Review

End-to-end walkthrough, dead code removal, architecture alignment, close all open decisions, documentation pass.

---

## Open Issues

| Issue | Status | Notes |
|-------|--------|-------|
| iOS Safari: no audio, no playback | Confirmed across devices | Audio blocked by async `ensureAudio()` — `AudioContext.resume()` outside gesture stack. Reproduced on iPhone 11/12/13 (iOS 14.6 emulator) + iPhone 12 mini (iOS 18.6.2 physical). Fix: 4d-1 (sync AudioContext creation). |
| iOS Safari: labels, colors | Unconfirmed on iOS 14.x | `dominant-baseline` label positioning + highlight fill bleeding — observed on iOS 18.6.2 physical device only, NOT reproduced in iOS 14.6 emulator. May be iOS 18.x-specific or emulator limitation. Conditional: 4d-2, 4d-3. |
| Mobile audio crackling (budget tablets) | Deferred to Phase 3d/4c | Stale `ctx.currentTime` on large-buffer devices. `safeOffset` fix helped Pixel 6, not Galaxy Tab A7 Lite. Need device diagnostic data + brute-force offset test. See Entry 21 |

## Post-MVP

| Issue | Notes |
|-------|-------|
| Giant Steps symmetric jumps | Requires two-pass global optimizer. Local greedy algorithm cannot resolve symmetric tritone jumps. |
| Tristan chord Am placement | Local algorithm picks geometrically nearest Am; no `CHAIN_BLEND` value fixes it. Needs global optimizer. |
| m7b5 non-root triangle placement | POL-D14 (deferred) |

## Resolved Issues

| Issue | Resolution |
|-------|------------|
| Chain-focus drift | Centroid focus + cluster gravity blend (Entry 18) |
| End-of-progression crackling | Sustain-level release scheduling + graceful completion (Entry 17) |
| Multi-voice attack crackling | Per-voice mixGain 0.24, removed dynamic normalization (Entry 17) |
| Chord transition crackling | Hard-stop previous voices + 10ms fade-out (Entry 15) |
| Placement jumps | Centroid focus + cluster gravity (Entry 18) |
| Drag jitter | Screen-space deltas (Entry 13) |
| Chord continues during drag | `onDragStart` stops audio (Entry 13) |
| Progression viewport clipping on small screens | Rightward focus bias (25% of grid width), MIN_ZOOM 0.25→0.15, MIN_TRI_SIZE_PX 25→18 (Entry 23) |
| safeOffset audio regression on mobile | safeOffset removed from stop/release/cancelRelease, kept only in createVoice; stop fadeOut 10→50ms (Entry 23) |
| Loop last-chord duration asymmetry | Loop mode: scheduler hard-stops at endTime instead of waiting for release tail; `setLoop`/`getLoop` on AudioTransport (Entry 24) |

---

## Decision Log

### Closed

| # | Date | Decision |
|---|------|----------|
| D1 | 02-16 | Sidebar in Integration module (replaces RU layout/panel) |
| D2 | 02-16 | Title: "Tone Nets" / "an interactive Tonnetz explorer" |
| D3 | 02-16 | Synthesis model — subsumed by D19 |
| D4 | 02-16 | Voicing strategy — subsumed by D19 |
| D6 | 02-16 | Interactive press = triad only; playback = full Shape |
| D7 | 02-16 | Chord grammar: input cleaning + HC dim7/m7b5 |
| D8 | 02-17 | Two info overlays (How to Use, What This Is) as full-viewport modals |
| D9 | 02-17 | Two-tab sidebar (Play \| Library) with persistent header |
| D10 | 02-17 | Active chord display → path marker |
| D11 | 02-17 | Playback controls: ▶ ■ 🔁 ✕, no Pause |
| D12 | 02-17 | Library: expandable accordion cards, auto-switch to Play on load |
| D13 | 02-17 | Dot-only centroid = root node position |
| D15 | 02-18 | Shape centroid = root vertex position (path rendering) |
| D16 | 02-18 | Root Motion / Tonal Centroid toggle |
| D17 | 02-18 | 4 beats/chord, no collapsing, 20–960 BPM |
| D18 | 02-21 | Header redesign: larger title, info buttons at sidebar bottom, ● Library icon, SVG loop icon |
| D19 | 02-19 | Staccato/Legato toggle + sustained repeated chords as baseline |
| D20 | 02-19 | Auto-center viewport on progression load |
| D21 | 02-21 | Clear absorbs Reset View (camera + textarea + progression) |
| D22 | 02-21 | 9th chord aliases (X9, X+9 → Xadd9) + silent strip of unrecognized chords |
| D23 | 02-21 | Mobile breakpoint 1024px — sidebar always hamburger-overlay on phones + tablets |
| D24 | 02-21 | Floating transport strip on mobile (below hamburger) when progression loaded + sidebar closed |
| D25 | 02-21 | Auto-hide sidebar on Play (mobile); sidebar open/close manual via hamburger only |
| D26 | 02-21 | Default tempo 150 BPM (page load + Clear) |
| D27 | 02-22 | Share button: URL from window.location + encodeShareUrl, clipboard copy with fallback, ✓ feedback |
| D5 | 02-16 | Mobile proximity radius 0.12 world units — confirmed adequate on Pixel 6, Galaxy Tab A7 Lite, iPhone 12 mini |
| D28 | 02-23 | Relax interaction suppression: allow audio + highlight in `progression-loaded`, suppress only `playback-running` (revises INT-D6) |
| D29 | 02-23 | Node selection highlight: reuse orange active-chord marker disc (#e76f51, r=0.32) with note name label |

### Open

| # | Date | Decision | Status |
|---|------|----------|--------|
| D14 | 02-17 | m7b5 non-root triangle placement | Deferred post-MVP |
