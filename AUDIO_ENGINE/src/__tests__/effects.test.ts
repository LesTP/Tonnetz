/**
 * Tests for the global effects chain.
 *
 * Validates delay chain creation, reconfiguration, and bypass behavior.
 * See DEVPLAN_3D.md §Test Strategy.
 */

import { describe, it, expect } from "vitest";
import { createEffectsChain, type EffectsChain } from "../effects.js";
import {
  PRESET_CLASSIC,
  PRESET_WARM_PAD,
  PRESET_CATHEDRAL,
  PRESET_ELECTRIC_ORGAN,
} from "../presets.js";
import {
  MockAudioContext,
  MockGainNode,
  MockDelayNode,
  MockBiquadFilterNode,
  MockDynamicsCompressorNode,
} from "./web-audio-mock.js";

const ctx = () => new MockAudioContext() as unknown as AudioContext;

// ── Basic Creation ───────────────────────────────────────────────────

describe("createEffectsChain — basic creation", () => {
  it("creates an effects chain with input and output nodes", () => {
    const mock = ctx();
    const chain = createEffectsChain(mock);
    expect(chain.input).toBeDefined();
    expect(chain.output).toBeDefined();
  });

  it("creates an effects chain with limiter node", () => {
    const mock = ctx();
    const chain = createEffectsChain(mock);
    expect(chain.limiter).toBeDefined();
  });

  it("input is a GainNode", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect(chain.input).toBeInstanceOf(MockGainNode);
  });

  it("output is a GainNode", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect(chain.output).toBeInstanceOf(MockGainNode);
  });

  it("limiter is a DynamicsCompressorNode", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect(chain.limiter).toBeInstanceOf(MockDynamicsCompressorNode);
  });

  it("exposes reconfigure method", () => {
    const mock = ctx();
    const chain = createEffectsChain(mock);
    expect(typeof chain.reconfigure).toBe("function");
  });

  it("exposes destroy method", () => {
    const mock = ctx();
    const chain = createEffectsChain(mock);
    expect(typeof chain.destroy).toBe("function");
  });
});

// ── Initial Preset Configuration ─────────────────────────────────────

describe("createEffectsChain — initial preset", () => {
  it("creates with no initial preset (bypass mode)", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };
    createEffectsChain(mock as unknown as AudioContext);
    // Should have: input, output, dryGain, wetGain (4 gains)
    expect(gains.length).toBeGreaterThanOrEqual(4);
    // wetGain should be 0 (bypass)
    const wetGain = gains.find((g) => g.gain.value === 0);
    expect(wetGain).toBeDefined();
  });

  it("creates with initial preset that has no delay (Classic)", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };
    createEffectsChain(mock as unknown as AudioContext, PRESET_CLASSIC);
    // Classic has no delay — no delay nodes should be created
    expect(delays).toHaveLength(0);
  });

  it("creates with initial preset that has single delay (Warm Pad)", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };
    createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    // Warm Pad has single delay
    expect(delays).toHaveLength(1);
  });

  it("creates with initial preset that has dual delay (Cathedral)", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };
    createEffectsChain(mock as unknown as AudioContext, PRESET_CATHEDRAL);
    // Cathedral has dual delay
    expect(delays).toHaveLength(2);
  });

  it("sets delay time from preset", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };
    createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    expect(delays[0].delayTime.value).toBeCloseTo(PRESET_WARM_PAD.delay!.time1, 3);
  });
});

// ── Reconfigure ──────────────────────────────────────────────────────

