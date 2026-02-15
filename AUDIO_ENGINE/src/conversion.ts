/**
 * Conversion utility: Shape[] → ChordEvent[].
 *
 * Bridges the gap between Harmony Core's mapProgressionToShapes() output
 * and Audio Engine's scheduleProgression() input.
 *
 * See DEVPLAN Phase 3b and SPEC.md §Integration Module.
 */

import type { Shape } from "harmony-core";
import type { ChordEvent } from "./types.js";

/**
 * Convert an array of Shapes into sequential ChordEvents.
 *
 * Each chord is assigned equal duration, placed sequentially starting at beat 0.
 *
 * @param shapes - Shapes from Harmony Core (e.g., mapProgressionToShapes())
 * @param beatsPerChord - Duration of each chord in beats (default: 1)
 * @returns ChordEvent array ready for AudioTransport.scheduleProgression()
 */
export function shapesToChordEvents(
  shapes: readonly Shape[],
  beatsPerChord: number = 1,
): ChordEvent[] {
  return shapes.map((shape, i) => ({
    shape,
    startBeat: i * beatsPerChord,
    durationBeats: beatsPerChord,
  }));
}
