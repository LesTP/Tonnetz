/**
 * Phase 3a: Cross-module type compatibility tests.
 *
 * Validates that Harmony Core types flow correctly through Audio Engine APIs.
 * These tests import from both harmony-core and audio-engine to verify
 * the cross-module contract documented in SPEC.md §Integration Module.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildWindowIndices,
  getTrianglePcs,
  getEdgeUnionPcs,
  parseChordSymbol,
  placeMainTriad,
  decomposeChordToShape,
  mapProgressionToShapes,
} from "harmony-core";
import type { WindowBounds, Shape } from "harmony-core";

import { initAudio } from "../audio-context.js";
import { createImmediatePlayback, playShape, playPitchClasses, stopAll } from "../immediate-playback.js";
import type { AudioTransport, ChordEvent } from "../types.js";

// --- Shared setup ---

// Reuse the mock from existing tests
import { MockAudioContext } from "./web-audio-mock.js";

const bounds: WindowBounds = { uMin: -2, uMax: 4, vMin: -2, vMax: 4 };

let transport: AudioTransport;

beforeEach(async () => {
  transport = await initAudio({ AudioContextClass: MockAudioContext as unknown as { new (): AudioContext } });
});

// --- 3a Tests ---

describe("Cross-module: Shape.covered_pcs → playShape()", () => {
  it("plays a HC Shape through playShape() without error", () => {
    const indices = buildWindowIndices(bounds);
    const chord = parseChordSymbol("C");
    const mainTri = placeMainTriad(chord, { u: 0, v: 0 }, indices);
    expect(mainTri).not.toBeNull();
    const shape = decomposeChordToShape(chord, mainTri!, { u: 0, v: 0 }, indices);

    expect(shape.covered_pcs).toBeInstanceOf(Set);
    expect(shape.covered_pcs.size).toBeGreaterThanOrEqual(3);

    const playback = createImmediatePlayback(transport);
    expect(() => playShape(playback, shape)).not.toThrow();
  });

  it("covered_pcs values are valid pitch classes (0–11)", () => {
    const indices = buildWindowIndices(bounds);
    const chord = parseChordSymbol("Am7");
    const mainTri = placeMainTriad(chord, { u: 0, v: 0 }, indices);
    const shape = decomposeChordToShape(chord, mainTri, { u: 0, v: 0 }, indices);

    for (const pc of shape.covered_pcs) {
      expect(pc).toBeGreaterThanOrEqual(0);
      expect(pc).toBeLessThan(12);
    }
  });
});

describe("Cross-module: getTrianglePcs() → playPitchClasses()", () => {
  it("HC triangle pcs are accepted by playPitchClasses()", () => {
    const indices = buildWindowIndices(bounds);
    // Get a known triangle's pitch classes
    const triRef = { orientation: "U" as const, anchor: { u: 0, v: 0 } };
    const pcs = getTrianglePcs(triRef);

    expect(pcs).toHaveLength(3);
    expect(pcs.every((p) => typeof p === "number")).toBe(true);

    const playback = createImmediatePlayback(transport);
    expect(() => playPitchClasses(playback, pcs)).not.toThrow();
  });
});

describe("Cross-module: getEdgeUnionPcs() → playPitchClasses()", () => {
  it("HC edge union pcs (4 pitch classes) are accepted by playPitchClasses()", () => {
    const indices = buildWindowIndices(bounds);
    // Find an interior edge that has two adjacent triangles
    let foundPcs: number[] | null = null;
    for (const edgeId of indices.edgeToTris.keys()) {
      const tris = indices.edgeToTris.get(edgeId)!;
      if (tris.length === 2) {
        foundPcs = getEdgeUnionPcs(edgeId, indices);
        break;
      }
    }

    expect(foundPcs).not.toBeNull();
    expect(foundPcs!.length).toBe(4);

    const playback = createImmediatePlayback(transport);
    expect(() => playPitchClasses(playback, foundPcs!)).not.toThrow();
  });

  it("boundary edge returns null (not passed to playPitchClasses)", () => {
    const indices = buildWindowIndices(bounds);
    let boundaryEdge: string | null = null;
    for (const [edgeId, tris] of indices.edgeToTris.entries()) {
      if (tris.length === 1) {
        boundaryEdge = edgeId;
        break;
      }
    }

    if (boundaryEdge) {
      const result = getEdgeUnionPcs(boundaryEdge as any, indices);
      expect(result).toBeNull();
    }
  });
});

describe("Cross-module: ChordEvent with HC Shape", () => {
  it("onChordChange event contains correct shape reference from ChordEvent", async () => {
    const indices = buildWindowIndices(bounds);
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("C"), parseChordSymbol("F")] as any[],
      { u: 0, v: 0 },
      indices,
    );
    expect(shapes.length).toBe(2);

    const events: ChordEvent[] = shapes.map((shape, i) => ({
      shape,
      startBeat: i,
      durationBeats: 1,
    }));

    // Schedule and verify the chord change event carries the original Shape
    const receivedShapes: Shape[] = [];
    transport.onChordChange((event) => {
      receivedShapes.push(event.shape);
    });
    transport.scheduleProgression(events);
    transport.play();

    // Advance mock time to trigger scheduler ticks
    const ctx = transport.getContext() as any;
    ctx._currentTime = 0.05;
    await new Promise((r) => setTimeout(r, 50));

    expect(receivedShapes.length).toBeGreaterThanOrEqual(1);
    expect(receivedShapes[0]).toBe(events[0].shape);
    expect(receivedShapes[0].covered_pcs).toBeInstanceOf(Set);

    transport.stop();
  });

  it("multiple onChordChange subscribers receive events independently", async () => {
    const indices = buildWindowIndices(bounds);
    const shapes = mapProgressionToShapes(
      [parseChordSymbol("Dm")] as any[],
      { u: 0, v: 0 },
      indices,
    );

    const events: ChordEvent[] = shapes.map((shape) => ({
      shape,
      startBeat: 0,
      durationBeats: 1,
    }));

    const received1: number[] = [];
    const received2: number[] = [];
    transport.onChordChange((e) => received1.push(e.chordIndex));
    transport.onChordChange((e) => received2.push(e.chordIndex));

    transport.scheduleProgression(events);
    transport.play();

    const ctx = transport.getContext() as any;
    ctx._currentTime = 0.05;
    await new Promise((r) => setTimeout(r, 50));

    expect(received1.length).toBeGreaterThanOrEqual(1);
    expect(received2.length).toBeGreaterThanOrEqual(1);
    expect(received1).toEqual(received2);

    transport.stop();
  });
});
