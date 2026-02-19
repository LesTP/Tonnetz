/**
 * Integration Module — Application entry point.
 *
 * Phase 6a: Full startup sequence per SPEC §Startup Sequence.
 * Phase 6b: destroyApp() teardown.
 * Phase 1a (MVP Polish): Sidebar replaces old layout/panel/toolbar.
 *
 * Wires all four subsystems (Harmony Core, Rendering/UI, Audio Engine,
 * Persistence/Data) into the running MVP application. No subsystem
 * imports from this module — it is the sole cross-subsystem orchestrator.
 *
 * See DEVPLAN §Phase 6.
 */

import type { CentroidCoord, Shape, TriRef, TriId, WindowIndices } from "harmony-core";
import { triId, triVertices, pc } from "harmony-core";

import {
  createSvgScaffold,
  renderGrid,
  createCameraController,
  createResizeController,
  createInteractionController,
  createUIStateController,
  renderProgressionPath,
  activateGridHighlight,
  deactivateGridHighlight,
  createProximityCursor,
  computeProximityRadius,
  hitTest,
} from "rendering-ui";
import type {
  PathHandle,
  GridHighlightHandle,
  CameraController,
  ResizeController,
  UIStateController,
  InteractionController,
  ProximityCursor,
} from "rendering-ui";

import { stopAll } from "audio-engine";
import type { ChordEvent } from "audio-engine";

import {
  createAppAudioState,
  ensureAudio,
  createInteractionWiring,
} from "./interaction-wiring.js";
import {
  loadProgressionPipeline,
  parseProgressionInput,
} from "./progression-pipeline.js";
import { wireAllTransportSubscriptions } from "./transport-wiring.js";
import {
  initPersistence,
  checkUrlHash,
  updateSettings,
} from "./persistence-wiring.js";
import { createKeyboardShortcuts } from "./keyboard-shortcuts.js";
import { log } from "./logger.js";
import { createSidebar } from "./sidebar.js";
import type { Sidebar } from "./sidebar.js";
import { createLibraryUI } from "./library/library-ui.js";
import type { LibraryEntry } from "./library/library-types.js";

// ── Application State ───────────────────────────────────────────────

const appEl = document.getElementById("app") as HTMLElement;
if (!appEl) throw new Error("Missing #app container");

// Mutable application-level state
let currentPathHandle: PathHandle | null = null;
let transportUnsub: (() => void) | null = null;

/** Currently loaded progression shapes (for playback highlighting). */
let currentShapes: readonly Shape[] = [];

/** Active grid highlight handle during playback (deep fill on grid triangles). */
let activeGridHandle: GridHighlightHandle | null = null;

/** Active grid highlight handle during interactive press (restored on pointer-up). */
let interactiveGridHandle: GridHighlightHandle | null = null;

/** Set true before explicit stop/clear to prevent loop listener from restarting. */
let explicitStop = false;

/** Cached ChordEvents for the current progression (used for loop replay). */
let scheduledEventsCache: readonly ChordEvent[] = [];

/** Cached chord symbol strings for the current progression (for chord display). */
let currentChordSymbols: string[] = [];

// ── Step 1: Persistence ─────────────────────────────────────────────

const persistence = initPersistence();

// ── Callback Handlers (defined before sidebar, consumed by sidebar options) ──

/**
 * PathHandle proxy for transport wiring.
 *
 * Transport subscriptions are wired once; this proxy always delegates
 * to the current PathHandle so we don't need to re-wire on each
 * progression load.
 */
