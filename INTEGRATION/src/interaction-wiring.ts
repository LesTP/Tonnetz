/**
 * Interaction wiring for the integration module.
 *
 * Phase 3a: Lazy audio initialization (createAppAudioState, ensureAudio).
 * Phase 3b: onPointerDown → hit-test → immediate audio (UX-D4).
 * Phase 3c: Post-classification wiring (select, pointer-up, state gating).
 *
 * This module produces an `InteractionCallbacks` object that the integration
 * module passes to `createInteractionController()`. It bridges RU interaction
 * events to AE immediate playback with UI state gating (UX-D6, INT-D6).
 *
 * See DEVPLAN §Phase 3.
 */

import type { WindowIndices, EdgeId, TriId } from "harmony-core";
import { getTrianglePcs, getEdgeUnionPcs } from "harmony-core";

import type { AudioTransport, ImmediatePlaybackState, EffectsChain } from "audio-engine";
import {
  initAudioSync,
  createImmediatePlayback,
  createEffectsChain,
  DEFAULT_PRESET,
  playPitchClasses,
  stopAll,
} from "audio-engine";

import type {
  WorldPoint,
  HitResult,
  InteractionCallbacks,
  UIStateController,
} from "rendering-ui";
import { hitTest, computeProximityRadius } from "rendering-ui";

// ── Phase 3a / 4d-1: Synchronous Audio Initialization ───────────────

/** Mutable holder for lazily-initialized audio state (INT-D3). */
export interface AppAudioState {
  transport: AudioTransport | null;
  immediatePlayback: ImmediatePlaybackState | null;
  effectsChain: EffectsChain | null;
}

/** Create a fresh uninitialized audio state holder. */
export function createAppAudioState(): AppAudioState {
  return {
    transport: null,
    immediatePlayback: null,
    effectsChain: null,
  };
}

/**
 * Ensure audio is initialized, lazy-init on first call (INT-D3, Phase 4d-1).
 *
 * Synchronous: creates AudioContext and calls resume() in the same call stack.
 * On iOS Safari, this is required — resume() must be called within the user
 * gesture handler, not after an await (which breaks the gesture chain).
 *
 * - First call: creates AudioContext + ImmediatePlaybackState synchronously.
 * - Subsequent calls: returns cached instances immediately.
 *
 * Must be called from a user gesture handler (browser autoplay policy).
 */
export function ensureAudio(
  state: AppAudioState,
): { transport: AudioTransport; immediatePlayback: ImmediatePlaybackState; effectsChain: EffectsChain } {
  if (state.transport && state.immediatePlayback && state.effectsChain) {
    return {
      transport: state.transport,
      immediatePlayback: state.immediatePlayback,
      effectsChain: state.effectsChain,
    };
  }

  const transport = initAudioSync();
  const ctx = transport.getContext();

  // Create effects chain first, then immediate playback connected to it
  const chain = createEffectsChain(ctx, DEFAULT_PRESET);
  const immediatePlayback = createImmediatePlayback(transport, {
    effectsChain: chain,
    preset: DEFAULT_PRESET,
  });

  state.transport = transport;
  state.immediatePlayback = immediatePlayback;
  state.effectsChain = chain;

  return { transport, immediatePlayback, effectsChain: chain };
}

// ── Phase 3b/3c: Interaction Callbacks Factory ──────────────────────

/** Options for creating interaction wiring callbacks. */
export interface InteractionWiringOptions {
  /** Lazily-initialized audio state holder. */
  audioState: AppAudioState;
  /** UI state controller for state gating (UX-D6, INT-D6). */
  uiState: UIStateController;
  /** Returns current WindowIndices (typically from ResizeController). */
  getIndices: () => WindowIndices;
  /** Proximity radius for hit-testing (world units). */
  proximityRadius?: number;
}

/** States where interactive playback is suppressed (UX-D6, POL-D28). */
function isPlaybackSuppressed(uiState: UIStateController): boolean {
  return uiState.getState() === "playback-running";
}

/**
 * Create `InteractionCallbacks` that wire RU gesture events to AE playback.
 *
 * The returned callbacks implement:
 * - **onPointerDown** (Phase 3b): immediate audio on hit-test (UX-D4)
 * - **onTriangleSelect** (Phase 3c): UI state selection (audio already playing)
 * - **onEdgeSelect** (Phase 3c): UI state selection (audio already playing)
 * - **onPointerUp** (Phase 3c): stop all audio
 *
 * Audio and selection suppressed during `playback-running` only (UX-D6).
 * Exploration allowed during `progression-loaded` (POL-D28, revises INT-D6).
 */
export function createInteractionWiring(
  options: InteractionWiringOptions,
): InteractionCallbacks {
  const {
    audioState,
    uiState,
    getIndices,
    proximityRadius = computeProximityRadius(),
  } = options;

// ── Phase 3b: onPointerDown → immediate audio (UX-D4) ──────────

const onPointerDown = (world: WorldPoint): void => {
  if (isPlaybackSuppressed(uiState)) return;

  const indices = getIndices();
  const hit: HitResult = hitTest(world.x, world.y, proximityRadius, indices);

  if (hit.type === "none") return;

  // ensureAudio is synchronous (Phase 4d-1) — AudioContext created and
  // resume() called within this gesture handler's call stack, which is
  // required for iOS Safari autoplay policy.
  const { immediatePlayback } = ensureAudio(audioState);

  let pcs: readonly number[] | null = null;

  if (hit.type === "triangle") {
    const triRef = indices.triIdToRef.get(hit.triId);
    if (triRef) {
      pcs = getTrianglePcs(triRef);
    }
  } else if (hit.type === "edge") {
    pcs = getEdgeUnionPcs(hit.edgeId, indices);
  } else if (hit.type === "node") {
    pcs = [hit.pc];
  }

  if (pcs && pcs.length > 0) {
    playPitchClasses(immediatePlayback, pcs);
  }
};

// ── Phase 3c: Post-classification callbacks ─────────────────────

const onTriangleSelect = (_triId: TriId, _pcs: number[]): void => {
  if (isPlaybackSuppressed(uiState)) return;
  // Audio already playing from onPointerDown (UX-D4).
  // Visual highlighting now handled in onPointerDown wrapper (main.ts).
};

const onEdgeSelect = (
  _edgeId: EdgeId,
  _triIds: [TriId, TriId],
  _pcs: number[],
): void => {
  if (isPlaybackSuppressed(uiState)) return;
  // Audio already playing from onPointerDown.
  // Visual highlighting now handled in onPointerDown wrapper (main.ts).
};

const onPointerUp = (): void => {
  if (audioState.immediatePlayback) {
    stopAll(audioState.immediatePlayback);
  }
};

  return {
    onPointerDown,
    onTriangleSelect,
    onEdgeSelect,
    onPointerUp,
  };
}
