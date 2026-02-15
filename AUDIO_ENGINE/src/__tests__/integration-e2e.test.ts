/**
 * Phase 3c: End-to-end integration smoke tests.
 *
 * Tests the full pipeline across all three modules:
 * HC (parse/decompose) → AE (convert/schedule/play)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildWindowIndices,
  parseChordSymbol,
  mapProgressionToShapes,
  getTrianglePcs,
  getEdgeUnionPcs,
} from "harmony-core";
import type { WindowBounds, Shape } from "harmony-core";

import { initAudio } from "../audio-context.js";
import {
  createImmediatePlayback,
  playPitchClasses,
  stopAll,
} from "../immediate-playback.js";
import { shapesToChordEvents } from "../conversion.js";
import type { AudioTransport } from "../types.js";

import { MockAudioContext } from "./web-audio-mock.js";

const bounds: WindowBounds = { uMin: -2, uMax: 4, vMin: -2, vMax: 4 };

let transport: AudioTransport;

beforeEach(async () => {
  transport = await initAudio({
    AudioContextClass: MockAudioContext as unknown as { new (): AudioContext },
  });
});

describe("End-to-end: progression parse → schedule → chord change events", () => {
  it("ii–V–I progression flows through HC → AE → events fire with correct shapes", async () => {
    const indices = buildWindowIndices(bounds);

    // HC: parse and decompose
    const chords = [
      parseChordSymbol("Dm7"),
      parseChordSymbol("G7"),
      parseChordSymbol("C"),
    ];
    const shapes = mapProgressionToShapes(chords, { u: 0, v: 0 }, indices);
    expect(shapes).toHaveLength(3);

    // AE: convert and schedule
    const events = shapesToChordEvents(shapes);
    expect(events).toHaveLength(3);
    expect(events[0].shape.covered_pcs.size).toBeGreaterThanOrEqual(3);

    const receivedIndices: number[] = [];
    const receivedShapes: Shape[] = [];
    transport.onChordChange((e) => {
      receivedIndices.push(e.chordIndex);
      receivedShapes.push(e.shape);
    });

    transport.scheduleProgression(events);
    transport.play();

    // Advance mock time past first chord onset
    const ctx = transport.getContext() as any;
    ctx._currentTime = 0.05;
    await new Promise((r) => setTimeout(r, 60));

    // First chord should have fired
    expect(receivedIndices.length).toBeGreaterThanOrEqual(1);
    expect(receivedIndices[0]).toBe(0);
    // Shape reference preserved through the pipeline
    expect(receivedShapes[0]).toBe(shapes[0]);
    expect(receivedShapes[0].chord.quality).toBe("min");

    transport.stop();
  });
});

describe("End-to-end: interactive triangle → playPitchClasses", () => {
  it("getTrianglePcs() (HC) → playPitchClasses() (AE) → voices created", () => {
    // HC: get pitch classes for a C major triangle (U at origin)
    const triRef = { orientation: "U" as const, anchor: { u: 0, v: 0 } };
    const pcs = getTrianglePcs(triRef);
    expect(pcs).toHaveLength(3);
    // C major: pcs should be [0, 4, 7]
    expect(new Set(pcs)).toEqual(new Set([0, 4, 7]));

    // AE: play immediately
    const playback = createImmediatePlayback(transport);
    playPitchClasses(playback, pcs);

    // Voices should be active (3 for a triad)
    expect(playback.voices.size).toBe(3);

    stopAll(playback);
    expect(playback.voices.size).toBe(0);
  });
});

describe("End-to-end: edge union → playPitchClasses (4 voices)", () => {
  it("getEdgeUnionPcs() (HC) → playPitchClasses() (AE) → 4 voices created", () => {
    const indices = buildWindowIndices(bounds);

    // Find an interior edge with 2 adjacent triangles
    let unionPcs: number[] | null = null;
    for (const [edgeId, tris] of indices.edgeToTris.entries()) {
      if (tris.length === 2) {
        unionPcs = getEdgeUnionPcs(edgeId, indices);
        if (unionPcs && unionPcs.length === 4) break;
      }
    }

    expect(unionPcs).not.toBeNull();
    expect(unionPcs!).toHaveLength(4);

    // AE: play the 4-note union chord
    const playback = createImmediatePlayback(transport);
    playPitchClasses(playback, unionPcs!);

    expect(playback.voices.size).toBe(4);

    stopAll(playback);
    expect(playback.voices.size).toBe(0);
  });
});
