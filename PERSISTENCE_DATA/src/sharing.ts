/**
 * Persistence/Data — URL sharing.
 *
 * Encode progressions as human-readable URL hash fragments and decode them back.
 *
 * Format (PD-DEV-D5):
 *   Dm7-G7-Cmaj7&t=120&g=4&v=1
 *
 * Parameters:
 *   (leading, before first &) — dash-separated chord symbols
 *   t — tempo BPM (integer)
 *   g — grid denominator (4 for "1/4", 8 for "1/8", etc.)
 *   v — schema version (integer)
 *
 * Sharp encoding: "#" in chord symbols is encoded as "s" in the URL
 * (e.g., F#7 → Fs7). Decoded back on read. (PD-DEV-D5)
 *
 * The returned string is the hash fragment content — the caller adds the "#p=" prefix.
 */

import {
  type SharePayload,
  type GridValue,
  CURRENT_SCHEMA_VERSION,
} from "./types.js";

// ---------------------------------------------------------------------------
// Grid conversion
// ---------------------------------------------------------------------------

/** Map grid string → denominator integer for URL encoding. */
const GRID_TO_DENOM: ReadonlyMap<GridValue, number> = new Map([
  ["1/4", 4],
  ["1/8", 8],
  ["1/3", 3],
  ["1/6", 6],
]);

/** Reverse map: denominator integer → grid string. */
const DENOM_TO_GRID: ReadonlyMap<number, GridValue> = new Map([
  [4, "1/4"],
  [8, "1/8"],
  [3, "1/3"],
  [6, "1/6"],
]);

// ---------------------------------------------------------------------------
// Sharp encoding
// ---------------------------------------------------------------------------

/**
 * Encode sharp signs for URL: "#" → "s" at the accidental position.
 * Only the first "#" after the root letter is replaced (chord symbols
 * have at most one sharp in the root: C#, F#, G#, etc.).
 */
function encodeSharp(chord: string): string {
  return chord.replace("#", "s");
}

/**
 * Decode sharp signs from URL: "s" immediately after a root letter (A-G)
 * is restored to "#". Only the root-position "s" is decoded — "s" in
 * quality/extension tokens (e.g., "sus") is not at root position and
 * is left untouched.
 */
function decodeSharp(chord: string): string {
  return chord.replace(/^([A-G])s/, "$1#");
}

// ---------------------------------------------------------------------------
// encodeShareUrl
// ---------------------------------------------------------------------------

/**
 * Encode a progression into a human-readable URL fragment string.
 *
 * @returns The fragment content (without `#p=` prefix).
 *
 * @example
 * encodeShareUrl({ chords: ["Dm7","G7","Cmaj7"], tempo_bpm: 120, grid: "1/4" })
 * // → "Dm7-G7-Cmaj7&t=120&g=4&v=1"
 */
export function encodeShareUrl(
  record: Pick<SharePayload, "grid" | "tempo_bpm" | "chords"> &
    Partial<Pick<SharePayload, "schema_version">>,
): string {
  const version = record.schema_version ?? CURRENT_SCHEMA_VERSION;
  const denom = GRID_TO_DENOM.get(record.grid) ?? 4;
  const chords = record.chords.map(encodeSharp).join("-");

  return `${chords}&t=${record.tempo_bpm}&g=${denom}&v=${version}`;
}

// ---------------------------------------------------------------------------
// decodeShareUrl
// ---------------------------------------------------------------------------

/**
 * Decode a URL fragment string back to a SharePayload.
 *
 * Returns `null` on any failure (malformed string, missing parameters,
 * invalid grid denominator, etc.).
 *
 * @example
 * decodeShareUrl("Dm7-G7-Cmaj7&t=120&g=4&v=1")
 * // → { schema_version: 1, grid: "1/4", tempo_bpm: 120, chords: ["Dm7","G7","Cmaj7"] }
 */
export function decodeShareUrl(payload: string): SharePayload | null {
  if (!payload || typeof payload !== "string") return null;

  // Split on first "&" to separate chords from parameters
  const ampIdx = payload.indexOf("&");
  if (ampIdx === -1) return null;

  const chordsStr = payload.slice(0, ampIdx);
  const paramsStr = payload.slice(ampIdx + 1);

  // Parse parameters
  const params = new Map<string, string>();
  for (const pair of paramsStr.split("&")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    params.set(pair.slice(0, eqIdx), pair.slice(eqIdx + 1));
  }

  // Extract and validate required parameters
  const tStr = params.get("t");
  const gStr = params.get("g");
  const vStr = params.get("v");

  if (tStr === undefined || gStr === undefined || vStr === undefined) {
    return null;
  }

  const tempo_bpm = Number(tStr);
  const gridDenom = Number(gStr);
  const schema_version = Number(vStr);

  if (!Number.isFinite(tempo_bpm)) return null;
  if (!Number.isFinite(schema_version)) return null;

  const grid = DENOM_TO_GRID.get(gridDenom);
  if (grid === undefined) return null;

  // Parse chords
  if (chordsStr.length === 0) return null;
  const chords = chordsStr.split("-").map(decodeSharp);

  // Validate all chords are non-empty strings
  if (chords.some((c) => c.length === 0)) return null;

  return { schema_version, grid, tempo_bpm, chords };
}
