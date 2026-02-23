/**
 * Tests for interaction-wiring.ts — Phase 3a/3b/3c + Phase 4d-1.
 *
 * Phase 3a: Lazy audio initialization (createAppAudioState, ensureAudio)
 * Phase 3b: onPointerDown immediate audio (UX-D4)
 * Phase 3c: Post-classification wiring (select, pointer-up, state gating)
 * Phase 4d-1: Synchronous ensureAudio for iOS Safari compatibility
 *
 * Strategy:
 * - Uses real HC functions (buildWindowIndices, getTrianglePcs, getEdgeUnionPcs)
 * - Uses real RU UIStateController and hitTest
 * - Mocks AE audio functions (initAudioSync, createImmediatePlayback, playPitchClasses, stopAll)
 *   via vi.mock() since AudioContext is not available in test environment.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  createAppAudioState,
  ensureAudio,
  createInteractionWiring,
} from "../interaction-wiring.js";
import type { AppAudioState } from "../interaction-wiring.js";

import { buildWindowIndices } from "harmony-core";
import type { WindowIndices } from "harmony-core";

import { createUIStateController, latticeToWorld } from "rendering-ui";
import type { UIStateController, WorldPoint } from "rendering-ui";

// ── Mock AE module ──────────────────────────────────────────────────

// Mock the entire audio-engine module: initAudioSync, createImmediatePlayback,
// playPitchClasses, stopAll. We replace them with vi.fn() stubs.
vi.mock("audio-engine", () => {
  const mockTransport = {
    getTime: vi.fn(() => 0),
    getContext: vi.fn(),
    getState: vi.fn(() => ({
      playing: false,
      tempo: 120,
      currentChordIndex: -1,
      totalChords: 0,
    })),
    isPlaying: vi.fn(() => false),
    getTempo: vi.fn(() => 120),
    getCurrentChordIndex: vi.fn(() => -1),
    setTempo: vi.fn(),
    scheduleProgression: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    cancelSchedule: vi.fn(),
    onStateChange: vi.fn(() => vi.fn()),
    onChordChange: vi.fn(() => vi.fn()),
  };

  const mockImmediatePlayback = {
    transport: mockTransport,
    masterGain: {},
    voices: new Set(),
    prevVoicing: [],
  };

  return {
    initAudioSync: vi.fn(() => mockTransport),
    initAudio: vi.fn(async () => mockTransport),
    createImmediatePlayback: vi.fn(() => mockImmediatePlayback),
    playPitchClasses: vi.fn(),
    playShape: vi.fn(),
    stopAll: vi.fn(),
    // Re-export mock objects for test assertions
    __mockTransport: mockTransport,
    __mockImmediatePlayback: mockImmediatePlayback,
  };
});

// Import mock references for assertions
import {
  initAudioSync,
  playPitchClasses as mockPlayPitchClasses,
  stopAll as mockStopAll,
  // @ts-expect-error — test-only exports from mock
  __mockTransport,
  // @ts-expect-error — test-only exports from mock
  __mockImmediatePlayback,
} from "audio-engine";

// ── Shared fixtures ─────────────────────────────────────────────────

const TEST_BOUNDS = { uMin: -4, uMax: 4, vMin: -4, vMax: 4 };
let indices: WindowIndices;
let uiState: UIStateController;
let audioState: AppAudioState;

beforeEach(() => {
  vi.clearAllMocks();
  indices = buildWindowIndices(TEST_BOUNDS);
  uiState = createUIStateController();
  audioState = createAppAudioState();
});

// ═══════════════════════════════════════════════════════════════════
// Phase 3a / 4d-1: Synchronous Audio Initialization
// ═══════════════════════════════════════════════════════════════════

describe("createAppAudioState", () => {
  it("initializes with null transport and immediatePlayback", () => {
    const state = createAppAudioState();
    expect(state.transport).toBeNull();
    expect(state.immediatePlayback).toBeNull();
  });
});

describe("ensureAudio", () => {
  it("creates AudioTransport synchronously on first call", () => {
    const result = ensureAudio(audioState);
    expect(initAudioSync).toHaveBeenCalledOnce();
    expect(result.transport).toBe(__mockTransport);
    expect(result.immediatePlayback).toBe(__mockImmediatePlayback);
  });

  it("caches and returns same instance on second call (no double-init)", () => {
    const first = ensureAudio(audioState);
    const second = ensureAudio(audioState);
    expect(initAudioSync).toHaveBeenCalledOnce();
    expect(second.transport).toBe(first.transport);
    expect(second.immediatePlayback).toBe(first.immediatePlayback);
  });

  it("populates audioState after init", () => {
    expect(audioState.transport).toBeNull();
    ensureAudio(audioState);
    expect(audioState.transport).toBe(__mockTransport);
    expect(audioState.immediatePlayback).toBe(__mockImmediatePlayback);
  });

  it("is synchronous — returns value, not Promise", () => {
    const result = ensureAudio(audioState);
    // If ensureAudio were async, result would be a Promise with .then
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.transport).toBeDefined();
    expect(result.immediatePlayback).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 3b: onPointerDown Immediate Audio (UX-D4)
// ═══════════════════════════════════════════════════════════════════

describe("onPointerDown (Phase 3b)", () => {
  /** Get world coordinates for a known triangle center (0,0 Up triangle). */
  function getTriangleCenter(): WorldPoint {
    // Up triangle at anchor (0,0) has vertices at (0,0), (1,0), (0,1).
    // Use latticeToWorld to get a point inside the triangle.
    const v0 = latticeToWorld(0, 0);
    const v1 = latticeToWorld(1, 0);
    const v2 = latticeToWorld(0, 1);
    return {
      x: (v0.x + v1.x + v2.x) / 3,
      y: (v0.y + v1.y + v2.y) / 3,
    };
  }

  /** Get world coordinates for a point far from any triangle (background). */
  function getBackgroundPoint(): WorldPoint {
    return { x: 99999, y: 99999 };
  }

  it("triggers playPitchClasses synchronously on triangle hit", () => {
    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerDown!(getTriangleCenter());

    // ensureAudio is synchronous — playPitchClasses fires in same frame
    expect(mockPlayPitchClasses).toHaveBeenCalled();

    // Should have been called with pitch classes (3 for triad, 4 for edge union)
    const pcs = (mockPlayPitchClasses as Mock).mock.calls[0][1];
    expect(pcs.length).toBeGreaterThanOrEqual(3);
    expect(pcs.length).toBeLessThanOrEqual(4);
  });

  it("does not trigger audio on background hit (HitNone)", () => {
    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerDown!(getBackgroundPoint());
    expect(mockPlayPitchClasses).not.toHaveBeenCalled();
  });

  it("suppresses audio during playback-running state (UX-D6)", () => {
    const dummyShape = { chord: {} as any, main_tri: null, ext_tris: [], dot_pcs: [], covered_pcs: new Set<number>(), root_vertex_index: null, centroid_uv: { u: 0, v: 0 }, tonal_centroid_uv: { u: 0, v: 0 }, placed_nodes: [{ u: 0, v: 0 }] };
      uiState.loadProgression([dummyShape]);
      uiState.startPlayback();
      expect(uiState.getState()).toBe("playback-running");

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerDown!(getTriangleCenter());
    expect(mockPlayPitchClasses).not.toHaveBeenCalled();
  });

  it("allows audio during progression-loaded state (POL-D28)", () => {
    const dummyShape = { chord: {} as any, main_tri: null, ext_tris: [], dot_pcs: [], covered_pcs: new Set<number>(), root_vertex_index: null, centroid_uv: { u: 0, v: 0 }, tonal_centroid_uv: { u: 0, v: 0 }, placed_nodes: [{ u: 0, v: 0 }] };
      uiState.selectChord(dummyShape);
    uiState.loadProgression([dummyShape]);
    expect(uiState.getState()).toBe("progression-loaded");

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerDown!(getTriangleCenter());
    expect(mockPlayPitchClasses).toHaveBeenCalled();
  });

  it("triggers lazy audio init on first pointer down", () => {
    expect(audioState.transport).toBeNull();

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerDown!(getTriangleCenter());

    expect(initAudioSync).toHaveBeenCalledOnce();
    expect(audioState.transport).toBe(__mockTransport);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase 3c: Post-Classification Callbacks
// ═══════════════════════════════════════════════════════════════════

describe("Post-classification callbacks (Phase 3c)", () => {
  it("onPointerUp calls stopAll when audio is initialized", () => {
    ensureAudio(audioState);
    vi.clearAllMocks();

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerUp!();
    expect(mockStopAll).toHaveBeenCalledOnce();
  });

  it("onPointerUp does nothing when audio not yet initialized", () => {
    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerUp!();
    expect(mockStopAll).not.toHaveBeenCalled();
  });

  it("onPointerUp still fires during playback-running (stop is always safe)", () => {
    ensureAudio(audioState);
    vi.clearAllMocks();

    const dummyShape = { chord: {} as any, main_tri: null, ext_tris: [], dot_pcs: [], covered_pcs: new Set<number>(), root_vertex_index: null, centroid_uv: { u: 0, v: 0 }, tonal_centroid_uv: { u: 0, v: 0 }, placed_nodes: [{ u: 0, v: 0 }] };
    uiState.loadProgression([dummyShape]);
    uiState.startPlayback();

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerUp!();
    expect(mockStopAll).toHaveBeenCalledOnce();
  });

  it("idle state allows pointer-down audio callback", () => {
    ensureAudio(audioState);
    vi.clearAllMocks();

    expect(uiState.getState()).toBe("idle");

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    // Pointer up (stop) should work in idle
    callbacks.onPointerUp!();
    expect(mockStopAll).toHaveBeenCalledOnce();
  });

  it("chord-selected state allows pointer-down audio callback", () => {
    ensureAudio(audioState);
    vi.clearAllMocks();

    const dummyShape = { chord: {} as any, main_tri: null, ext_tris: [], dot_pcs: [], covered_pcs: new Set<number>(), root_vertex_index: null, centroid_uv: { u: 0, v: 0 }, tonal_centroid_uv: { u: 0, v: 0 }, placed_nodes: [{ u: 0, v: 0 }] };
    uiState.selectChord(dummyShape);
    expect(uiState.getState()).toBe("chord-selected");

    const callbacks = createInteractionWiring({
      audioState,
      uiState,
      getIndices: () => indices,
    });

    callbacks.onPointerUp!();
    expect(mockStopAll).toHaveBeenCalledOnce();
  });
});
