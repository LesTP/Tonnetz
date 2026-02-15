import { describe, it, expect } from "vitest";

describe("Audio Engine — barrel export smoke", () => {
  it("barrel import resolves with expected public API", async () => {
    const mod = await import("../index.js");
    expect(mod.initAudio).toBeTypeOf("function");
    expect(mod.createImmediatePlayback).toBeTypeOf("function");
    expect(mod.playPitchClasses).toBeTypeOf("function");
    expect(mod.playShape).toBeTypeOf("function");
    expect(mod.stopAll).toBeTypeOf("function");
    expect(mod.shapesToChordEvents).toBeTypeOf("function");
    expect(mod.midiToFreq).toBeTypeOf("function");
    expect(mod.voiceLead).toBeTypeOf("function");
    expect(mod.beatsToSeconds).toBeTypeOf("function");
  });
});
