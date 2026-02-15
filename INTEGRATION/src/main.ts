/**
 * Integration Module — Application entry point.
 *
 * Phase 6a: Full startup sequence per SPEC §Startup Sequence.
 * Phase 6b: destroyApp() teardown.
 *
 * Wires all four subsystems (Harmony Core, Rendering/UI, Audio Engine,
 * Persistence/Data) into the running MVP application. No subsystem
 * imports from this module — it is the sole cross-subsystem orchestrator.
 *
 * See DEVPLAN §Phase 6.
 */

import type { CentroidCoord } from "harmony-core";

import {
  createSvgScaffold,
  renderGrid,
  createCameraController,
  createResizeController,
  createInteractionController,
  createLayoutManager,
  createControlPanel,
  createToolbar,
  createUIStateController,
  renderProgressionPath,
} from "rendering-ui";
import type {
  PathHandle,
  CameraController,
  ResizeController,
  LayoutManager,
  ControlPanel,
  Toolbar,
  UIStateController,
  InteractionController,
} from "rendering-ui";

import { stopAll } from "audio-engine";

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
  DEFAULT_GRID,
} from "./persistence-wiring.js";
import { createKeyboardShortcuts } from "./keyboard-shortcuts.js";
import { log } from "./logger.js";
import type { GridValue } from "persistence-data";

// ── Application State ───────────────────────────────────────────────

const appEl = document.getElementById("app") as HTMLElement;
if (!appEl) throw new Error("Missing #app container");

// Mutable application-level state
let currentPathHandle: PathHandle | null = null;
let transportUnsub: (() => void) | null = null;
let activeGrid: GridValue = DEFAULT_GRID;

/**
 * PathHandle proxy for transport wiring.
 *
 * Transport subscriptions are wired once; this proxy always delegates
 * to the current PathHandle so we don't need to re-wire on each
 * progression load.
 */
const pathHandleProxy: PathHandle = {
  setActiveChord: (index: number) => currentPathHandle?.setActiveChord(index),
  clear: () => currentPathHandle?.clear(),
  getChordCount: () => currentPathHandle?.getChordCount() ?? 0,
};

// ── Step 1: Persistence ─────────────────────────────────────────────

const persistence = initPersistence();

// ── Step 2: Layout ──────────────────────────────────────────────────

const layout: LayoutManager = createLayoutManager({ root: appEl });
const canvasContainer = layout.getCanvasContainer();

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

// ── Progression Loading ─────────────────────────────────────────────

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
    grid: activeGrid,
    focus,
    indices,
  });

  if (!result.ok) {
    log.warn("pipeline", "Progression load failed", result.error);
    return false;
  }

  if (result.shapes.length === 0) return false;

  // Clear previous path
  if (currentPathHandle) {
    currentPathHandle.clear();
  }

  // Render progression path
  currentPathHandle = renderProgressionPath(
    scaffold.layers["layer-path"],
    result.shapes,
  );

  // Update UI state (synchronous — immediate visual feedback)
  uiState.loadProgression(result.shapes);
  controlPanel.setProgressionLoaded(true);

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
        controlPanel,
      });
    }
  });

  return true;
}

// ── Step 9: Control Panel ───────────────────────────────────────────

function handleLoadProgression(text: string): void {
  const chords = parseProgressionInput(text);
  if (chords.length === 0) return;
  loadProgressionFromChords(chords);
}

function handleClear(): void {
  if (audioState.transport) {
    audioState.transport.cancelSchedule();
  }
  uiState.clearProgression();
  if (currentPathHandle) {
    currentPathHandle.clear();
    currentPathHandle = null;
  }
  controlPanel.setProgressionLoaded(false);
  controlPanel.setPlaybackRunning(false);
}

function handlePlay(): void {
  if (!audioState.transport) return;
  audioState.transport.play();
  uiState.startPlayback();
}

function handleStop(): void {
  if (!audioState.transport) return;
  audioState.transport.stop();
  uiState.stopPlayback();
  if (currentPathHandle) {
    currentPathHandle.setActiveChord(-1);
  }
}

const controlPanel: ControlPanel = createControlPanel({
  container: layout.getControlPanelContainer(),
  onLoadProgression: handleLoadProgression,
  onClear: handleClear,
  onPlay: handlePlay,
  onStop: handleStop,
});

// ── Step 10: Toolbar ────────────────────────────────────────────────

const toolbar: Toolbar = createToolbar({
  container: layout.getToolbarContainer(),
  onResetView: () => camera!.reset(),
});

// ── Step 11: Interaction Wiring ─────────────────────────────────────

const interactionCallbacks = createInteractionWiring({
  audioState,
  uiState,
  getIndices: () => resizeCtrl.getIndices(),
});

// ── Step 12: Interaction Controller ─────────────────────────────────

const interactionCtrl: InteractionController = createInteractionController({
  svg: scaffold.svg,
  cameraController: camera,
  getIndices: () => resizeCtrl.getIndices(),
  callbacks: interactionCallbacks,
});

// ── Step 12b: Keyboard Shortcuts ────────────────────────────────────

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
  const { chords, tempo_bpm, grid } = urlCheck.payload;
  // Apply URL payload settings
  persistence.settings = { ...persistence.settings, tempo_bpm };
  activeGrid = grid;
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

  // Destroy keyboard shortcuts
  keyboardShortcuts.destroy();

  // Destroy controllers (order: interaction first, camera, resize, UI components, layout last)
  interactionCtrl.destroy();
  camera!.destroy();
  resizeCtrl.destroy();
  controlPanel.destroy();
  toolbar.destroy();
  layout.destroy();

  // Clear DOM
  appEl.innerHTML = "";

  log.info("startup", "Application destroyed");
}