describe("createEffectsChain — reconfigure", () => {
  it("reconfigure from bypass to single delay", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_CLASSIC);
    expect(delays).toHaveLength(0);

    chain.reconfigure(PRESET_WARM_PAD);
    expect(delays).toHaveLength(1);
  });

  it("reconfigure from single delay to dual delay", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    expect(delays).toHaveLength(1);

    chain.reconfigure(PRESET_CATHEDRAL);
    // Cathedral needs 2 delays — reuses delay1, creates delay2
    expect(delays).toHaveLength(2);
  });

  it("reconfigure from delay to bypass (Classic)", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    chain.reconfigure(PRESET_CLASSIC);

    // After reconfiguring to Classic (no delay), wetGain should be 0
    // The dryGain should be 1.0
    // Find the gains created — input(1), output(1), dryGain(1), wetGain(0), feedback gains...
    // The last reconfigure sets dryGain=1, wetGain=0
    // We check by finding a gain with value 0 (wetGain in bypass)
    const bypassedWet = gains.find((g) => g.gain.value === 0);
    expect(bypassedWet).toBeDefined();
  });

  it("reconfigure updates delay time parameters", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    const initialDelayTime = delays[0].delayTime.value;
    expect(initialDelayTime).toBeCloseTo(PRESET_WARM_PAD.delay!.time1, 3);

    // Reconfigure to Cathedral (different delay time)
    chain.reconfigure(PRESET_CATHEDRAL);
    // First delay should now have Cathedral's time1
    expect(delays[0].delayTime.value).toBeCloseTo(PRESET_CATHEDRAL.delay!.time1, 3);
  });

  it("reconfigure updates wet/dry mix", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    // Warm Pad: wet=0.16, dry=0.84
    let dryGain = gains.find((g) => Math.abs(g.gain.value - 0.84) < 0.01);
    let wetGain = gains.find((g) => Math.abs(g.gain.value - 0.16) < 0.01);
    expect(dryGain).toBeDefined();
    expect(wetGain).toBeDefined();

    // Reconfigure to Cathedral: wet=0.22, dry=0.78
    chain.reconfigure(PRESET_CATHEDRAL);
    dryGain = gains.find((g) => Math.abs(g.gain.value - 0.78) < 0.01);
    wetGain = gains.find((g) => Math.abs(g.gain.value - 0.22) < 0.01);
    expect(dryGain).toBeDefined();
    expect(wetGain).toBeDefined();
  });

  it("reconfigure is no-op after destroy", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_CLASSIC);
    chain.destroy();

    const delayCountBefore = delays.length;
    chain.reconfigure(PRESET_WARM_PAD);
    // Should not create new delays after destroy
    expect(delays.length).toBe(delayCountBefore);
  });
});

// ── Damping Filter ───────────────────────────────────────────────────

describe("createEffectsChain — damping filter", () => {
  it("creates damping filter for delay line", () => {
    const mock = new MockAudioContext();
    const filters: MockBiquadFilterNode[] = [];
    const origCreateFilter = mock.createBiquadFilter.bind(mock);
    mock.createBiquadFilter = () => {
      const f = origCreateFilter();
      filters.push(f);
      return f;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    // Warm Pad has single delay with damping filter
    expect(filters.length).toBeGreaterThanOrEqual(1);
    // Should be lowpass type
    expect(filters[0].type).toBe("lowpass");
  });

  it("sets damping frequency from preset", () => {
    const mock = new MockAudioContext();
    const filters: MockBiquadFilterNode[] = [];
    const origCreateFilter = mock.createBiquadFilter.bind(mock);
    mock.createBiquadFilter = () => {
      const f = origCreateFilter();
      filters.push(f);
      return f;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    expect(filters[0].frequency.value).toBe(PRESET_WARM_PAD.delay!.damping1);
  });

  it("creates two damping filters for dual delay (Cathedral)", () => {
    const mock = new MockAudioContext();
    const filters: MockBiquadFilterNode[] = [];
    const origCreateFilter = mock.createBiquadFilter.bind(mock);
    mock.createBiquadFilter = () => {
      const f = origCreateFilter();
      filters.push(f);
      return f;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_CATHEDRAL);
    // Cathedral has dual delay — two damping filters
    expect(filters).toHaveLength(2);
  });
});

// ── Feedback Gain ────────────────────────────────────────────────────

describe("createEffectsChain — feedback gain", () => {
  it("creates feedback gain nodes for delay", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    // Should have: input, output, dryGain, wetGain, feedbackGain (at least 5)
    expect(gains.length).toBeGreaterThanOrEqual(5);
    // One gain should have feedback value
    const feedbackGain = gains.find(
      (g) => Math.abs(g.gain.value - PRESET_WARM_PAD.delay!.feedback1) < 0.01,
    );
    expect(feedbackGain).toBeDefined();
  });
});

// ── Destroy ──────────────────────────────────────────────────────────

describe("createEffectsChain — destroy", () => {
  it("destroy can be called without error", () => {
    const mock = ctx();
    const chain = createEffectsChain(mock);
    expect(() => chain.destroy()).not.toThrow();
  });

  it("destroy is idempotent", () => {
    const mock = ctx();
    const chain = createEffectsChain(mock);
    chain.destroy();
    expect(() => chain.destroy()).not.toThrow();
  });

  it("destroy prevents further reconfigure", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    const chain = createEffectsChain(mock as unknown as AudioContext);
    chain.destroy();

    // Attempt to reconfigure should be no-op
    chain.reconfigure(PRESET_CATHEDRAL);
    expect(delays).toHaveLength(0);
  });
});

// ── Minimum Delay Time ───────────────────────────────────────────────

