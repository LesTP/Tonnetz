/**
 * Tests for synthesis presets.
 *
 * Validates preset object structure, gain staging, and PeriodicWave caching.
 * See DEVPLAN_3D.md §Test Strategy.
 */

import { describe, it, expect } from "vitest";
import {
  ALL_PRESETS,
  DEFAULT_PRESET,
  PRESET_SOFT_PAD,
  PRESET_CLASSIC,
  PRESET_WARM_PAD,
  PRESET_CATHEDRAL,
  PRESET_ELECTRIC_ORGAN,
  getPeriodicWave,
  getPresetByName,
  validateGainStaging,
  usesPeriodicWave,
  hasDelay,
  hasLfo,
  hasFilterBloom,
  type SynthPreset,
} from "../presets.js";
import { MockAudioContext } from "./web-audio-mock.js";

// ── Preset Object Validation ─────────────────────────────────────────

describe("Preset definitions — required fields", () => {
  const requiredStringFields: (keyof SynthPreset)[] = ["name", "label"];
  const requiredNumberFields: (keyof SynthPreset)[] = [
    "osc1Gain",
    "osc2Gain",
    "detuneCents",
    "filterCutoff",
    "filterQ",
    "attackTime",
    "decayTime",
    "sustainLevel",
    "releaseTime",
  ];

  it.each(ALL_PRESETS)("$name has all required string fields", (preset) => {
    for (const field of requiredStringFields) {
      expect(preset[field]).toBeDefined();
      expect(typeof preset[field]).toBe("string");
      expect((preset[field] as string).length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_PRESETS)("$name has all required number fields", (preset) => {
    for (const field of requiredNumberFields) {
      expect(preset[field]).toBeDefined();
      expect(typeof preset[field]).toBe("number");
      expect(Number.isFinite(preset[field])).toBe(true);
    }
  });

  it.each(ALL_PRESETS)("$name has valid oscillator types", (preset) => {
    const validTypes = ["sine", "square", "sawtooth", "triangle", "periodic", "sub"];
    expect(validTypes).toContain(preset.osc1Type);
    expect(validTypes).toContain(preset.osc2Type);
  });

  it.each(ALL_PRESETS)("$name has non-negative gain values", (preset) => {
    expect(preset.osc1Gain).toBeGreaterThanOrEqual(0);
    expect(preset.osc2Gain).toBeGreaterThanOrEqual(0);
  });

  it.each(ALL_PRESETS)("$name has positive envelope times", (preset) => {
    expect(preset.attackTime).toBeGreaterThan(0);
    expect(preset.decayTime).toBeGreaterThan(0);
    expect(preset.releaseTime).toBeGreaterThan(0);
  });

  it.each(ALL_PRESETS)("$name has valid sustain level (0–1)", (preset) => {
    expect(preset.sustainLevel).toBeGreaterThanOrEqual(0);
    expect(preset.sustainLevel).toBeLessThanOrEqual(1);
  });
});

// ── Gain Staging Verification ────────────────────────────────────────

describe("Preset definitions — gain staging", () => {
  it.each(ALL_PRESETS)("$name: 4 voices < 1.0 (no clipping)", (preset) => {
    expect(validateGainStaging(preset)).toBe(true);
  });

  it.each(ALL_PRESETS)("$name: per-voice sum × 4 < 1.0", (preset) => {
    const perVoiceSum = preset.osc1Gain + preset.osc2Gain;
    const fourVoicesPeak = perVoiceSum * 4;
    expect(fourVoicesPeak).toBeLessThan(1.0);
  });

  it("Soft Pad preset matches documented values (0.12 + 0.12 = 0.24)", () => {
    expect(PRESET_SOFT_PAD.osc1Gain).toBe(0.12);
    expect(PRESET_SOFT_PAD.osc2Gain).toBe(0.12);
    const sum = PRESET_SOFT_PAD.osc1Gain + PRESET_SOFT_PAD.osc2Gain;
    expect(sum).toBeCloseTo(0.24, 5);
  });
});

// ── ALL_PRESETS Registry ─────────────────────────────────────────────

describe("ALL_PRESETS", () => {
  it("contains exactly 4 presets", () => {
    expect(ALL_PRESETS).toHaveLength(4);
  });

  it("has no duplicate names", () => {
    const names = ALL_PRESETS.map((p) => p.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it("has no duplicate labels", () => {
    const labels = ALL_PRESETS.map((p) => p.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("includes all named preset exports", () => {
    expect(ALL_PRESETS).toContain(PRESET_SOFT_PAD);
    expect(ALL_PRESETS).toContain(PRESET_WARM_PAD);
    expect(ALL_PRESETS).toContain(PRESET_CATHEDRAL);
    expect(ALL_PRESETS).toContain(PRESET_ELECTRIC_ORGAN);
  });
});

// ── DEFAULT_PRESET ───────────────────────────────────────────────────

describe("DEFAULT_PRESET", () => {
  it("is PRESET_CATHEDRAL", () => {
    expect(DEFAULT_PRESET).toBe(PRESET_CATHEDRAL);
  });

  it("has name 'cathedral'", () => {
    expect(DEFAULT_PRESET.name).toBe("cathedral");
  });

  it("PRESET_CLASSIC alias points to PRESET_SOFT_PAD", () => {
    expect(PRESET_CLASSIC).toBe(PRESET_SOFT_PAD);
  });
});

// ── getPresetByName ──────────────────────────────────────────────────

describe("getPresetByName", () => {
  it("returns preset for valid name", () => {
    expect(getPresetByName("soft-pad")).toBe(PRESET_SOFT_PAD);
    expect(getPresetByName("warm-pad")).toBe(PRESET_WARM_PAD);
    expect(getPresetByName("cathedral")).toBe(PRESET_CATHEDRAL);
    expect(getPresetByName("electric-organ")).toBe(PRESET_ELECTRIC_ORGAN);
  });

  it("returns undefined for unknown name", () => {
    expect(getPresetByName("nonexistent")).toBeUndefined();
    expect(getPresetByName("")).toBeUndefined();
  });
});

// ── Utility Functions ────────────────────────────────────────────────

describe("usesPeriodicWave", () => {
  it("returns true for Cathedral (periodic osc1)", () => {
    expect(usesPeriodicWave(PRESET_CATHEDRAL)).toBe(true);
  });

  it("returns true for Electric Organ (periodic osc1)", () => {
    expect(usesPeriodicWave(PRESET_ELECTRIC_ORGAN)).toBe(true);
  });

  it("returns false for Soft Pad (no periodic)", () => {
    expect(usesPeriodicWave(PRESET_SOFT_PAD)).toBe(false);
  });

  it("returns false for Glass (sine+sine)", () => {
    expect(usesPeriodicWave({ osc1Type: "sine", osc2Type: "sine" } as any)).toBe(false);
  });
});

describe("hasDelay", () => {
  it("returns true for Warm Pad", () => {
    expect(hasDelay(PRESET_WARM_PAD)).toBe(true);
  });

  it("returns true for Cathedral (dual delay)", () => {
    expect(hasDelay(PRESET_CATHEDRAL)).toBe(true);
  });

  it("returns false for Soft Pad (dry)", () => {
    expect(hasDelay(PRESET_SOFT_PAD)).toBe(false);
  });

  it("returns false for Electric Organ (dry)", () => {
    expect(hasDelay(PRESET_ELECTRIC_ORGAN)).toBe(false);
  });
});

describe("hasLfo", () => {
  it("returns true for Electric Organ (pitch LFO)", () => {
    expect(hasLfo(PRESET_ELECTRIC_ORGAN)).toBe(true);
  });

  it("returns false for Soft Pad (no LFO)", () => {
    expect(hasLfo(PRESET_SOFT_PAD)).toBe(false);
  });

  it("returns false for Warm Pad (no LFO)", () => {
    expect(hasLfo(PRESET_WARM_PAD)).toBe(false);
  });
});

describe("hasFilterBloom", () => {
  it("returns true for Warm Pad", () => {
    expect(hasFilterBloom(PRESET_WARM_PAD)).toBe(true);
  });

  it("returns true for Cathedral (chiff)", () => {
    expect(hasFilterBloom(PRESET_CATHEDRAL)).toBe(true);
  });

  it("returns false for Classic", () => {
    expect(hasFilterBloom(PRESET_CLASSIC)).toBe(false);
  });

  it("returns false for Electric Organ", () => {
    expect(hasFilterBloom(PRESET_ELECTRIC_ORGAN)).toBe(false);
  });
});

// ── getPeriodicWave ──────────────────────────────────────────────────

describe("getPeriodicWave", () => {
  const ctx = () => new MockAudioContext() as unknown as AudioContext;

  it("returns null for presets without periodicWavePartials", () => {
    const mock = ctx();
    expect(getPeriodicWave(mock, PRESET_CLASSIC)).toBeNull();
    expect(getPeriodicWave(mock, PRESET_WARM_PAD)).toBeNull();
  });

  it("returns PeriodicWave for Cathedral preset", () => {
    const mock = ctx();
    const wave = getPeriodicWave(mock, PRESET_CATHEDRAL);
    expect(wave).not.toBeNull();
    expect(wave).toBeDefined();
  });

  it("returns PeriodicWave for Electric Organ preset", () => {
    const mock = ctx();
    const wave = getPeriodicWave(mock, PRESET_ELECTRIC_ORGAN);
    expect(wave).not.toBeNull();
    expect(wave).toBeDefined();
  });

  it("caches wave per context — same context returns same instance", () => {
    const mock = ctx();
    const wave1 = getPeriodicWave(mock, PRESET_CATHEDRAL);
    const wave2 = getPeriodicWave(mock, PRESET_CATHEDRAL);
    expect(wave1).toBe(wave2);
  });

  it("different contexts produce different instances", () => {
    const ctx1 = ctx();
    const ctx2 = ctx();
    const wave1 = getPeriodicWave(ctx1, PRESET_CATHEDRAL);
    const wave2 = getPeriodicWave(ctx2, PRESET_CATHEDRAL);
    expect(wave1).not.toBe(wave2);
  });

  it("different presets on same context produce different instances", () => {
    const mock = ctx();
    const waveCathedral = getPeriodicWave(mock, PRESET_CATHEDRAL);
    const waveElectric = getPeriodicWave(mock, PRESET_ELECTRIC_ORGAN);
    expect(waveCathedral).not.toBe(waveElectric);
  });
});

// ── Preset-Specific Validation ───────────────────────────────────────

describe("Preset-specific validation", () => {
  describe("Cathedral", () => {
    it("has periodicWavePartials array", () => {
      expect(PRESET_CATHEDRAL.periodicWavePartials).toBeDefined();
      expect(Array.isArray(PRESET_CATHEDRAL.periodicWavePartials)).toBe(true);
    });

    it("has sub-octave osc2 (type 'sub')", () => {
      expect(PRESET_CATHEDRAL.osc2Type).toBe("sub");
    });

    it("has dual delay (time1 and time2)", () => {
      expect(PRESET_CATHEDRAL.delay).toBeDefined();
      expect(PRESET_CATHEDRAL.delay!.time1).toBeGreaterThan(0);
      expect(PRESET_CATHEDRAL.delay!.time2).toBeGreaterThan(0);
    });

    it("has filter bloom (chiff)", () => {
      expect(PRESET_CATHEDRAL.filterBloom).toBeDefined();
      expect(PRESET_CATHEDRAL.filterBloom!.peak).toBeGreaterThan(
        PRESET_CATHEDRAL.filterBloom!.start,
      );
    });
  });

  describe("Electric Organ", () => {
    it("has periodicWavePartials for drawbar registration", () => {
      expect(PRESET_ELECTRIC_ORGAN.periodicWavePartials).toBeDefined();
      expect(PRESET_ELECTRIC_ORGAN.periodicWavePartials!.length).toBeGreaterThan(8);
    });

    it("has pitch LFO for Leslie effect", () => {
      expect(PRESET_ELECTRIC_ORGAN.lfo).toBeDefined();
      expect(PRESET_ELECTRIC_ORGAN.lfo!.target).toBe("pitch");
    });

    it("has gate-like envelope (very fast attack)", () => {
      expect(PRESET_ELECTRIC_ORGAN.attackTime).toBeLessThan(0.01);
    });

    it("has no delay (Leslie provides spatial cue)", () => {
      expect(PRESET_ELECTRIC_ORGAN.delay).toBeUndefined();
    });
  });

  describe("Warm Pad", () => {
    it("uses sawtooth+triangle oscillators", () => {
      expect(PRESET_WARM_PAD.osc1Type).toBe("sawtooth");
      expect(PRESET_WARM_PAD.osc2Type).toBe("triangle");
    });

    it("has filter bloom", () => {
      expect(PRESET_WARM_PAD.filterBloom).toBeDefined();
    });

    it("has no LFO (static)", () => {
      expect(PRESET_WARM_PAD.lfo).toBeUndefined();
    });
  });
});