const pathHandleProxy: PathHandle = {
  setActiveChord: (index: number) => {
    currentPathHandle?.setActiveChord(index);

    // Deactivate previous grid highlight
    deactivateGridHighlight(activeGridHandle);
    activeGridHandle = null;

    // Activate grid highlight on the active chord's triangles
    if (index >= 0 && index < currentShapes.length) {
      const shape = currentShapes[index];
      const indices = resizeCtrl.getIndices();
      activeGridHandle = activateGridHighlight(
        scaffold.layers["layer-grid"],
        indices,
        {
          mainTriId: shape.main_tri ? triId(shape.main_tri) : null,
          extTriIds: shape.ext_tris.map((ext: TriRef) => triId(ext)),
          dotPcs: shape.dot_pcs,
          centroid: shape.centroid_uv,
          orientation: shape.main_tri?.orientation ?? (shape.chord.quality === "aug" ? "U" : "D"),
          rootPc: shape.chord.root_pc,
        },
      );
    }
  },
  clear: () => {
    currentPathHandle?.clear();
    deactivateGridHighlight(activeGridHandle);
    activeGridHandle = null;
  },
  getChordCount: () => currentPathHandle?.getChordCount() ?? 0,
};

/**
 * Load a chord progression from parsed chord symbols.
 *
 * Runs the full pipeline: collapse → parse → shapes → events → render + schedule.
 * Returns true on success, false on parse error.
 */
function loadProgressionFromChords(chords: string[]): boolean {
  const focus: CentroidCoord = { u: 0, v: 0 };
  const indices = resizeCtrl.getIndices();

  const result = loadProgressionPipeline({
    chords,
    focus,
    indices,
  });

  if (!result.ok) {
    log.warn("pipeline", "Progression load failed", result.error);
    return false;
  }

  if (result.shapes.length === 0) return false;

  // Deactivate any interactive grid highlight when loading a progression
  deactivateGridHighlight(activeGridHandle);
  activeGridHandle = null;

  // Store shapes for playback highlighting
  currentShapes = result.shapes;

  // Cache chord symbols for display during playback (use cleaned versions)
  currentChordSymbols = result.cleanedSymbols;

  // Clear previous path
  if (currentPathHandle) {
    currentPathHandle.clear();
  }

  // Render progression path (respecting current path mode toggle)
  const pathMode = sidebar.getPathMode();
  const shapesForPath = pathMode === "tonal"
    ? result.shapes.map((s) => ({ ...s, centroid_uv: s.tonal_centroid_uv }))
    : result.shapes;
  currentPathHandle = renderProgressionPath(
    scaffold.layers["layer-path"],
    shapesForPath,
    { chordLabels: result.cleanedSymbols, showCentroidLabels: pathMode !== "tonal" },
  );

  // Update UI state (synchronous — immediate visual feedback)
  uiState.loadProgression(result.shapes);
  sidebar.setProgressionLoaded(true);

  // Cache events for loop replay
  scheduledEventsCache = result.events;

  // Schedule on transport (async — needs audio)
  void ensureAudio(audioState).then(({ transport }) => {
    transport.setTempo(persistence.settings.tempo_bpm);
    transport.scheduleProgression(result.events);

  // Wire transport subscriptions once (first load)
    if (!transportUnsub) {
      transportUnsub = wireAllTransportSubscriptions({
        transport,
        pathHandle: pathHandleProxy,
        uiState,
        controlPanel: sidebar,
      });

      // Handle natural playback completion (BUG 3 fix) + loop (Phase 1b).
      // handleStop() covers explicit stop; this covers transport auto-stop.
      transport.onStateChange((event) => {
        if (!event.playing) {
          // Skip loop restart if stop/clear was explicit
          if (explicitStop) {
            explicitStop = false;
            deactivateGridHighlight(activeGridHandle);
            activeGridHandle = null;
            currentPathHandle?.setActiveChord(-1);
            return;
          }
          // Loop: re-schedule and replay if loop is enabled
          if (sidebar.isLoopEnabled() && scheduledEventsCache.length > 0) {
            deactivateGridHighlight(activeGridHandle);
            activeGridHandle = null;
            currentPathHandle?.setActiveChord(-1);
            transport.scheduleProgression(scheduledEventsCache);
            handlePlay();
            return;
          }
          // Normal completion: clear highlights
          deactivateGridHighlight(activeGridHandle);
          activeGridHandle = null;
          currentPathHandle?.setActiveChord(-1);
        }
      });
    }
  });

  return true;
}

