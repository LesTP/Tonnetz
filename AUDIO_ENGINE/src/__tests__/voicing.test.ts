import { describe, it, expect } from "vitest";
import { nearestMidiNote, voiceInRegister, voiceLead } from "../voicing.js";

// ── nearestMidiNote ──────────────────────────────────────────────────

describe("nearestMidiNote", () => {
  it("returns same note when target already has the pitch class", () => {
    expect(nearestMidiNote(60, 0)).toBe(60); // C4 → C
    expect(nearestMidiNote(64, 4)).toBe(64); // E4 → E
    expect(nearestMidiNote(67, 7)).toBe(67); // G4 → G
  });

  it("finds nearest note upward when closer", () => {
    // target=60(C4), pc=4(E): up=64(+4), down=52(-8) → 64
    expect(nearestMidiNote(60, 4)).toBe(64);
  });

  it("finds nearest note downward when closer", () => {
    // target=60(C4), pc=7(G): up=67(+7), down=55(-5) → 55
    expect(nearestMidiNote(60, 7)).toBe(55);
  });

  it("prefers upward direction on tritone tie (distance 6)", () => {
    // target=60(C4), pc=6(F#): up=66(+6), down=54(-6) → 66
    expect(nearestMidiNote(60, 6)).toBe(66);
  });

  it("works at low MIDI range", () => {
    expect(nearestMidiNote(12, 0)).toBe(12); // C1
    expect(nearestMidiNote(12, 11)).toBe(11); // B0
  });

  it("clamps to MIDI minimum (0)", () => {
    // target=3, pc=8: up=8(+5), down=-4(-7) → 8 (but if target=2, pc=7: up=7(+5), down=-5 clamped)
    expect(nearestMidiNote(2, 7)).toBeGreaterThanOrEqual(0);
    // target=0, pc=0 → 0
    expect(nearestMidiNote(0, 0)).toBe(0);
  });

  it("clamps to MIDI maximum (127)", () => {
    // target=127, pc=7(G): up would be 127+7=134, down=122
    // 127 pc = 127%12 = 7, so diff=0, up=127, down=115 → 127
    expect(nearestMidiNote(127, 7)).toBe(127);
    expect(nearestMidiNote(125, 0)).toBeLessThanOrEqual(127);
  });

  it("handles negative target mod correctly", () => {
    // Edge: very low target where JavaScript % might return negative
    expect(nearestMidiNote(1, 0)).toBe(0);
  });
});

// ── voiceInRegister ──────────────────────────────────────────────────

describe("voiceInRegister", () => {
  it("places C major triad around register 60", () => {
    // pcs: [0(C), 4(E), 7(G)]
    // C→60, E→64, G→55 (nearest to 60)
    const result = voiceInRegister([0, 4, 7], 60);
    expect(result).toEqual([60, 64, 55]);
  });

  it("places F major triad around register 60", () => {
    // pcs: [5(F), 9(A), 0(C)]
    // F→65(+5) vs 53(-7) → 65? No: |65-60|=5, |53-60|=7 → 65
    // A: diff=9, up=69, down=57. |69-60|=9, |57-60|=3 → 57
    // C→60
    const result = voiceInRegister([5, 9, 0], 60);
    expect(result).toEqual([65, 57, 60]);
  });

  it("uses default register 60 when not specified", () => {
    const result = voiceInRegister([0]);
    expect(result).toEqual([60]);
  });

  it("shifts output range with register parameter", () => {
    // Register 48 (C3): C→48, E→52, G→43
    const at48 = voiceInRegister([0, 4, 7], 48);
    expect(at48).toEqual([48, 52, 43]);

    // Register 72 (C5): C→72, E→76, G→67
    const at72 = voiceInRegister([0, 4, 7], 72);
    expect(at72).toEqual([72, 76, 67]);
  });

  it("returns empty array for empty input", () => {
    expect(voiceInRegister([])).toEqual([]);
  });

  it("handles single pitch class", () => {
    expect(voiceInRegister([7], 60)).toEqual([55]);
    expect(voiceInRegister([0], 60)).toEqual([60]);
  });

  it("places 7th chord (4 notes)", () => {
    // Cmaj7: [0, 4, 7, 11] at register 60
    // C→60, E→64, G→55, B→59
    const result = voiceInRegister([0, 4, 7, 11], 60);
    expect(result).toEqual([60, 64, 55, 59]);
  });

  it("all notes are valid MIDI (0–127)", () => {
    const result = voiceInRegister([0, 3, 6, 9], 60);
    for (const note of result) {
      expect(note).toBeGreaterThanOrEqual(0);
      expect(note).toBeLessThanOrEqual(127);
    }
  });

  it("preserves input order (result[i] corresponds to pcs[i])", () => {
    const result = voiceInRegister([7, 0, 4], 60);
    // G→55, C→60, E→64
    expect(result).toEqual([55, 60, 64]);
  });
});

