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

import type { AudioTransport, ImmediatePlaybackState } from "audio-engine";
import {
  initAudio,
  createImmediatePlayback,
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

// ── Phase 3a: Lazy Audio Initialization ─────────────────────────────

/** Mutable holder for lazily-initialized audio state (INT-D3). */
export interface AppAudioState {
  transport: AudioTransport | null;
  immediatePlayback: ImmediatePlaybackState | null;
  /** Resolves when audio init is in progress to prevent double-init. */
  initPromise: Promise<void> | null;
}

/** Create a fresh uninitialized audio state holder. */
export function createAppAudioState(): AppAudioState {
  return {
    transport: null,
    immediatePlayback: null,
    initPromise: null,
  };
}

/**
 * Ensure audio is initialized, lazy-init on first call (INT-D3).
 *
 * - First call: creates AudioContext + ImmediatePlaybackState, caches both.
 * - Subsequent calls: returns cached instances immediately.
 * - Concurrent calls during init: dedup via shared promise.
 *
 * Must be called from a user gesture handler (browser autoplay policy).
 */
export async function ensureAudio(
  state: AppAudioState,
): Promise<{ transport: AudioTransport; immediatePlayback: ImmediatePlaybackState }> {
  if (state.transport && state.immediatePlayback) {
    return {
      transport: state.transport,
      immediatePlayback: state.immediatePlayback,
    };
  }

  if (!state.initPromise) {
    state.initPromise = (async () => {
      const transport = await initAudio();
      const immediatePlayback = createImmediatePlayback(transport);
      state.transport = transport;
      state.immediatePlayback = immediatePlayback;
    })();
  }

  await state.initPromise;

  return {
    transport: state.transport!,
    immediatePlayback: state.immediatePlayback!,
  };
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

/** States where interactive playback is suppressed (UX-D6, INT-D6). */
function isPlaybackSuppressed(uiState: UIStateController): boolean {
  const state = uiState.getState();
  return state === "playback-running" || state === "progression-loaded";
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
 * All callbacks suppress audio and selection during `playback-running`
 * and `progression-loaded` states (UX-D6, INT-D6).
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

  /**
   * Monotonic generation counter to prevent the async ensureAudio race.
   *
   * Problem: on the very first click, ensureAudio is truly async (~5-20ms).
   * If the user releases the pointer before the promise resolves,
   * onPointerUp calls stopAll() *before* playPitchClasses() runs,
   * leaving voices playing indefinitely.
   *
   * Solution: increment on pointer-down, increment again on pointer-up.
   * The async callback checks that generation hasn't changed; if it has,
   * the pointer was already released so we skip playing.
   */
  let pointerGeneration = 0;

  // ── Phase 3b: onPointerDown → immediate audio (UX-D4) ──────────

  const onPointerDown = (world: WorldPoint): void => {
    if (isPlaybackSuppressed(uiState)) return;

    const indices = getIndices();
    const hit: HitResult = hitTest(world.x, world.y, proximityRadius, indices);

    if (hit.type === "none") return;

    const gen = ++pointerGeneration;

    // Fire-and-forget: ensureAudio is async but we don't want to block
    // the gesture handler. On first call there's a one-time ~5-20ms delay;
    // subsequent calls resolve synchronously from cache (INT-D3).
    void ensureAudio(audioState).then(({ immediatePlayback }) => {
      // If pointer was released while we were awaiting, don't start sound
      if (gen !== pointerGeneration) return;

      let pcs: readonly number[] | null = null;

      if (hit.type === "triangle") {
        const triRef = indices.triIdToRef.get(hit.triId);
        if (triRef) {
          pcs = getTrianglePcs(triRef);
        }
      } else if (hit.type === "edge") {
        pcs = getEdgeUnionPcs(hit.edgeId, indices);
      }

      if (pcs && pcs.length > 0) {
        playPitchClasses(immediatePlayback, pcs);
      }
    });
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
    // Bump generation so any in-flight async ensureAudio won't start playing
    pointerGeneration++;

    // Always stop audio on pointer up, even if state is now suppressed
    // (user might have started a drag before state changed).
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