function handleLoadProgression(text: string): void {
  const chords = parseProgressionInput(text);
  if (chords.length === 0) return;
  if (loadProgressionFromChords(chords)) {
    // Update textarea with cleaned chord symbols (e.g., "Gaug7" → "Gaug")
    sidebar.setInputText(currentChordSymbols.join(" | "));
  }
}

function handleClear(): void {
  explicitStop = true;
  if (audioState.transport) {
    audioState.transport.cancelSchedule();
  }
  uiState.clearProgression();
  if (currentPathHandle) {
    currentPathHandle.clear();
    currentPathHandle = null;
  }
  deactivateGridHighlight(activeGridHandle);
  activeGridHandle = null;
  currentShapes = [];
  scheduledEventsCache = [];
  currentChordSymbols = [];
  sidebar.setProgressionLoaded(false);
  sidebar.setPlaybackRunning(false);
}

function handlePlay(): void {
  // Deactivate any interactive or playback grid highlight when entering playback mode
  deactivateGridHighlight(interactiveGridHandle);
  interactiveGridHandle = null;
  deactivateGridHighlight(activeGridHandle);
  activeGridHandle = null;
  void ensureAudio(audioState).then(({ transport }) => {
    transport.play();
    uiState.startPlayback();
  });
}

function handleStop(): void {
  if (!audioState.transport) return;
  explicitStop = true;
  audioState.transport.stop();
  uiState.stopPlayback();
  // Clear playback grid highlight (last chord's visual state)
  deactivateGridHighlight(activeGridHandle);
  activeGridHandle = null;
  if (currentPathHandle) {
    currentPathHandle.setActiveChord(-1);
  }
}

function handleTempoChange(bpm: number): void {
  persistence.settings = { ...persistence.settings, tempo_bpm: bpm };
  updateSettings(persistence, { tempo_bpm: bpm });
  if (audioState.transport) {
    audioState.transport.setTempo(bpm);
  }
}

function handleLoopToggle(enabled: boolean): void {
  log.info("playback", `Loop ${enabled ? "enabled" : "disabled"}`);
}

function handlePathModeChange(mode: "root" | "tonal"): void {
  log.info("display", `Path mode: ${mode}`);
  if (!currentPathHandle || currentShapes.length === 0) return;

  // Re-render the path using the selected centroid
  currentPathHandle.clear();
  const shapesForPath = mode === "tonal"
    ? currentShapes.map((s) => ({
        ...s,
        centroid_uv: s.tonal_centroid_uv,
      }))
    : currentShapes;
  currentPathHandle = renderProgressionPath(
    scaffold.layers["layer-path"],
    shapesForPath,
    { chordLabels: currentChordSymbols, showCentroidLabels: mode !== "tonal" },
  );
}

// ── Step 2: Sidebar + Layout ────────────────────────────────────────

const sidebar: Sidebar = createSidebar({
  root: appEl,
  onLoadProgression: handleLoadProgression,
  onPlay: handlePlay,
  onStop: handleStop,
  onClear: handleClear,
  onResetView: () => camera!.reset(),
  onTempoChange: handleTempoChange,
  onLoopToggle: handleLoopToggle,
  onPathModeChange: handlePathModeChange,
  initialTempo: persistence.settings.tempo_bpm,
});
const canvasContainer = sidebar.getCanvasContainer();

// ── Step 2b: Library UI ─────────────────────────────────────────────

