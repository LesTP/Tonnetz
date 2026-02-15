/**
 * Integration Module — Application entry point.
 *
 * Phase 1b: minimal boot verification. Imports from all four subsystems
 * and confirms the module bundler resolves them at runtime.
 *
 * Full startup sequence (Phase 6a) will replace this stub.
 */

import { parseChordSymbol } from "harmony-core";
import { latticeToWorld } from "rendering-ui";
import { midiToFreq } from "audio-engine";
import { DEFAULT_SETTINGS, CURRENT_SCHEMA_VERSION } from "persistence-data";

const app = document.getElementById("app");
if (!app) throw new Error("Missing #app container");

const status = [
  `HC: parseChordSymbol → ${typeof parseChordSymbol}`,
  `RU: latticeToWorld → ${typeof latticeToWorld}`,
  `AE: midiToFreq(69) → ${midiToFreq(69).toFixed(1)} Hz`,
  `PD: schema v${CURRENT_SCHEMA_VERSION}, default tempo ${DEFAULT_SETTINGS.tempo_bpm} BPM`,
];

app.innerHTML = `
  <div style="font-family: system-ui, sans-serif; padding: 2rem;">
    <h1>Tonnetz — Interactive Harmonic Explorer</h1>
    <p>Phase 1b: all subsystems loaded ✓</p>
    <pre>${status.join("\n")}</pre>
  </div>
`;

console.log("[tonnetz] Phase 1b boot complete —", status.join(", "));