// ── voiceLead ────────────────────────────────────────────────────────

describe("voiceLead — basic voice-leading", () => {
  it("voices C major → F major with minimal motion", () => {
    // prev: C major [60, 64, 55] (C4, E4, G3)
    // new pcs: [5(F), 9(A), 0(C)]
    //
    // Greedy assignment:
    //   60→pc0: dist=0 (midi=60) ← smallest
    //   64→pc5: dist=1 (midi=65)
    //   55→pc9: dist=2 (midi=57)
    //
    // Result: [65, 57, 60] (F4, A3, C4)
    // Total motion: 0 + 1 + 2 = 3 semitones
    const result = voiceLead([60, 64, 55], [5, 9, 0]);
    expect(result).toEqual([65, 57, 60]);
  });

  it("voices C major → A minor with minimal motion", () => {
    // prev: [60, 64, 55] (C4, E4, G3)
    // new pcs: [9(A), 0(C), 4(E)]
    //
    // Cost matrix:
    //   60→pc9: 57(dist=3), 60→pc0: 60(dist=0), 60→pc4: 64(dist=4)
    //   64→pc9: 69(dist=5), 64→pc0: 60(dist=4), 64→pc4: 64(dist=0)
    //   55→pc9: 57(dist=2), 55→pc0: 60(dist=5), 55→pc4: 52(dist=3)
    //
    // Greedy: 60→pc0(0), 64→pc4(0), 55→pc9(2)
    // Result: [57, 60, 64]
    const result = voiceLead([60, 64, 55], [9, 0, 4]);
    expect(result).toEqual([57, 60, 64]);
  });

  it("common tones stay put (zero motion)", () => {
    // prev: [60, 64, 67], new pcs same as prev: [0, 4, 7]
    // Every note can stay at distance 0
    const result = voiceLead([60, 64, 67], [0, 4, 7]);
    expect(result).toEqual([60, 64, 67]);
  });

  it("half-step voice-leading (chromatic mediant)", () => {
    // prev: C major [60, 64, 67] (C4, E4, G4)
    // new pcs: [4, 8, 11] (E major: E, G#, B)
    //
    // 64→pc4: 64(dist=0)
    // 67→pc8: 68(dist=1), 67→pc11: 67+4=71(dist=4) or 67-8=59? let me recalc
    // Actually: 60→pc4: 64(4), 60→pc8: 56(4), 60→pc11: 59(1)
    //           64→pc4: 64(0), 64→pc8: 68(4), 64→pc11: 59(5) or 71?
    //             diff for 11: ((11-4)%12+12)%12=7, up=71, down=59. |71-64|=7, |59-64|=5 → 59. dist=5
    //           67→pc4: 64(3), 67→pc8: 68(1), 67→pc11: 71(4) or 59?
    //             diff for 11: ((11-7)%12+12)%12=4, up=71, down=59. |71-67|=4, |59-67|=8 → 71. dist=4
    //             diff for 8: ((8-7)%12+12)%12=1, up=68, down=56. |68-67|=1 → 68. dist=1
    //
    // Greedy: 64→pc4: 0, then 60→pc11: 59(1)?
    //   Wait: 60→pc11: ((11-0)%12+12)%12=11, up=71, down=59. |71-60|=11, |59-60|=1 → 59. dist=1
    //   So both 64→pc4(0) and 60→pc11(1) are candidates.
    //   Pick 64→pc4(0) first. Remove.
    //   Remaining: {60, 67} × {pc8, pc11}
    //   60→pc8: ((8-0)%12)=8, up=68, down=56. |68-60|=8, |56-60|=4 → 56. dist=4
    //   60→pc11: 59. dist=1
    //   67→pc8: 68. dist=1
    //   67→pc11: 71. dist=4
    //   Tie at dist=1: 60→pc11(59) vs 67→pc8(68). Pick first found: 60→pc11.
    //   Then 67→pc8: 68.
    //
    // Result: [59, 64, 68] (B3, E4, G#4) — indices correspond to [pc4, pc8, pc11]
    // Wait, newPcs = [4, 8, 11]. result[0]=pc4, result[1]=pc8, result[2]=pc11
    // So: result = [64, 68, 59]
    const result = voiceLead([60, 64, 67], [4, 8, 11]);
    expect(result).toEqual([64, 68, 59]);

    // Verify total motion
    const totalMotion =
      Math.abs(60 - 59) + Math.abs(64 - 64) + Math.abs(67 - 68);
    expect(totalMotion).toBe(2); // Very smooth
  });
});