const libraryUI = createLibraryUI({
  container: sidebar.getLibraryListContainer(),
  onLoad: (entry: LibraryEntry) => {
    // Stop any current playback
    if (audioState.transport?.isPlaying()) {
      handleStop();
    }
    // Apply library entry settings
    persistence.settings = { ...persistence.settings, tempo_bpm: entry.tempo };
    updateSettings(persistence, { tempo_bpm: entry.tempo });
    sidebar.setTempo(entry.tempo);
    // Load progression
    const chords = [...entry.chords];
    if (loadProgressionFromChords(chords)) {
      sidebar.setInputText(chords.join(" | "));
      sidebar.switchToTab("play");
    }
  },
});

// ── Step 3: SVG Scaffold ────────────────────────────────────────────

const scaffold = createSvgScaffold(canvasContainer);

// ── Step 4: Resize Controller ───────────────────────────────────────
// Computes initial bounds + indices and watches for container resizes.
// Camera is forward-referenced since onResize needs it.

let camera: CameraController | null = null;

const resizeCtrl: ResizeController = createResizeController(
  canvasContainer,
  scaffold,
  ({ bounds, indices, containerWidth, containerHeight }) => {
    if (camera) {
      camera.updateDimensions(containerWidth, containerHeight, bounds);
    }
    // Re-render grid with updated indices
    const gridLayer = scaffold.layers["layer-grid"];
    while (gridLayer.firstChild) {
      gridLayer.removeChild(gridLayer.firstChild);
    }
    renderGrid(gridLayer, indices);
  },
);

// ── Step 5: Camera Controller ───────────────────────────────────────

const initialBounds = resizeCtrl.getBounds();
const containerWidth = canvasContainer.clientWidth || 800;
const containerHeight = canvasContainer.clientHeight || 600;

camera = createCameraController(
  scaffold.svg,
  containerWidth,
  containerHeight,
  initialBounds,
);

// ── Step 6: Render Initial Grid ─────────────────────────────────────

renderGrid(scaffold.layers["layer-grid"], resizeCtrl.getIndices());

// ── Step 7: UI State Controller ─────────────────────────────────────

const uiState: UIStateController = createUIStateController();

// ── Step 8: Audio State (Deferred — INT-D3) ─────────────────────────

const audioState = createAppAudioState();

// ── Step 11: Interaction Wiring ─────────────────────────────────────

// Shared proximity radius for both visual highlights and audio hit-testing
const INTERACTION_PROXIMITY = computeProximityRadius(0.12);

const baseInteractionCallbacks = createInteractionWiring({
  audioState,
  uiState,
  getIndices: () => resizeCtrl.getIndices(),
  proximityRadius: INTERACTION_PROXIMITY,
});

// Wrap callbacks to add visual highlighting on pointer-down (immediate feedback)
// Uses grid-highlighter: mutates grid triangle fills directly instead of overlays

const interactionCallbacks = {
  ...baseInteractionCallbacks,
  onPointerDown: (world: { x: number; y: number }) => {
    // Suppress interactive highlighting during playback or progression-loaded (UX-D6)
    const state = uiState.getState();
    if (state === "playback-running" || state === "progression-loaded") {
      baseInteractionCallbacks.onPointerDown?.(world);
      return;
    }

    // Highlight immediately on press (before tap/drag classification)
    const indices = resizeCtrl.getIndices();
    const hit = hitTest(world.x, world.y, INTERACTION_PROXIMITY, indices);

    // Deactivate previous interactive highlight
    deactivateGridHighlight(interactiveGridHandle);
    interactiveGridHandle = null;

    if (hit.type === "triangle") {
      const triRef = indices.triIdToRef.get(hit.triId);
      interactiveGridHandle = activateGridHighlight(
        scaffold.layers["layer-grid"],
        indices,
        {
          mainTriId: hit.triId,
          orientation: triRef?.orientation ?? "U",
          rootPc: triRef ? pc(triVertices(triRef)[triRef.orientation === "U" ? 0 : 2].u, triVertices(triRef)[triRef.orientation === "U" ? 0 : 2].v) : null,
        },
      );
    } else if (hit.type === "edge") {
      // For edge hits, highlight both triangles as a combined shape
      const mainRef = indices.triIdToRef.get(hit.triIds[0]);
      interactiveGridHandle = activateGridHighlight(
        scaffold.layers["layer-grid"],
        indices,
        {
          mainTriId: hit.triIds[0],
          extTriIds: [hit.triIds[1]],
          orientation: mainRef?.orientation ?? "U",
          rootPc: mainRef ? pc(triVertices(mainRef)[mainRef.orientation === "U" ? 0 : 2].u, triVertices(mainRef)[mainRef.orientation === "U" ? 0 : 2].v) : null,
        },
      );
    }

    // Delegate to base (audio + state gating)
    baseInteractionCallbacks.onPointerDown?.(world);
  },
  onPointerUp: () => {
    // Restore grid on release
    deactivateGridHighlight(interactiveGridHandle);
    interactiveGridHandle = null;
    baseInteractionCallbacks.onPointerUp?.();
  },
  onDragStart: () => {
    // Stop audio and clear highlight when drag begins (UX-D4)
    deactivateGridHighlight(interactiveGridHandle);
    interactiveGridHandle = null;
    if (audioState.immediatePlayback) {
      stopAll(audioState.immediatePlayback);
    }
  },
};

