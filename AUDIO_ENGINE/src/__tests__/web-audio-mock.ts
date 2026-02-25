/**
 * Lightweight Web Audio API mock for Vitest.
 *
 * Covers the AudioContext surface used by Audio Engine.
 * Phase 1b: currentTime, state, resume(), destination, createGain().
 * Extended in later phases as synthesis nodes are introduced.
 */

// ── Mock AudioParam ──────────────────────────────────────────────────

export class MockAudioParam {
  value: number;
  readonly defaultValue: number;
  readonly minValue: number = -3.4028235e38;
  readonly maxValue: number = 3.4028235e38;
  automationRate: AutomationRate = "a-rate";

  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.defaultValue = defaultValue;
  }

  setValueAtTime(value: number, _startTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, _endTime: number): MockAudioParam {
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(
    value: number,
    _endTime: number,
  ): MockAudioParam {
    this.value = value;
    return this;
  }

  setTargetAtTime(
    target: number,
    _startTime: number,
    _timeConstant: number,
  ): MockAudioParam {
    this.value = target;
    return this;
  }

  cancelScheduledValues(_startTime: number): MockAudioParam {
    return this;
  }

  cancelAndHoldAtTime(_cancelTime: number): MockAudioParam {
    return this;
  }
}

// ── Mock AudioNode ───────────────────────────────────────────────────

export class MockAudioNode {
  readonly context: MockAudioContext;
  readonly numberOfInputs: number = 1;
  readonly numberOfOutputs: number = 1;
  channelCount: number = 2;
  channelCountMode: ChannelCountMode = "max";
  channelInterpretation: ChannelInterpretation = "speakers";

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect(destination: MockAudioNode | MockAudioParam): MockAudioNode {
    return destination instanceof MockAudioNode ? destination : this;
  }

  disconnect(): void {
    // no-op
  }
}

// ── Mock GainNode ────────────────────────────────────────────────────

export class MockGainNode extends MockAudioNode {
  readonly gain: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.gain = new MockAudioParam(1);
  }
}

// ── Mock PeriodicWave ────────────────────────────────────────────────

export class MockPeriodicWave {
  readonly real: Float32Array;
  readonly imag: Float32Array;

  constructor(real: Float32Array, imag: Float32Array) {
    this.real = real;
    this.imag = imag;
  }
}

// ── Mock OscillatorNode ──────────────────────────────────────────────

export class MockOscillatorNode extends MockAudioNode {
  readonly frequency: MockAudioParam;
  readonly detune: MockAudioParam;
  type: OscillatorType = "sine";
  private _periodicWave: MockPeriodicWave | null = null;

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(440);
    this.detune = new MockAudioParam(0);
  }

  start(_when?: number): void {
    // no-op
  }

  stop(_when?: number): void {
    // no-op
  }

  setPeriodicWave(wave: MockPeriodicWave): void {
    this._periodicWave = wave;
  }

  getPeriodicWave(): MockPeriodicWave | null {
    return this._periodicWave;
  }
}

// ── Mock DelayNode ───────────────────────────────────────────────────

export class MockDelayNode extends MockAudioNode {
  readonly delayTime: MockAudioParam;

  constructor(context: MockAudioContext, maxDelayTime: number = 1.0) {
    super(context);
    this.delayTime = new MockAudioParam(0);
    // Store maxDelayTime for potential validation (not used in mock)
    void maxDelayTime;
  }
}

// ── Mock BiquadFilterNode ────────────────────────────────────────────

export class MockBiquadFilterNode extends MockAudioNode {
  readonly frequency: MockAudioParam;
  readonly Q: MockAudioParam;
  readonly gain: MockAudioParam;
  readonly detune: MockAudioParam;
  type: BiquadFilterType = "lowpass";

  constructor(context: MockAudioContext) {
    super(context);
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
    this.detune = new MockAudioParam(0);
  }
}

// ── Mock AudioDestinationNode ────────────────────────────────────────

export class MockAudioDestinationNode extends MockAudioNode {
  readonly maxChannelCount: number = 2;

  constructor(context: MockAudioContext) {
    super(context);
  }
}

// ── Mock AudioContext ────────────────────────────────────────────────

export class MockAudioContext {
  /** Mutable for test control. Monotonically increasing in real API. */
  _currentTime = 0;
  _state: AudioContextState = "running";

  readonly destination: MockAudioDestinationNode;
  readonly sampleRate: number = 44100;

  constructor() {
    this.destination = new MockAudioDestinationNode(this);
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get state(): AudioContextState {
    return this._state;
  }

  async resume(): Promise<void> {
    this._state = "running";
  }

  async close(): Promise<void> {
    this._state = "closed";
  }

  createGain(): MockGainNode {
    return new MockGainNode(this);
  }

  createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode(this);
  }

  createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode(this);
  }

  createPeriodicWave(
    real: Float32Array,
    imag: Float32Array,
    _constraints?: PeriodicWaveConstraints,
  ): MockPeriodicWave {
    return new MockPeriodicWave(real, imag);
  }

  createDelay(maxDelayTime: number = 1.0): MockDelayNode {
    return new MockDelayNode(this, maxDelayTime);
  }
}

// ── Suspended variant (for testing autoplay policy handling) ─────────

export class MockSuspendedAudioContext extends MockAudioContext {
  constructor() {
    super();
    this._state = "suspended";
  }
}
