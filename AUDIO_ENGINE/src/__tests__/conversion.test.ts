/**
 * Phase 3b: shapesToChordEvents() tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildWindowIndices,
  parseChordSymbol,
  mapProgressionToShapes,
} from "harmony-core";
import type { WindowBounds, Shape } from "harmony-core";

import { shapesToChordEvents } from "../conversion.js";

const bounds: WindowBounds = { uMin: -2, uMax: 4, vMin: -2, vMax: 4 };

function makeShapes(symbols: string[]): Shape[] {
  const indices = buildWindowIndices(bounds);
  const chords = symbols.map((s) => parseChordSymbol(s));
  return mapProgressionToShapes(chords, { u: 0, v: 0 }, indices);
}

describe("shapesToChordEvents", () => {
  it("empty array → empty array", () => {
    const events = shapesToChordEvents([]);
    expect(events).toEqual([]);
  });

  it("single shape → one ChordEvent at beat 0", () => {
    const shapes = makeShapes(["C"]);
    const events = shapesToChordEvents(shapes);

    expect(events).toHaveLength(1);
    expect(events[0].startBeat).toBe(0);
    expect(events[0].durationBeats).toBe(1);
    expect(events[0].shape).toBe(shapes[0]);
  });

  it("multiple shapes → sequential beats", () => {
    const shapes = makeShapes(["Dm7", "G7", "C"]);
    const events = shapesToChordEvents(shapes);

    expect(events).toHaveLength(3);
    expect(events[0].startBeat).toBe(0);
    expect(events[1].startBeat).toBe(1);
    expect(events[2].startBeat).toBe(2);
    expect(events.every((e) => e.durationBeats === 1)).toBe(true);
  });

  it("custom beatsPerChord respected", () => {
    const shapes = makeShapes(["Am", "F"]);
    const events = shapesToChordEvents(shapes, 2);

    expect(events[0].startBeat).toBe(0);
    expect(events[0].durationBeats).toBe(2);
    expect(events[1].startBeat).toBe(2);
    expect(events[1].durationBeats).toBe(2);
  });

  it("shape reference preserved (same object)", () => {
    const shapes = makeShapes(["E", "Am"]);
    const events = shapesToChordEvents(shapes);

    expect(events[0].shape).toBe(shapes[0]);
    expect(events[1].shape).toBe(shapes[1]);
  });
});