// ── Step 12: Interaction Controller ─────────────────────────────────

const interactionCtrl: InteractionController = createInteractionController({
  svg: scaffold.svg,
  cameraController: camera,
  getIndices: () => resizeCtrl.getIndices(),
  callbacks: interactionCallbacks,
});

// ── Step 12b: Proximity Cursor ──────────────────────────────────────

const proximityCursor: ProximityCursor = createProximityCursor(
  scaffold.svg,
  scaffold.layers["layer-interaction"],
  computeProximityRadius(0.12),
  () => camera!.getViewBox(),
);

// ── Step 12c: Keyboard Shortcuts ────────────────────────────────────

const keyboardShortcuts = createKeyboardShortcuts({
  uiState,
  onClear: handleClear,
  onPlay: handlePlay,
  onStop: handleStop,
});

// ── Step 13: Check URL Hash ─────────────────────────────────────────
// Auto-load shared progression from URL fragment (SPEC §Startup Sequence step 5).

const urlCheck = checkUrlHash(location.hash);
if (urlCheck.found) {
  const { chords, tempo_bpm } = urlCheck.payload;
  persistence.settings = { ...persistence.settings, tempo_bpm };
  sidebar.setTempo(tempo_bpm);
  loadProgressionFromChords([...chords]);
}

// ── Step 14: Ready ──────────────────────────────────────────────────

log.info("startup", "Application ready", { state: uiState.getState() });

// ── Phase 6b: destroyApp() ──────────────────────────────────────────

/**
 * Tear down the application: stop audio, unsubscribe events, destroy
 * controllers, and clear the DOM.
 *
 * Not critical for MVP (single-page, never unmounts) but prevents
 * refactor cost if app is later embedded in SPA or mobile wrapper.
 */
export function destroyApp(): void {
  // Unsubscribe transport events
  if (transportUnsub) {
    transportUnsub();
    transportUnsub = null;
  }

  // Stop all audio
  if (audioState.transport) {
    audioState.transport.stop();
    audioState.transport.cancelSchedule();
  }
  if (audioState.immediatePlayback) {
    stopAll(audioState.immediatePlayback);
  }

  // Clear rendered progression
  if (currentPathHandle) {
    currentPathHandle.clear();
    currentPathHandle = null;
  }

  // Destroy keyboard shortcuts and cursor
  keyboardShortcuts.destroy();
  proximityCursor.destroy();

  // Destroy controllers (order: interaction first, camera, resize, then sidebar last)
  interactionCtrl.destroy();
  camera!.destroy();
  resizeCtrl.destroy();
  sidebar.destroy();

  // Clear DOM
  appEl.innerHTML = "";

  log.info("startup", "Application destroyed");
}
