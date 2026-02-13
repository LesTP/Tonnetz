import type { Chord, Extension, Quality } from "./types.js";

const ROOT_MAP: Record<string, number> = {
  C: 0, "C#": 1, Db: 1,
  D: 2, "D#": 3, Eb: 3,
  E: 4,
  F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10,
  B: 11,
};

const TRIAD_INTERVALS: Record<Quality, [number, number, number]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};

const EXTENSION_INTERVALS: Record<Extension, number[]> = {
  "6": [9],
  "7": [10],
  maj7: [11],
  add9: [2],
  "6/9": [9, 2],
};

const CHORD_RE = /^([A-G])(#|b)?(m(?!aj)|dim|aug)?(maj7|add9|6\/9|6|7)?$/;

const QUALITY_MAP: Record<string, Quality> = {
  m: "min",
  dim: "dim",
  aug: "aug",
};

/**
 * Parse a chord symbol string into a Chord structure.
 *
 * - Root is case-insensitive (first character uppercased).
 * - Quality/extension tokens are case-sensitive.
 * - Augmented extended chords (aug + extension) are rejected.
 */
export function parseChordSymbol(text: string): Chord {
  const normalized = text[0]?.toUpperCase() + text.slice(1);
  const match = CHORD_RE.exec(normalized);
  if (!match) {
    throw new Error(`Invalid chord symbol: "${text}"`);
  }

  const [, rootLetter, accidental, qualityToken, extToken] = match;
  const rootName = rootLetter + (accidental ?? "");
  const rootPc = ROOT_MAP[rootName];
  if (rootPc === undefined) {
    throw new Error(`Unknown root note: "${rootName}"`);
  }

  const quality: Quality = qualityToken ? QUALITY_MAP[qualityToken] : "maj";
  const extension: Extension | null = (extToken as Extension) ?? null;

  if (quality === "aug" && extension !== null) {
    throw new Error(
      `Augmented extended chords excluded from MVP: "${text}"`,
    );
  }

  return computeChordPcs(rootPc, quality, extension);
}

/**
 * Compute full pitch-class sets for a chord from its parsed components.
 */
export function computeChordPcs(
  rootPc: number,
  quality: Quality,
  extension: Extension | null,
): Chord {
  const triadIntervals = TRIAD_INTERVALS[quality];
  const main_triad_pcs = triadIntervals.map(
    (i) => (rootPc + i) % 12,
  ) as [number, number, number];

  const pcsSet = new Set(main_triad_pcs);
  if (extension) {
    for (const interval of EXTENSION_INTERVALS[extension]) {
      pcsSet.add((rootPc + interval) % 12);
    }
  }

  return {
    root_pc: rootPc,
    quality,
    extension,
    chord_pcs: [...pcsSet],
    main_triad_pcs,
  };
}
