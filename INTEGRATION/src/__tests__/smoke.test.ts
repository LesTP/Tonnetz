/**
 * Smoke test — verifies all four subsystem imports resolve successfully.
 *
 * Phase 1a: project scaffolding validation.
 * Each import pulls a representative function or type from the subsystem's
 * public API to confirm the tsconfig paths and vitest aliases are wired correctly.
 */
import { describe, it, expect } from "vitest";

// Harmony Core
import {
  parseChordSymbol,
  mapProgressionToShapes,
  buildWindowIndices,
  getTrianglePcs,
  getEdgeUnionPcs,
  pc,
  nodeId,
  triId,
  edgeId,
} from "harmony-core";
import type { Shape, Chord, NodeCoord, WindowIndices } from "harmony-core";

// Rendering/UI
import {
  latticeToWorld,
  worldToLattice,
  computeWindowBounds,
  hitTest,
  computeProximityRadius,
  createUIStateController,
} from "rendering-ui";
import type { WorldPoint, HitResult, UIStateController } from "rendering-ui";

// Audio Engine
import {
  initAudio,
  createImmediatePlayback,
  playPitchClasses,
  stopAll,
  shapesToChordEvents,
  voiceInRegister,
  voiceLead,
  midiToFreq,
  beatsToSeconds,
} from "audio-engine";
import type { AudioTransport, ChordEvent, TransportState } from "audio-engine";

// Persistence/Data
import {
  loadSettings,
  saveSettings,
  saveProgression,
  loadProgression,
  listProgressions,
  deleteProgression,
  encodeShareUrl,
  decodeShareUrl,
  createLocalStorageBackend,
  DEFAULT_SETTINGS,
  DEFAULT_GRID,
  CURRENT_SCHEMA_VERSION,
} from "persistence-data";
import type {
  ProgressionRecord,
  SettingsRecord,
  SharePayload,
  GridValue,
} from "persistence-data";

describe("Subsystem imports (smoke test)", () => {
  describe("Harmony Core", () => {
    it("exports core functions", () => {
      expect(typeof parseChordSymbol).toBe("function");
      expect(typeof mapProgressionToShapes).toBe("function");
      expect(typeof buildWindowIndices).toBe("function");
      expect(typeof getTrianglePcs).toBe("function");
      expect(typeof getEdgeUnionPcs).toBe("function");
      expect(typeof pc).toBe("function");
      expect(typeof nodeId).toBe("function");
      expect(typeof triId).toBe("function");
      expect(typeof edgeId).toBe("function");
    });

    it("parseChordSymbol produces a result", () => {
      const chord = parseChordSymbol("Cmaj7");
      expect(chord).not.toBeNull();
      expect(chord!.root_pc).toBe(0); // C = 0
    });
  });

  describe("Rendering/UI", () => {
    it("exports core functions", () => {
      expect(typeof latticeToWorld).toBe("function");
      expect(typeof worldToLattice).toBe("function");
      expect(typeof computeWindowBounds).toBe("function");
      expect(typeof hitTest).toBe("function");
      expect(typeof computeProximityRadius).toBe("function");
      expect(typeof createUIStateController).toBe("function");
    });

    it("latticeToWorld produces a WorldPoint", () => {
      const wp = latticeToWorld(0, 0);
      expect(wp).toHaveProperty("x");
      expect(wp).toHaveProperty("y");
    });
  });

  describe("Audio Engine", () => {
    it("exports core functions", () => {
      expect(typeof initAudio).toBe("function");
      expect(typeof createImmediatePlayback).toBe("function");
      expect(typeof playPitchClasses).toBe("function");
      expect(typeof stopAll).toBe("function");
      expect(typeof shapesToChordEvents).toBe("function");
      expect(typeof voiceInRegister).toBe("function");
      expect(typeof voiceLead).toBe("function");
      expect(typeof midiToFreq).toBe("function");
      expect(typeof beatsToSeconds).toBe("function");
    });

    it("midiToFreq produces correct A4 frequency", () => {
      expect(midiToFreq(69)).toBeCloseTo(440, 1);
    });
  });

  describe("Persistence/Data", () => {
    it("exports core functions", () => {
      expect(typeof loadSettings).toBe("function");
      expect(typeof saveSettings).toBe("function");
      expect(typeof saveProgression).toBe("function");
      expect(typeof loadProgression).toBe("function");
      expect(typeof listProgressions).toBe("function");
      expect(typeof deleteProgression).toBe("function");
      expect(typeof encodeShareUrl).toBe("function");
      expect(typeof decodeShareUrl).toBe("function");
      expect(typeof createLocalStorageBackend).toBe("function");
    });

    it("exports constants", () => {
      expect(DEFAULT_SETTINGS).toHaveProperty("tempo_bpm");
      expect(DEFAULT_GRID).toBe("1/4");
      expect(CURRENT_SCHEMA_VERSION).toBe(1);
    });

    it("encodeShareUrl round-trips with decodeShareUrl", () => {
      const payload = {
        chords: ["Dm7", "G7", "Cmaj7"],
        tempo_bpm: 120,
        grid: "1/4" as GridValue,
      };
      const encoded = encodeShareUrl(payload);
      const decoded = decodeShareUrl(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded!.chords).toEqual(["Dm7", "G7", "Cmaj7"]);
      expect(decoded!.tempo_bpm).toBe(120);
      expect(decoded!.grid).toBe("1/4");
    });
  });
});