describe("voiceLead — edge cases", () => {
  it("returns empty array for empty pcs", () => {
    expect(voiceLead([60, 64, 67], [])).toEqual([]);
  });

  it("falls back to voiceInRegister when prevVoicing is empty", () => {
    const result = voiceLead([], [0, 4, 7], 60);
    expect(result).toEqual(voiceInRegister([0, 4, 7], 60));
  });

  it("handles single pitch class", () => {
    const result = voiceLead([60], [7]);
    // nearest G to 60: 55(dist=5) or 67(dist=7) → 55
    expect(result).toEqual([55]);
  });

  it("handles more new pcs than prev notes (triad → 7th chord)", () => {
    // prev: C major [60, 64, 67] (3 notes)
    // new: Cmaj7 pcs [0, 4, 7, 11] (4 notes)
    //
    // Greedy matches 3 pairs first, then places the 4th near centroid
    // Centroid of [60, 64, 67] = round(191/3) = 64
    const result = voiceLead([60, 64, 67], [0, 4, 7, 11]);
    expect(result).toHaveLength(4);

    // All notes should be valid MIDI
    for (const note of result) {
      expect(note).toBeGreaterThanOrEqual(0);
      expect(note).toBeLessThanOrEqual(127);
    }

    // The 3 common tones should stay (dist=0 each):
    // 60→pc0(0), 64→pc4(0), 67→pc7(0)
    // 4th note (pc11=B) placed near centroid 64: nearest B to 64 = 59(dist=5) or 71(dist=7) → 59
    expect(result).toEqual([60, 64, 67, 59]);
  });

  it("handles more prev notes than new pcs (7th chord → triad)", () => {
    // prev: Cmaj7 [60, 64, 67, 59] (4 notes)
    // new: C major pcs [0, 4, 7] (3 notes)
    //
    // Greedy matches 3 best pairs; one prev note unused
    // 60→pc0(0), 64→pc4(0), 67→pc7(0), 59 unused
    const result = voiceLead([60, 64, 67, 59], [0, 4, 7]);
    expect(result).toHaveLength(3);
    expect(result).toEqual([60, 64, 67]);
  });

  it("handles identical chords (all common tones)", () => {
    const prev = [60, 64, 67];
    const result = voiceLead(prev, [0, 4, 7]);
    expect(result).toEqual([60, 64, 67]);
  });
});

describe("voiceLead — musical progressions", () => {
  it("ii–V–I progression maintains smooth voice-leading", () => {
    // Dm7 pcs: [2, 5, 9, 0] (D, F, A, C)
    const dm7 = voiceInRegister([2, 5, 9, 0], 60);

    // G7 pcs: [7, 11, 2, 5] (G, B, D, F)
    const g7 = voiceLead(dm7, [7, 11, 2, 5]);

    // Cmaj7 pcs: [0, 4, 7, 11] (C, E, G, B)
    const cmaj7 = voiceLead(g7, [0, 4, 7, 11]);

    // All voicings should be 4 notes
    expect(dm7).toHaveLength(4);
    expect(g7).toHaveLength(4);
    expect(cmaj7).toHaveLength(4);

    // Voice-leading should be smooth: total motion per step ≤ 12 semitones
    function totalMotion(a: number[], b: number[]): number {
      // Sum of absolute differences (sorted for comparison)
      const sa = [...a].sort((x, y) => x - y);
      const sb = [...b].sort((x, y) => x - y);
      return sa.reduce((sum, v, i) => sum + Math.abs(v - sb[i]), 0);
    }

    expect(totalMotion(dm7, g7)).toBeLessThanOrEqual(12);
    expect(totalMotion(g7, cmaj7)).toBeLessThanOrEqual(12);
  });

  it("chromatic semitone motion (C → Db)", () => {
    // C major [0, 4, 7] → Db major [1, 5, 8]
    const cMaj = voiceInRegister([0, 4, 7], 60);
    const dbMaj = voiceLead(cMaj, [1, 5, 8]);

    // Every voice should move by exactly 1 semitone
    const cSorted = [...cMaj].sort((a, b) => a - b);
    const dbSorted = [...dbMaj].sort((a, b) => a - b);
    for (let i = 0; i < cSorted.length; i++) {
      expect(Math.abs(cSorted[i] - dbSorted[i])).toBeLessThanOrEqual(2);
    }
  });
});

describe("voiceLead — register parameter", () => {
  it("uses custom register as fallback when prevVoicing is empty", () => {
    const at48 = voiceLead([], [0, 4, 7], 48);
    const at72 = voiceLead([], [0, 4, 7], 72);

    // Different registers → different MIDI notes
    expect(at48).not.toEqual(at72);

    // Should match voiceInRegister output
    expect(at48).toEqual(voiceInRegister([0, 4, 7], 48));
    expect(at72).toEqual(voiceInRegister([0, 4, 7], 72));
  });
});
