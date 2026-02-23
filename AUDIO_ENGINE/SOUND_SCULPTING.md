# Designing an Ethereal Pad Synth Preset in Web Audio API

## Constraints-driven sound goals for “warm pad” and “angelic choir”
A “warm pad” or “choir pad” in classic subtractive synthesis usually emerges from three interacting ingredients: (1) a harmonically rich source (often multiple oscillators), (2) filtering that smooths harsh partials while optionally emphasizing a broad “formant-like” region, and (3) slow amplitude/brightness shaping (envelopes and/or LFO) plus “space” (reverb/delay) to push the sound behind the speakers.

Your current voice (triangle + sine into a low-pass at 1500 Hz,±3 cents detune, ADSR 120/200/0.7/500 ms) is already “gentle,” because sine is smooth/mellow and triangle is close to sine compared to harmonically dense waveforms.  The tradeoff is that it can read as *thin* or *plain* (not “lush”), because strong pad lushness is often the ear hearing slow beating/chorus-like motion and a wide band of harmonics being softly sculpted by a filter and modulation.

With your node budget, the most “compounding” upgrades tend to be:
- switching one oscillator to a richer waveform (usually saw or square) and rebalancing the filter,
- adding one slow LFO to a perceptually sensitive target (filter cutoff or oscillator detune),
- adding a *single* global “room smear” feedback delay (with damping) instead of per-voice effects.

## Oscillator choices and detune ranges that feel warm instead of harsh
### Harmonic personality of Web Audio’s built-in waveforms
Web Audio’s `OscillatorNode` supports `"sine"`, `"triangle"`, `"sawtooth"`, and `"square"` (plus `"custom"` via `PeriodicWave`, which you’re not using).  The perceived “pad warmth” you can extract from each basic type follows their harmonic density:

- **Sine**: very smooth/mellow; useful as a fundamental “glue” layer, but by itself can sound plain for pads.
- **Triangle**: contains odd harmonics, but they drop off quickly, so it stays relatively mellow.
- **Square**: “hollow/nasal” character; can help a choir-ish impression, but can also sound reedy unless filtered.
- **Sawtooth**: rich, buzzy, “full”; the classic subtractive starting point that becomes warm once you low-pass it.

A practical takeaway under your constraints: **if you want “lush,” at least one oscillator usually needs to be saw or square**, because triangle+sine doesn’t give the filter much harmonic material to sculpt.

### Detune: static “ensemble” thickness vs slow “chorus” shimmer
In Web Audio, `OscillatorNode.detune` is an **a-rate `AudioParam` in cents**, meaning it can be automated or modulated at audio rate (though you’ll usually modulate it at LFO rates).

Why detune is so effective for pads: two close frequencies create **beats** (perceived cyclic loudness variation) at the difference frequency.  Small detunes therefore yield slow, pleasant undulation; large detunes yield “out of tune” or supersaw-like smear (depending on context).

Grounded reference points you can lean on:
- A widely-circulated pad recipe detunes an oscillator by **~4 cents** to “fatten” it (static detune).
- A classic doubling/pitch FX preset describes an LFO modulating pitch **from 2–12 cents** (i.e., chorus/vibrato depth in that ballpark).
- Chorus modulation rates in modern modulation units are commonly described over **~0.1–20 Hz** (your pad use-cases are usually near the low end).

**Practical detune guidance for 2 oscillators (single voice, pad chords):**
- **Warm, stable, “in tune” pad**: ±3 to ±6 cents
- **Noticeably lush/chorused**: ±7 to ±12 cents
- **Very wide/smeary (risk: dissonant on some intervals)**: ±13+ cents

Those are best treated as *starting regions* rather than facts about what “must” work, because perceived beating rate depends on pitch (higher notes beat faster for the same cents). The key point is that **your current ±3 cents is on the subtle end**; raising it slightly (or adding slow pitch modulation) is one of the highest ROI tweaks.

## Filters and envelope modulation for dark, airy, glassy, and choir-like tones
### What the built-in filter types actually do
`BiquadFilterNode` gives you several filter “characters” that map cleanly onto your adjectives: lowpass, highpass, bandpass, highshelf, lowshelf, peaking, notch, allpass.  The MDN reference is unusually useful here because it states how `frequency`, `Q`, and `gain` behave for each filter type (and what’s ignored).

Key properties for pad design:
- `frequency` is an **a-rate `AudioParam`** measured in Hz, nominally ranging from about 10 Hz up to Nyquist (sampleRate/2).
- `Q` is an **a-rate `AudioParam`** that controls resonance/peakedness (interpretation varies by type).
- For **highshelf/lowshelf/peaking**, `gain` is in **dB** and is also an **a-rate `AudioParam`**.