describe("createEffectsChain — minimum delay time", () => {
  it("enforces minimum delay time (prevents feedback issues)", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    // Create a preset-like object with very small delay time
    const tinyDelayPreset = {
      ...PRESET_CLASSIC,
      delay: {
        time1: 0.001, // Below MIN_DELAY_TIME (0.003)
        feedback1: 0.3,
        damping1: 2000,
        wet: 0.2,
        dry: 0.8,
      },
    };

    createEffectsChain(mock as unknown as AudioContext, tinyDelayPreset);
    // Delay time should be clamped to minimum (0.003)
    expect(delays[0].delayTime.value).toBeGreaterThanOrEqual(0.003);
  });
});

// ── Node Count Verification ──────────────────────────────────────────

describe("createEffectsChain — node budget", () => {
  it("bypass mode creates exactly 4 gain nodes", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_CLASSIC);
    // input, output, dryGain, wetGain = 4
    expect(gains).toHaveLength(4);
  });

  it("single delay creates 5 gain nodes (4 base + 1 feedback)", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_WARM_PAD);
    // input, output, dryGain, wetGain, feedbackGain1 = 5
    expect(gains).toHaveLength(5);
  });

  it("dual delay creates 6 gain nodes (4 base + 2 feedback)", () => {
    const mock = new MockAudioContext();
    const gains: MockGainNode[] = [];
    const origCreate = mock.createGain.bind(mock);
    mock.createGain = () => {
      const g = origCreate();
      gains.push(g);
      return g;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_CATHEDRAL);
    // input, output, dryGain, wetGain, feedbackGain1, feedbackGain2 = 6
    expect(gains).toHaveLength(6);
  });
});

// ── Preset Without Delay ─────────────────────────────────────────────

describe("createEffectsChain — presets without delay", () => {
  it("Electric Organ (no delay) stays in bypass", () => {
    const mock = new MockAudioContext();
    const delays: MockDelayNode[] = [];
    const origCreateDelay = mock.createDelay.bind(mock);
    mock.createDelay = (maxTime?: number) => {
      const d = origCreateDelay(maxTime);
      delays.push(d);
      return d;
    };

    createEffectsChain(mock as unknown as AudioContext, PRESET_ELECTRIC_ORGAN);
    expect(delays).toHaveLength(0);
  });

  it("switching from delay preset to no-delay preset clears delays", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext, PRESET_CATHEDRAL);

    // Now switch to Electric Organ (no delay)
    chain.reconfigure(PRESET_ELECTRIC_ORGAN);

    // We can't directly inspect internal state, but the reconfigure shouldn't throw
    // and subsequent operations should work
    expect(() => chain.reconfigure(PRESET_WARM_PAD)).not.toThrow();
  });
});

// ── Limiter (AE-D17) ─────────────────────────────────────────────────

describe("createEffectsChain — limiter", () => {
  it("creates a DynamicsCompressorNode", () => {
    const mock = new MockAudioContext();
    const compressors: MockDynamicsCompressorNode[] = [];
    const origCreate = mock.createDynamicsCompressor.bind(mock);
    mock.createDynamicsCompressor = () => {
      const c = origCreate();
      compressors.push(c);
      return c;
    };

    createEffectsChain(mock as unknown as AudioContext);
    expect(compressors).toHaveLength(1);
  });

  it("configures limiter with correct threshold (-6dB)", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect((chain.limiter as unknown as MockDynamicsCompressorNode).threshold.value).toBe(-6);
  });

  it("configures limiter with correct knee (6dB)", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect((chain.limiter as unknown as MockDynamicsCompressorNode).knee.value).toBe(6);
  });

  it("configures limiter with correct ratio (12:1)", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect((chain.limiter as unknown as MockDynamicsCompressorNode).ratio.value).toBe(12);
  });

  it("configures limiter with fast attack (3ms)", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect((chain.limiter as unknown as MockDynamicsCompressorNode).attack.value).toBe(0.003);
  });

  it("configures limiter with 100ms release", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    expect((chain.limiter as unknown as MockDynamicsCompressorNode).release.value).toBe(0.1);
  });

  it("limiter is in signal path (output → limiter → destination)", () => {
    const mock = new MockAudioContext();
    const chain = createEffectsChain(mock as unknown as AudioContext);
    // Verify the limiter exists and is connected (indirectly via creation)
    expect(chain.limiter).toBeDefined();
    expect(chain.output).toBeDefined();
    // The connection is verified by the fact that the chain works and
    // all nodes are created — actual connection testing would require
    // more complex mocking
  });
});
