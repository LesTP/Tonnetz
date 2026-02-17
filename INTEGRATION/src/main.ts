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

import type { CentroidCoord, Shape, TriRef, TriId, EdgeId, WindowIndices } from "harmony-core";
import { triId, getTrianglePcs, getEdgeUnionPcs, pc } from "harmony-core";

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
  DEFAULT_GRID,
  updateSettings,
} from "./persistence-wiring.js";
import { createKeyboardShortcuts } from "./keyboard-shortcuts.js";
import { log } from "./logger.js";
import { createSidebar } from "./sidebar.js";
import type { Sidebar } from "./sidebar.js";
import type { GridValue } from "persistence-data";

// ── Application State ───────────────────────────────────────────────

const appEl = document.getElementById("app") as HTMLElement;
if (!appEl) throw new Error("Missing #app container");

// Mutable application-level state
let currentPathHandle: PathHandle | null = null;
let transportUnsub: (() => void) | null = null;
let activeGrid: GridValue = DEFAULT_GRID;

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

// ── Chord Label Helpers ─────────────────────────────────────────────

const PC_NAMES: readonly string[] = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

const PC_NAMES_FLAT: readonly string[] = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];

/** Format a chord symbol with enharmonic root (e.g., "A#m / Bbm"). */
function chordName(rootPc: number, suffix: string): string {
  const sharp = PC_NAMES[rootPc];
  const flat = PC_NAMES_FLAT[rootPc];
  if (sharp !== flat) {
    return `${sharp}${suffix} / ${flat}${suffix}`;
  }
  return sharp + suffix;
}

/** Derive a display label from a triangle hit (e.g., "C" or "A#m / Bbm"). */
function triLabel(triRef: TriRef): string {
  const { u, v } = triRef.anchor;
  const rootPc = triRef.orientation === "U"
    ? pc(u, v)
    : pc(u, v + 1);
  const quality = triRef.orientation === "U" ? "" : "m";
  return chordName(rootPc, quality);
}

/** Known 4-note chord interval patterns (root-relative, sorted ascending). */
const FOUR_NOTE_PATTERNS: readonly [readonly number[], string][] = [
  [[0, 4, 7, 11], "maj7"],
  [[0, 4, 7, 10], "7"],
  [[0, 3, 7, 10], "m7"],
  [[0, 3, 7, 11], "m(maj7)"],
  [[0, 3, 6, 10], "m7b5"],
  [[0, 3, 6, 9],  "dim7"],
];

/**
 * Identify a 4-note chord from its pitch classes.
 * Tries each PC as a potential root and matches against known interval patterns.
 * Returns a chord symbol (e.g., "C#m7") or a fallback PC list (e.g., "C-E-G#-B").
 */
function identifyFourNoteChord(pcs: readonly number[]): string {
  const sorted = [...new Set(pcs)].sort((a, b) => a - b);
  if (sorted.length !== 4) {
    return sorted.map((p) => PC_NAMES[p]).join("-");
  }
  for (const root of sorted) {
    const intervals = sorted
      .map((p) => ((p - root) + 12) % 12)
      .sort((a, b) => a - b);
    for (const [pattern, suffix] of FOUR_NOTE_PATTERNS) {
      if (intervals.every((v, i) => v === pattern[i])) {
        return chordName(root, suffix);
      }
    }
  }
  return sorted.map((p) => PC_NAMES[p]).join("-");
}

/** Derive a display label from an edge hit (e.g., "C#m7", "Cmaj7"). */
function edgeLabel(
  edgeId: EdgeId,
  indices: WindowIndices,
): string {
  const pcs = getEdgeUnionPcs(edgeId, indices);
  if (!pcs || pcs.length === 0) return "";
  return identifyFourNoteChord(pcs);
}

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

    // Update chord display during playback
    if (index >= 0 && index < currentChordSymbols.length) {
      sidebar.setActiveChord(currentChordSymbols[index]);
    } else {
      sidebar.setActiveChord(null);
    }

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
          rootVertexIndex: shape.root_vertex_index,
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
    grid: activeGrid,
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

  // Render progression path
  currentPathHandle = renderProgressionPath(
    scaffold.layers["layer-path"],
    result.shapes,
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
  sidebar.setActiveChord(null);
  sidebar.setPlaybackRunning(false);
}

function handlePlay(): void {
  if (!audioState.transport) return;
  // Deactivate any interactive or playback grid highlight when entering playback mode
  deactivateGridHighlight(interactiveGridHandle);
  interactiveGridHandle = null;
  deactivateGridHighlight(activeGridHandle);
  activeGridHandle = null;
  audioState.transport.play();
  uiState.startPlayback();
}

function handleStop(): void {
  if (!audioState.transport) return;
  explicitStop = true;
  audioState.transport.stop();
  uiState.stopPlayback();
  // Clear playback grid highlight (last chord's visual state)
  deactivateGridHighlight(activeGridHandle);
  activeGridHandle = null;
  sidebar.setActiveChord(null);
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
  initialTempo: persistence.settings.tempo_bpm,
});
const canvasContainer = sidebar.getCanvasContainer();

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
          rootVertexIndex: triRef?.orientation === "U" ? 0 : 2,
        },
      );
      // Show chord name during interactive exploration
      if (triRef) sidebar.setActiveChord(triLabel(triRef));
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
          rootVertexIndex: mainRef?.orientation === "U" ? 0 : 2,
        },
      );
      // Show union chord name
      sidebar.setActiveChord(edgeLabel(hit.edgeId, indices));
    }

    // Delegate to base (audio + state gating)
    baseInteractionCallbacks.onPointerDown?.(world);
  },
  onPointerUp: () => {
    // Restore grid on release
    deactivateGridHighlight(interactiveGridHandle);
    interactiveGridHandle = null;
    // Clear chord display on release (back to placeholder)
    const state = uiState.getState();
    if (state !== "playback-running") {
      sidebar.setActiveChord(null);
    }
    baseInteractionCallbacks.onPointerUp?.();
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
  const { chords, tempo_bpm, grid } = urlCheck.payload;
  // Apply URL payload settings
  persistence.settings = { ...persistence.settings, tempo_bpm };
  activeGrid = grid;
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