### A sound-design map from filter settings to your target adjectives
Below are *design heuristics* based on how these filters behave (what they pass/attenuate and how resonance shapes the response), plus how subtractive synthesis is typically described: a filter “carves out” frequencies, and resonance/Q boosts energy around the cutoff/center.

**Dark / warm pad**
- Use **lowpass** with a **lower cutoff** and **modest Q** so the brightness is mostly removed without adding a whistly resonant spike.
- Typical starting region: cutoff ~700–1200 Hz, Q ~0.6–1.1 (then adjust by ear per register).

**Airy / angelic**
- Airiness is often perceived as “controlled brightness” (upper harmonics present but not harsh). With just a lowpass, that means a **higher cutoff** and usually **lower Q**.
- If you can afford an extra node globally: add a **highshelf** after the mix bus with +2 to +5 dB above ~7–10 kHz to restore “air” without reintroducing mid harshness.

**Glassy**
- “Glassy” often comes from a more pronounced emphasis in upper mids/highs. A practical Web Audio way:
  - a lowpass that’s open enough (e.g., 2.5–5 kHz) *plus*
  - either slightly higher Q on lowpass **or** a **peaking** filter with a few dB boost in the 3–6 kHz region.

**Choir-ish / vowel-ish**
You don’t have noise sources or multiple parallel bandpasses (classic formant approach), but you *can* fake part of the perception:
- Use a **bandpass** or a **resonant lowpass** so there’s a broad emphasis around a mid “formant-ish” center (often somewhere around ~800–2000 Hz depending on the impression).
- Combine that with a “hollow” oscillator component (square) and longer envelopes.

### Filter envelope “bloom” matters for pads more than many people expect
Your goal includes “smooth chord transitions,” which is as much about how brightness and loudness *start* as about the steady-state timbre. Many synth teaching materials explicitly frame filter envelopes as “turning the cutoff knob over time.”

A pad-friendly pattern is **brightness bloom**:
- start cutoff lower at note-on,
- rise during attack,
- then settle slightly darker during sustain.

In Web Audio that’s straightforward because `BiquadFilterNode.frequency` is an a-rate `AudioParam` and supports the same automation methods as gain.

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["ADSR envelope diagram","synth filter envelope diagram cutoff over time"],"num_per_query":1}

## One-LFO motion tricks that read as breathing or shimmering
### The Web Audio modulation model you’re relying on
Web Audio lets you connect an audio-rate signal to an `AudioParam`; the spec describes that if an `AudioParam` has any connected `AudioNode`s, their outputs are summed (downmixed to mono) as the “input AudioParam buffer.”  That’s the formal basis for using an `OscillatorNode` as an LFO controlling gain, filter cutoff, detune, or delay time.

### LFO targets that tend to pay off most for pads
Because you only want **one baked preset** and simple changes, focus on targets where small modulation reads as “alive” rather than “wobbling.”

**Breathing (slow, gentle)**
- **Rate**: ~0.05–0.15 Hz (≈ 7–20 seconds per cycle)
- **Target**: filter cutoff (`BiquadFilterNode.frequency`) or output gain (`GainNode.gain`)
- **Depth** (start small):
  - cutoff: ±80–200 Hz, or
  - gain: ±0.01–0.03 around your envelope’s sustain level (to avoid audible tremolo).

**Shimmer / chorus-like motion**
A chorus effect is commonly described as LFO-controlled pitch modulation of a duplicated voice; manufacturer documentation often expresses chorus-related modulation in rate (Hz) and pitch modulation depth (cents).
- **Rate**: ~0.15–0.6 Hz for slow “drift” shimmer; ~4–6 Hz for audible vibrato shimmer
- **Depth**:
  - drift: ±2–6 cents
  - vibrato: ±1–4 cents (pads usually want this subtle)

**A high-value compromise** (often best under your constraints)
Use **one slow LFO to filter cutoff** (breathing) and rely on **static detune** for “chorus body.” That avoids the more obvious “pitch wobble” while still feeling animated.

## Space with DelayNode: a “room smear” without mud
### What DelayNode can and can’t do as “reverb”
A `DelayNode` is a delay line with a `delayTime` `AudioParam`.  If you add a feedback loop (Delay → Gain → back into Delay), you create a decaying echo series. Classic algorithmic reverbs build dense reflections from networks of comb and allpass delay structures.

However, there’s an important Web Audio gotcha:
If a `DelayNode` is part of a **cycle**, the spec clamps `delayTime` to a **minimum of one render quantum**.  With the default render quantum size of 128 frames, that minimum is on the order of a few milliseconds depending on `sampleRate`.  (This does **not** block typical “room” delay times like 20–80 ms; it mostly matters if you try ultra-short flangers in feedback loops.)

