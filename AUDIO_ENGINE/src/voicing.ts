/**
 * Voicing model for Audio Engine.
 *
 * Converts pitch-class sets to MIDI note arrays with optional
 * greedy minimal-motion voice-leading from a previous voicing.
 *
 * AE-D1: MIDI internal representation (0–127)
 * AE-D3: Greedy minimal-motion voice-leading (Level 1)
 * ARCH §3: pitch-class set → octave placement → voice-leading → MIDI notes
 */

const DEFAULT_REGISTER = 60; // Middle C (C4)
const MIDI_MIN = 0;
const MIDI_MAX = 127;

/**
 * Find the MIDI note with the given pitch class closest to the target note.
 * Ties (tritone, distance = 6) broken by preferring the upward direction.
 * Result clamped to MIDI range [0, 127].
 */
export function nearestMidiNote(target: number, pc: number): number {
  const targetPc = ((target % 12) + 12) % 12;
  const diff = ((pc - targetPc) % 12 + 12) % 12;
  const up = target + diff;
  const down = up - 12;
  const note = Math.abs(up - target) <= Math.abs(down - target) ? up : down;
  return Math.max(MIDI_MIN, Math.min(MIDI_MAX, note));
}

/**
 * Place pitch classes around a target register (no voice-leading).
 * Each pitch class maps to the nearest MIDI note to the register.
 * Returns array in the same order as input pcs.
 */
export function voiceInRegister(
  pcs: readonly number[],
  register: number = DEFAULT_REGISTER,
): number[] {
  return pcs.map((pc) => nearestMidiNote(register, pc));
}

/**
 * Voice-lead from a previous voicing to new pitch classes.
 *
 * Uses greedy minimal-motion algorithm (AE-D3): repeatedly assigns the
 * (previous note, new pitch class) pair with the smallest semitone
 * distance until all new pitch classes are assigned.
 *
 * - Same voice count: 1-to-1 assignment.
 * - More new pcs than prev notes: closest pairs assigned first,
 *   remaining pcs placed near the centroid of the previous voicing.
 * - More prev notes than new pcs: closest pairs assigned, excess
 *   previous notes ignored.
 * - Empty prevVoicing: falls back to voiceInRegister.
 *
 * Returns MIDI note array in the same order as newPcs.
 */
export function voiceLead(
  prevVoicing: readonly number[],
  newPcs: readonly number[],
  register: number = DEFAULT_REGISTER,
): number[] {
  if (newPcs.length === 0) return [];
  if (prevVoicing.length === 0) return voiceInRegister(newPcs, register);

  const result = new Array<number>(newPcs.length);

  const availPrev: Array<{ midi: number; idx: number }> = prevVoicing.map(
    (midi, idx) => ({ midi, idx }),
  );
  const availNew: Array<{ pc: number; idx: number }> = newPcs.map(
    (pc, idx) => ({ pc, idx }),
  );

  while (availNew.length > 0 && availPrev.length > 0) {
    let bestDist = Infinity;
    let bestPi = 0;
    let bestNi = 0;
    let bestMidi = 0;

    for (let pi = 0; pi < availPrev.length; pi++) {
      for (let ni = 0; ni < availNew.length; ni++) {
        const midi = nearestMidiNote(availPrev[pi].midi, availNew[ni].pc);
        const dist = Math.abs(midi - availPrev[pi].midi);
        if (dist < bestDist) {
          bestDist = dist;
          bestPi = pi;
          bestNi = ni;
          bestMidi = midi;
        }
      }
    }

    result[availNew[bestNi].idx] = bestMidi;
    availPrev.splice(bestPi, 1);
    availNew.splice(bestNi, 1);
  }

  // Remaining new pcs (more voices in new chord than prev)
  if (availNew.length > 0) {
    const centroid = Math.round(
      prevVoicing.reduce((sum, n) => sum + n, 0) / prevVoicing.length,
    );
    for (const { pc, idx } of availNew) {
      result[idx] = nearestMidiNote(centroid, pc);
    }
  }

  return result;
}
