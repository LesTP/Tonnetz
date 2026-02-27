/**
 * Persistence/Data — URL sharing.
 *
 * Encode progressions as human-readable URL hash fragments and decode them back.
 *
 * Format:
 *   Dm7-G7-Cmaj7&t=120
 *
 * Parameters:
 *   (leading, before first &) — dash-separated chord symbols
 *   t — tempo BPM (integer)
 *
 * Sharp encoding: "#" in chord symbols is encoded as "s" in the URL
 * (e.g., F#7 → Fs7). Decoded back on read.
 *
 * The returned string is the hash fragment content — the caller adds the "#p=" prefix.
 */

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
// Types
// ---------------------------------------------------------------------------

export interface SharePayload {
  readonly tempo_bpm: number;
  readonly chords: readonly string[];
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
 * encodeShareUrl({ chords: ["Dm7","G7","Cmaj7"], tempo_bpm: 120 })
 * // → "Dm7-G7-Cmaj7&t=120"
 */
export function encodeShareUrl(
  record: SharePayload,
): string {
  const chords = record.chords.map(encodeSharp).join("-");
  return `${chords}&t=${record.tempo_bpm}`;
}

// ---------------------------------------------------------------------------
// decodeShareUrl
// ---------------------------------------------------------------------------

/**
 * Decode a URL fragment string back to a SharePayload.
 *
 * Returns `null` on any failure (malformed string, missing parameters, etc.).
 *
 * @example
 * decodeShareUrl("Dm7-G7-Cmaj7&t=120")
 * // → { tempo_bpm: 120, chords: ["Dm7","G7","Cmaj7"] }
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

  // Extract tempo (required)
  const tStr = params.get("t");
  if (tStr === undefined) return null;

  const tempo_bpm = Number(tStr);
  if (!Number.isFinite(tempo_bpm)) return null;

  // Parse chords
  if (chordsStr.length === 0) return null;
  const chords = chordsStr.split("-").map(decodeSharp);
  if (chords.some((c) => c.length === 0)) return null;

  return { tempo_bpm, chords };
}