### A simple “space trick” that stays clear
The simplest delay-based “reverb-ish” spaciousness that tends not to get muddy uses:
- a **single feedback delay** in the ~35–80 ms region (early reflection zone),
- **moderate feedback** (0.2–0.4),
- a **lowpass in the feedback path** (damping) so the repeats get darker over time,
- a **low wet mix** (often 10–25%).

Why damping helps: lowpass in the loop progressively attenuates high frequencies and reduces metallic ringing, which is exactly what modern reverb design discussions emphasize when moving beyond raw comb echoes.

## Web Audio details for smooth onsets and reliable mobile behavior
### One AudioContext, started correctly
Authoritative Safari guidance from entity["company","Apple","consumer electronics"] recommends that the audio context be long-lived and that it’s unnecessary to create more than one per page.

Modern browsers also enforce autoplay policies: MDN summarizes the rule of thumb as creating or resuming the context **from inside a user gesture**, and it explains the `AudioContext` state model (`suspended`, `running`, `closed`).

### iOS mute switch and backgrounding behavior is a real risk for “music apps”
On iOS Safari, Web Audio behavior can differ from `<audio>`/`<video>` elements. A WebKit bug report explains that Web Audio was mapped to an “Ambient” behavior: it mixes with other audio but **obeys the mute switch** and is not allowed to continue when not foreground.  A separate write-up notes that Web Audio playback is consistent in that it only plays if the device isn’t muted, while media elements can still play.

If your app is meant for music practice, this is worth surfacing in UX copy (“turn off Silent Mode”), because it’s not something you can reliably fix purely in Web Audio given platform policy.

### Avoiding clicks and zipper noise
Clicks at note on/off are most often discontinuities (cutting the waveform at a non-zero crossing). A practical mitigation is to ramp a gain envelope rather than abruptly stopping audio.

Relevant automation tools:
- `setValueAtTime()` schedules an instant value at an exact `currentTime`.
- `linearRampToValueAtTime()` gives a linear ramp.
- `exponentialRampToValueAtTime()` is often preferred for perceptual reasons when changing frequencies/rates.
- `setTargetAtTime()` is explicitly called out as useful for decay/release parts of ADSR.
- `cancelScheduledValues()` cancels future scheduled changes, which is important when retriggering a voice mid-envelope.

A key gotcha: exponential ramps require strictly positive values; you can’t exponential-ramp gain to exactly zero, so use a small epsilon like `1e-4` as your final point if you want an exponential tail.

### Oscillator lifecycle and chord transitions
Oscillators are `AudioScheduledSourceNode`s; the scheduling model is based on `currentTime`.  Also, source nodes’ `start()` is not meant to be called repeatedly. The Web Audio spec explicitly states that `start()` may not be issued multiple times (described for source nodes such as `AudioBufferSourceNode`; in practice, the same one-shot lifecycle constraint applies to oscillators in browser implementations and documented patterns).

For “smooth chord transitions” under a 4-voice cap, the two most robust strategies are:
- **Release overlap**: don’t hard-stop voices; ramp them down with your release envelope and only stop the oscillator after the envelope reaches (near) zero.
- **Micro-glide**: instead of killing/recreating a voice on a chord change, retarget `oscillator.frequency` with a short ramp (≈ 30–120 ms). `OscillatorNode.frequency` is an a-rate `AudioParam`, so it supports scheduled ramps.

### Latency and performance knobs that matter on mobile
The Web Audio spec defines `AudioContextOptions.latencyHint` (default `"interactive"`) and notes that actual latency is reported by `baseLatency`.  That matters because on lower-end mobile devices, pushing for very low latency can increase glitch risk (buffer underruns / CPU overruns), while higher latency can feel more stable.

## Preset recipes within your node budget
All recipes below keep the **per-voice graph simple** (2 oscillators → filter → amp envelope), then add **global modulation and space**. This aligns with how Web Audio graphs are typically built: multiple node outputs can be summed by connecting them to a shared input/output, and gain nodes are fundamental building blocks for mixing.

A reference architecture that stays under budget:
- **Per voice (6 nodes)**: 2× OscillatorNode + 2× GainNode (osc mix) + 1× BiquadFilterNode + 1× GainNode (amp envelope)
- **Global (6–8 nodes, shared)**: 1× LFO OscillatorNode + 1× LFO GainNode (depth), plus a 4–6 node delay “room smear,” optionally plus 1 global EQ-like filter (highshelf/peaking).

### Warm dark pad
**Intent:** cozy, stable warmth; motion comes more from slow cutoff breathing than audible pitch wobble. This generally benefits from introducing a saw layer (harmonic richness) then low-pass smoothing.

