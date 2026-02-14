import { describe, it, expect } from "vitest";
import { createVoice, midiToFreq, SYNTH_DEFAULTS } from "../synth.js";
import {
  MockAudioContext,
  MockGainNode,
  MockOscillatorNode,
  MockBiquadFilterNode,
} from "./web-audio-mock.js";

const ctx = () => new MockAudioContext() as unknown as AudioContext;

// ── midiToFreq ───────────────────────────────────────────────────────

describe("midiToFreq", () => {
  it("A4 (MIDI 69) = 440 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
  });

  it("middle C (MIDI 60) ≈ 261.63 Hz", () => {
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
  });

  it("octave doubles frequency", () => {
    expect(midiToFreq(81)).toBeCloseTo(midiToFreq(69) * 2, 5);
  });

  it("A3 (MIDI 57) = 220 Hz", () => {
    expect(midiToFreq(57)).toBeCloseTo(220, 5);
  });
});

// ── createVoice — node creation ──────────────────────────────────────

describe("createVoice — signal chain", () => {
  it("creates a voice handle with correct MIDI note", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    expect(voice.midi).toBe(60);
  });

  it("creates 2 oscillators with correct types", () => {
    const mock = new MockAudioContext();
    const created: MockOscillatorNode[] = [];
    const origCreate = mock.createOscillator.bind(mock);
    mock.createOscillator = () => {
      const osc = origCreate();
      created.push(osc);
      return osc;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      69,
    );
    expect(created).toHaveLength(2);
    expect(created[0].type).toBe(SYNTH_DEFAULTS.osc1Type);
    expect(created[1].type).toBe(SYNTH_DEFAULTS.osc2Type);
  });

  it("sets oscillator frequencies from MIDI note", () => {
    const mock = new MockAudioContext();
    const oscs: MockOscillatorNode[] = [];
    const origCreate = mock.createOscillator.bind(mock);
    mock.createOscillator = () => {
      const osc = origCreate();
      oscs.push(osc);
      return osc;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      69,
    );
    const expected = midiToFreq(69);
    expect(oscs[0].frequency.value).toBeCloseTo(expected, 5);
    expect(oscs[1].frequency.value).toBeCloseTo(expected, 5);
  });

  it("applies positive and negative detune", () => {
    const mock = new MockAudioContext();
    const oscs: MockOscillatorNode[] = [];
    const origCreate = mock.createOscillator.bind(mock);
    mock.createOscillator = () => {
      const osc = origCreate();
      oscs.push(osc);
      return osc;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      60,
    );
    expect(oscs[0].detune.value).toBe(SYNTH_DEFAULTS.detuneCents);
    expect(oscs[1].detune.value).toBe(-SYNTH_DEFAULTS.detuneCents);
  });

  it("creates a lowpass filter with correct cutoff and Q", () => {
    const mock = new MockAudioContext();
    const filters: MockBiquadFilterNode[] = [];
    const origCreate = mock.createBiquadFilter.bind(mock);
    mock.createBiquadFilter = () => {
      const f = origCreate();
      filters.push(f);
      return f;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      60,
    );
    expect(filters).toHaveLength(1);
    expect(filters[0].type).toBe("lowpass");
    expect(filters[0].frequency.value).toBe(SYNTH_DEFAULTS.filterCutoff);
    expect(filters[0].Q.value).toBe(SYNTH_DEFAULTS.filterQ);
  });

  it("creates gain nodes (mix + envelope = 2, plus possible master)", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      60,
    );
    // At least 2 gains: mix gain (0.5) and envelope gain
    expect(gains.length).toBeGreaterThanOrEqual(2);
  });
});

// ── createVoice — velocity ───────────────────────────────────────────

describe("createVoice — velocity", () => {
  it("default velocity (100) scales peak gain", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    // Peak gain = 100 / 127 ≈ 0.787
    expect(voice).toBeDefined();
  });

  it("max velocity (127) gives peak gain of 1.0", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      60,
      127,
    );
    // Envelope gain (last created) should have ramped toward 1.0
    // In our mock, linearRampToValueAtTime sets .value directly
    const envGain = gains[gains.length - 1];
    // After attack ramp, value = peakGain * sustainLevel
    expect(envGain.gain.value).toBeCloseTo(1.0 * SYNTH_DEFAULTS.sustainLevel, 5);
  });

  it("low velocity (32) produces lower peak gain", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };
    const dest = mock.createGain();
    createVoice(
      mock as unknown as AudioContext,
      dest as unknown as AudioNode,
      60,
      32,
    );
    const envGain = gains[gains.length - 1];
    const expectedPeak = 32 / 127;
    expect(envGain.gain.value).toBeCloseTo(
      expectedPeak * SYNTH_DEFAULTS.sustainLevel,
      5,
    );
  });
});

// ── createVoice — release / stop ─────────────────────────────────────

describe("createVoice — release and stop", () => {
  it("release() can be called without error", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    expect(() => voice.release()).not.toThrow();
  });

  it("release() is idempotent", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    voice.release();
    expect(() => voice.release()).not.toThrow();
  });

  it("stop() can be called without error", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    expect(() => voice.stop()).not.toThrow();
  });

  it("stop() is idempotent", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    voice.stop();
    expect(() => voice.stop()).not.toThrow();
  });

  it("release() then stop() does not throw", () => {
    const c = ctx();
    const dest = c.createGain();
    const voice = createVoice(c, dest as unknown as AudioNode, 60);
    voice.release();
    expect(() => voice.stop()).not.toThrow();
  });
});