**Per voice**
- Osc A: `type="sawtooth"`, `detune=-5` cents
- Osc B: `type="triangle"`, `detune=+5` cents
- Osc mix gains (starting point): A = 0.10, B = 0.07 (then the amp envelope peak sets overall loudness)
- Filter: `type="lowpass"`, `frequency=900 Hz`, `Q=0.85`
- Amp ADSR (starting point):
  - Attack 0.35 s
  - Decay 0.60 s
  - Sustain 0.78
  - Release 1.40 s
  (Longer attack/release is a well-known pad characteristic; a concrete “ambient pad” example uses very slow envelope timing.)
- Filter “bloom” envelope (starting point; schedule on `filter.frequency`):
  - start 550 Hz → ramp to 1250 Hz over the same 0.35 s attack
  - settle back toward 900 Hz with `setTargetAtTime(..., timeConstant=0.35)`

**Global LFO (breathing)**
- LFO: sine wave, rate **0.09 Hz**
- LFO depth: ±120 Hz applied to each voice’s `filter.frequency` (via one GainNode scaling into the AudioParam)

**Global space (single feedback delay with damping)**
- `DelayNode.delayTime = 0.055 s`
- `feedbackGain.gain = 0.33`
- damping filter in loop: `BiquadFilterNode.type="lowpass"`, `frequency=2400 Hz`, `Q=0.3`
- wet mix: `wetGain.gain = 0.16`
This is fundamentally a decaying echo series; damping in the loop is the crucial anti-metallic step.

### Bright angelic choir pad
**Intent:** gentle “choral” impression—hollow core + soft air band + long, floating envelope.

**Per voice**
- Osc A: `type="square"`, `detune=-3` cents (hollow/nasal component)
- Osc B: `type="sawtooth"`, `detune=+3` cents (adds harmonic “choir body,” later filtered)
- Osc mix gains (starting point): A = 0.09, B = 0.05
- Filter: `type="lowpass"`, `frequency=1850 Hz`, `Q=1.25`
  - Rationale: lowpass removes harsh highs, while a raised Q/resonance emphasizes energy around cutoff (pseudo-formant-ish emphasis).
- Amp ADSR (starting point):
  - Attack 0.65 s
  - Decay 0.45 s
  - Sustain 0.86
  - Release 2.40 s
  Longer attack is explicitly associated with pads/atmospheric sounds in synth envelope explanations.
- Filter bloom envelope (starting point):
  - start 950 Hz → ramp to 2300 Hz during attack
  - settle toward 1850 Hz during sustain

**Global EQ-like “air”**
- Post-mix filter: `BiquadFilterNode.type="highshelf"`, `frequency=8000 Hz`, `gain=+3.0 dB`

**Global LFO (slow “mouth movement”)**
- LFO sine rate: **0.07 Hz**
- Depth: ±90 Hz into each voice’s filter cutoff
This is intentionally slow enough to read as organic drift rather than a musical wobble.

**Global space (slightly brighter + slightly longer than warm pad)**
- `delayTime = 0.075 s`
- `feedback = 0.28`
- loop damping lowpass: `frequency=3600 Hz`, `Q=0.3`
- wet mix: `wetGain = 0.20`
Keep an eye on iOS mute switch policy if this is a practice app.

### Glassy ethereal pad
**Intent:** higher shimmer, wider chorus body, light “sparkle” without becoming harsh.

**Per voice**
- Osc A: `type="sawtooth"`, `detune=-9` cents
- Osc B: `type="sawtooth"`, `detune=+9` cents
- Osc mix gains (starting point): A = 0.07, B = 0.07
- Filter: `type="lowpass"`, `frequency=3600 Hz`, `Q=1.05`
- Amp ADSR (starting point):
  - Attack 0.28 s
  - Decay 0.90 s
  - Sustain 0.65
  - Release 1.60 s
- Filter transient “sparkle” envelope (starting point):
  - start 1600 Hz → ramp to 4200 Hz over 0.28 s
  - settle back to 3600 Hz

**Global “glass” emphasis**
- Post-mix peaking filter (one node): `type="peaking"`, `frequency=4800 Hz`, `Q=1.4`, `gain=+3.0 dB`

**Global LFO (shimmer without tremolo)**
- LFO sine rate: **0.25 Hz**
- Target: modulate **Osc B detune** by ±3 cents (leave Osc A static)
This is a direct, Web Audio-native way to “chorus” via pitch modulation (detune is a-rate).

**Global space (shorter, brighter room)**
- `delayTime = 0.038 s`
- `feedback = 0.22`
- loop damping lowpass: `frequency=5200 Hz`, `Q=0.25`
- wet mix: `wetGain = 0.14`
If you implement the feedback loop, remember the spec’s cycle rule: delay in cycles can’t go below one render quantum.
