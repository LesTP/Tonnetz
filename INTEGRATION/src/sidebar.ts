/**
 * Sidebar — Two-tab sidebar component (Play | Library) for the Tonnetz app.
 *
 * Phase 1a: DOM structure, CSS injection, responsive layout, tab switching,
 * hamburger overlay, playback controls, tempo, active chord display.
 *
 * Replaces the three-zone layout (createLayoutManager + createControlPanel +
 * createToolbar) from Rendering/UI. See POL-D1, POL-D9.
 */

import { injectCSS, HIDDEN_CLASS } from "rendering-ui";
import type { SynthPreset } from "audio-engine";
import { ALL_PRESETS, DEFAULT_PRESET } from "audio-engine";

// ── Types ────────────────────────────────────────────────────────────

export interface SidebarOptions {
  /** Root element to build the layout into (typically #app). */
  root: HTMLElement;
  /** Callback when user submits progression text. */
  onLoadProgression: (text: string) => void;
  /** Callback when user clicks Play. */
  onPlay: () => void;
  /** Callback when user clicks Stop. */
  onStop: () => void;
  /** Callback when user clicks Clear (dismisses progression + resets viewport). */
  onClear: () => void;
  /** Callback when tempo slider changes. */
  onTempoChange: (bpm: number) => void;
  /** Callback when loop toggle changes. */
  onLoopToggle: (enabled: boolean) => void;
  /** Callback when playback mode toggle changes (piano = hard cut, pad = voice continuation). */
  onPlaybackModeChange?: (mode: "piano" | "pad") => void;
  /** Callback when synthesis preset changes. */
  onPresetChange?: (preset: SynthPreset) => void;
  /** Callback when user clicks Share. Returns share URL string, or null if nothing to share. */
  onShare?: () => string | null;
  /** Callback when "What This Is" info button is clicked. */
  onAbout?: () => void;
  /** Callback when "How to Use" info button is clicked. */
  onHowToUse?: () => void;
  /** Initial tempo BPM value. */
  initialTempo: number;
}

export interface Sidebar {
  /** Get the canvas container element (for SVG scaffold mounting). */
  getCanvasContainer(): HTMLElement;
  /** Update button states for progression loaded/unloaded. */
  setProgressionLoaded(loaded: boolean): void;
  /** Update button states for playback running/stopped. */
  setPlaybackRunning(running: boolean): void;
  /** Set the progression input textarea text. */
  setInputText(text: string): void;
  /** Set the tempo slider and label to a specific BPM. */
  setTempo(bpm: number): void;
  /** Set the loop toggle state. */
  setLoopEnabled(enabled: boolean): void;
  /** Query the loop toggle state. */
  isLoopEnabled(): boolean;
  /** Set the playback mode (piano/pad). */
  setPlaybackMode(mode: "piano" | "pad"): void;
  /** Get the current playback mode. */
  getPlaybackMode(): "piano" | "pad";
  /** Set the current synthesis preset. */
  setPreset(preset: SynthPreset): void;
  /** Get the current synthesis preset. */
  getPreset(): SynthPreset;
  /** Programmatically switch to a tab.
   * @deprecated Tabs removed — single-panel view. No-op for backward compat. */
  switchToTab(tab: "play" | "library"): void;
  /** Get the library list container (for Phase 2 population). */
  getLibraryListContainer(): HTMLElement;
  /** Open the sidebar on mobile. */
  open(): void;
  /** Close the sidebar on mobile. */
  close(): void;
  /** Tear down all DOM and listeners. */
  destroy(): void;
}

// ── CSS ──────────────────────────────────────────────────────────────

const STYLE_ID = "sidebar";
const BREAKPOINT = 1024;

const C = {
  app: "tonnetz-app",
  backdrop: "tonnetz-sidebar-backdrop",
  sidebar: "tonnetz-sidebar",
  sidebarOpen: "tonnetz-sidebar--open",
  sidebarScroll: "tonnetz-sidebar-scroll",
  header: "tonnetz-sidebar-header",
  titleRow: "tonnetz-sidebar-title-row",
  title: "tonnetz-sidebar-title",
  subtitle: "tonnetz-sidebar-subtitle",
  infoFooter: "tonnetz-sidebar-info-footer",
  infoFooterBtn: "tonnetz-sidebar-info-footer-btn",
  infoFooterBtnLarge: "tonnetz-sidebar-info-footer-btn-lg",
  tabPanel: "tonnetz-sidebar-tab-panel",
  inputGroup: "tonnetz-sidebar-input-group",
  textarea: "tonnetz-sidebar-textarea",
  transport: "tonnetz-sidebar-transport",
  transportBtn: "tonnetz-sidebar-transport-btn",
  transportBtnActive: "tonnetz-sidebar-transport-btn--active",
  tempoGroup: "tonnetz-sidebar-tempo-group",
  tempoField: "tonnetz-sidebar-tempo-field",
  tempoSuffix: "tonnetz-sidebar-tempo-suffix",
  settingsRow: "tonnetz-sidebar-settings-row",
  settingsToggle: "tonnetz-sidebar-settings-toggle",
  presetSelect: "tonnetz-sidebar-preset-select",
  clearBtn: "tonnetz-sidebar-clear-btn",
  libraryList: "tonnetz-sidebar-library-list",
  separator: "tonnetz-sidebar-separator",
  canvasArea: "tonnetz-canvas-area",
  hamburger: "tonnetz-hamburger",
  floatingTransport: "tonnetz-floating-transport",
  floatingBtn: "tonnetz-floating-btn",
  overlay: "tonnetz-overlay",
  overlayBackdrop: "tonnetz-overlay-backdrop",
  overlayPanel: "tonnetz-overlay-panel",
  overlayHeader: "tonnetz-overlay-header",
  overlayTitle: "tonnetz-overlay-title",
  overlayClose: "tonnetz-overlay-close",
  overlayBody: "tonnetz-overlay-body",
  hidden: HIDDEN_CLASS,
} as const;

const STYLES = `
/* Layout root */
.${C.app} {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  color: #222;
}

/* Backdrop (mobile overlay) */
.${C.backdrop} {
  display: none;
}
@media (max-width: ${BREAKPOINT - 1}px) {
  .${C.backdrop} {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 90;
  }
  .${C.backdrop}.${C.sidebarOpen} {
    display: block;
  }
}

/* Sidebar */
.${C.sidebar} {
  display: flex;
  flex-direction: column;
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid #d0d0d0;
  overflow: hidden;
  z-index: 100;
}
@media (max-width: ${BREAKPOINT - 1}px) {
  .${C.sidebar} {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 320px;
    background: #fafafa;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: none;
  }
  .${C.sidebar}.${C.sidebarOpen} {
    transform: translateX(0);
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  }
}

/* Scrollable content wrapper */
.${C.sidebarScroll} {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.12) transparent;
  min-height: 0;
}
.${C.sidebarScroll}::-webkit-scrollbar {
  width: 6px;
}
.${C.sidebarScroll}::-webkit-scrollbar-track {
  background: transparent;
}
.${C.sidebarScroll}::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.12);
  border-radius: 3px;
}
.${C.sidebarScroll}::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.25);
}

/* Header */
.${C.header} {
  flex-shrink: 0;
  padding: 24px 14px 16px;
  text-align: center;
  border-bottom: 1px solid #e0e0e0;
}

.${C.titleRow} {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 0;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.${C.title} {
  font-size: 30px;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  text-align: center;
  padding-left: 6px;
}

.${C.subtitle} {
  display: block;
  font-size: 17px;
  font-weight: 400;
  color: #777;
}

/* Info footer buttons (bottom of sidebar) */
.${C.infoFooter} {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 10px 20px 12px 14px;
  box-sizing: border-box;
  width: 100%;
  border-top: 1px solid #e0e0e0;
}
.${C.infoFooterBtn} {
  flex: 1;
  border: none;
  border-radius: 6px;
  padding: 8px 6px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: #555;
  line-height: 1.25;
  text-align: center;
  transition: opacity 0.15s;
}
.${C.infoFooterBtn}:hover {
  opacity: 0.8;
}
.${C.infoFooterBtnLarge} {
  font-size: 16px;
  font-weight: 700;
  color: #444;
}

/* Tab panels */
.${C.tabPanel} {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.12) transparent;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.${C.tabPanel}::-webkit-scrollbar {
  width: 6px;
}
.${C.tabPanel}::-webkit-scrollbar-track {
  background: transparent;
}
.${C.tabPanel}::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.12);
  border-radius: 3px;
}
.${C.tabPanel}::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.25);
}

/* Separator */
.${C.separator} {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 0;
}

/* Input group */
.${C.inputGroup} {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.${C.textarea} {
  width: 100%;
  min-height: 52px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  box-sizing: border-box;
}
.${C.textarea}:focus {
  outline: none;
  border-color: #2a9d8f;
}

/* Clear button

/* Transport buttons */
.${C.transport} {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Transport buttons — shared base */
.${C.transportBtn} {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.${C.transportBtn}:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #aaa;
}
.${C.transportBtn}:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #ddd;
}

/* Play button — same as other transport buttons (no special fill) */
.${C.transportBtn}[data-testid="play-btn"]:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  border-color: #ddd;
}

/* Loop toggle — teal filled when active */
.${C.transportBtnActive} {
  background: #2a9d8f;
  border-color: #2a9d8f;
  color: #fff;
}
.${C.transportBtnActive}:hover:not(:disabled) {
  background: #21867a;
  border-color: #21867a;
}

/* Clear button — icon style, red accent on hover */
.${C.clearBtn} {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.${C.clearBtn}:hover:not(:disabled) {
  background: #fef0f0;
  border-color: #e63946;
  color: #c5303c;
}
.${C.clearBtn}:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  color: #bbb;
  border-color: #ddd;
}

/* Tempo group (bordered container matching transport button height) */
.${C.tempoGroup} {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 8px;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  background: #fff;
  transition: border-color 0.15s;
}
.${C.tempoGroup}:focus-within {
  border-color: #2a9d8f;
}
.${C.tempoGroup}.disabled {
  opacity: 0.3;
  border-color: #ddd;
}
.${C.tempoField} {
  width: 42px;
  height: 28px;
  padding: 0 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  font-family: inherit;
  text-align: center;
  color: #333;
  outline: none;
  -moz-appearance: textfield;
}
.${C.tempoField}:focus {
  border-color: #2a9d8f;
}
.${C.tempoField}:disabled {
  cursor: not-allowed;
  border-color: #ddd;
  color: #aaa;
}
.${C.tempoField}::-webkit-inner-spin-button,
.${C.tempoField}::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.${C.tempoSuffix} {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}

/* Settings row (preset dropdown + playback mode toggle) */
.${C.settingsRow} {
  display: flex;
  align-items: center;
  gap: 8px;
}
.${C.settingsToggle} {
  flex-shrink: 0;
  padding: 6px 12px;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: #666;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.${C.settingsToggle}:hover {
  color: #555;
  border-color: #aaa;
}
.${C.presetSelect} {
  flex: 1;
  padding: 6px 8px;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.${C.presetSelect}:hover {
  border-color: #aaa;
}
.${C.presetSelect}:focus {
  border-color: #2a9d8f;
}

/* Library list (Phase 2 placeholder) */
.${C.libraryList} {
  flex: 1;
  overflow-y: auto;
}

/* Canvas area */
.${C.canvasArea} {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
}

/* Hamburger (mobile only) */
.${C.hamburger} {
  display: none;
}
@media (max-width: ${BREAKPOINT - 1}px) {
  .${C.hamburger} {
    display: flex;
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 80;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.85);
    font-size: 22px;
    cursor: pointer;
    backdrop-filter: blur(4px);
  }
  .${C.hamburger}:hover {
    background: rgba(255, 255, 255, 0.95);
  }
}

/* Floating transport (mobile only, visible when progression loaded + sidebar closed) */
.${C.floatingTransport} {
  display: none;
}
@media (max-width: ${BREAKPOINT - 1}px) {
  .${C.floatingTransport} {
    display: none;
    position: absolute;
    top: 60px;
    left: 8px;
    z-index: 80;
    flex-direction: column;
    gap: 6px;
  }
  .${C.floatingTransport}.visible {
    display: flex;
  }
  .${C.floatingBtn} {
    width: 44px;
    height: 44px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(4px);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #444;
    padding: 0;
  }
  .${C.floatingBtn}:hover {
    background: rgba(255, 255, 255, 0.95);
  }
  .${C.floatingBtn}:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

/* Hidden class */
.${C.hidden} { display: none !important; }

/* Info overlay modals */
.${C.overlay} {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.${C.overlayBackdrop} {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

.${C.overlayPanel} {
  position: relative;
  width: min(640px, calc(100% - 32px));
  max-height: calc(100vh - 64px);
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
}

.${C.overlayHeader} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.${C.overlayTitle} {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #222;
}

.${C.overlayClose} {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: #777;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.${C.overlayClose}:hover {
  background: #f0f0f0;
  color: #333;
}

.${C.overlayBody} {
  padding: 20px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: #444;
}
.${C.overlayBody} h2 {
  font-size: 15px;
  font-weight: 600;
  color: #222;
  margin: 16px 0 8px;
}
.${C.overlayBody} h2:first-child {
  margin-top: 0;
}
.${C.overlayBody} p {
  margin: 0 0 10px;
}
.${C.overlayBody} ul {
  margin: 0 0 10px;
  padding-left: 20px;
}
.${C.overlayBody} li {
  margin-bottom: 4px;
}
.${C.overlayBody} code {
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 13px;
}
`;

// ── Tempo constants ──────────────────────────────────────────────────

const TEMPO_MIN = 20;
const TEMPO_MAX = 960;

// ── Helpers ──────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      e.setAttribute(k, v);
    }
  }
  return e;
}

function clampTempo(bpm: number): number {
  return Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(bpm)));
}

// ── Factory ──────────────────────────────────────────────────────────

export function createSidebar(options: SidebarOptions): Sidebar {
  injectCSS(STYLE_ID, STYLES);

  const {
    root,
    onLoadProgression,
    onPlay,
    onStop,
    onClear,
    onTempoChange,
    onLoopToggle,
    onPlaybackModeChange,
    onPresetChange,
    onShare,
    onHowToUse,
    onAbout,
    initialTempo,
  } = options;

  // ── State ──────────────────────────────────────────────────────────

  let progressionLoaded = false;
  let playbackRunning = false;
  let loopEnabled = false;
  let currentPreset: SynthPreset = DEFAULT_PRESET;

  // ── Build DOM ──────────────────────────────────────────────────────

  // Layout root
  const appRoot = el("div", C.app);

  // Backdrop (mobile overlay dismiss target)
  const backdrop = el("div", C.backdrop);

  // Sidebar
  const sidebar = el("aside", C.sidebar);

  // ── Header ─────────────────────────────────────────────────────────

  const header = el("header", C.header);

  const titleEl = el("h1", C.title);
  titleEl.textContent = "Tone Nets";
  const subtitleEl = el("small", C.subtitle);
  subtitleEl.textContent = "an interactive Tonnetz explorer";
  titleEl.appendChild(subtitleEl);

  // Info buttons — bottom of sidebar, styled rectangles with triangle colors
  const infoFooter = el("div", C.infoFooter);
  const howBtn = el("button", C.infoFooterBtn, { "data-testid": "how-btn", "aria-label": "How to Use" });
  howBtn.style.background = "rgba(230,180,180,0.55)";
  howBtn.innerHTML = `<span class="${C.infoFooterBtnLarge}">How</span><br>to use`;
  const aboutBtn = el("button", C.infoFooterBtn, { "data-testid": "about-btn", "aria-label": "About" });
  aboutBtn.style.background = "rgba(170,195,235,0.55)";
  aboutBtn.innerHTML = `<span class="${C.infoFooterBtnLarge}">What</span><br>this is`;
  infoFooter.appendChild(howBtn);
  infoFooter.appendChild(aboutBtn);

  header.appendChild(titleEl);

  // ── Main Panel (controls + library in one scrollable view) ─────────

  const playPanel = el("section", C.tabPanel, { "data-testid": "panel-play" });

  // Progression input
  const inputGroup = el("div", C.inputGroup);
  const textarea = el("textarea", C.textarea, {
    placeholder: "Enter chords (e.g., Dm7 G7 Cmaj7)",
    "data-testid": "progression-input",
  });
  textarea.rows = 3;
  inputGroup.appendChild(textarea);

  // Transport buttons
  const transportRow = el("div", C.transport);

  const playBtn = el("button", C.transportBtn, { "data-testid": "play-btn", "aria-label": "Play" });
  playBtn.textContent = "▶";
  playBtn.disabled = true;

  const loopBtn = el("button", C.transportBtn, { "data-testid": "loop-btn", "aria-label": "Loop" });
  loopBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 0 1 10.5-4"/><path d="M14 8a6 6 0 0 1-10.5 4"/><polyline points="12,1 13,4 10,4.5"/><polyline points="4,15 3,12 6,11.5"/></svg>`;
  loopBtn.disabled = true;

  const shareBtn = el("button", C.transportBtn, { "data-testid": "share-btn", "aria-label": "Share" });
  shareBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8H2V14H14V8H10"/><polyline points="4,5 8,1 12,5"/><line x1="8" y1="1" x2="8" y2="10"/></svg>`;
  shareBtn.disabled = true;

  const clearBtn = el("button", C.clearBtn, { "data-testid": "clear-btn", "aria-label": "Clear" });
  clearBtn.textContent = "✕";
  clearBtn.disabled = true;

  // Tempo group (field + suffix in bordered container)
  const tempoGroup = el("div", `${C.tempoGroup} disabled`, { "data-testid": "tempo-group" });
  const tempoField = el("input", C.tempoField, {
    type: "number",
    min: String(TEMPO_MIN),
    max: String(TEMPO_MAX),
    value: String(clampTempo(initialTempo)),
    "data-testid": "tempo-field",
    "aria-label": "Tempo BPM",
  });
  const tempoSuffix = el("span", C.tempoSuffix);
  tempoSuffix.textContent = "BPM";
  (tempoField as HTMLInputElement).disabled = true;
  tempoGroup.appendChild(tempoField);
  tempoGroup.appendChild(tempoSuffix);

  transportRow.appendChild(playBtn);
  transportRow.appendChild(loopBtn);
  transportRow.appendChild(shareBtn);
  transportRow.appendChild(clearBtn);
  transportRow.appendChild(tempoGroup);

  // Settings row (preset dropdown + playback mode toggle)
  const settingsRow = el("div", C.settingsRow, { "data-testid": "settings-row" });

  const presetSelect = el("select", C.presetSelect, { "data-testid": "preset-select" }) as HTMLSelectElement;
  for (const preset of ALL_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.label;
    presetSelect.appendChild(option);
  }

  const playbackModeBtn = el("button", C.settingsToggle, { "data-testid": "playback-mode-toggle" });
  playbackModeBtn.textContent = "Staccato";

  settingsRow.appendChild(presetSelect);
  settingsRow.appendChild(playbackModeBtn);

  // Separator line between controls and library
  const separator = el("hr", C.separator);

  // Library section (inline, below separator)
  const libraryList = el("div", C.libraryList, { "data-testid": "library-list" });

  // Assemble panel (controls + separator + library)
  playPanel.appendChild(inputGroup);
  playPanel.appendChild(transportRow);
  playPanel.appendChild(settingsRow);
  playPanel.appendChild(separator);
  playPanel.appendChild(libraryList);

  // ── Assemble Sidebar ───────────────────────────────────────────────

  const scrollWrapper = el("div", C.sidebarScroll);
  scrollWrapper.appendChild(header);
  scrollWrapper.appendChild(playPanel);
  sidebar.appendChild(scrollWrapper);
  sidebar.appendChild(infoFooter);

  // ── Canvas Area ────────────────────────────────────────────────────

  const canvasArea = el("main", C.canvasArea, { "data-testid": "canvas-container" });

  const hamburgerBtn = el("button", C.hamburger, { "data-testid": "hamburger-btn", "aria-label": "Open menu" });
  hamburgerBtn.textContent = "☰";

  canvasArea.appendChild(hamburgerBtn);

  // Floating transport strip (mobile only — visible when progression loaded + sidebar closed)
  const floatingStrip = el("div", C.floatingTransport, { "data-testid": "floating-transport" });
  const fPlayBtn = el("button", C.floatingBtn, { "data-testid": "floating-play", "aria-label": "Play" });
  fPlayBtn.textContent = "▶";
  const fStopBtn = el("button", C.floatingBtn, { "data-testid": "floating-stop", "aria-label": "Stop" });
  fStopBtn.textContent = "■";
  fStopBtn.style.display = "none";
  const fLoopBtn = el("button", C.floatingBtn, { "data-testid": "floating-loop", "aria-label": "Loop" });
  fLoopBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 0 1 10.5-4"/><path d="M14 8a6 6 0 0 1-10.5 4"/><polyline points="12,1 13,4 10,4.5"/><polyline points="4,15 3,12 6,11.5"/></svg>`;
  const fClearBtn = el("button", C.floatingBtn, { "data-testid": "floating-clear", "aria-label": "Clear" });
  fClearBtn.textContent = "✕";
  const fShareBtn = el("button", C.floatingBtn, { "data-testid": "floating-share", "aria-label": "Share" });
  fShareBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8H2V14H14V8H10"/><polyline points="4,5 8,1 12,5"/><line x1="8" y1="1" x2="8" y2="10"/></svg>`;
  floatingStrip.appendChild(fPlayBtn);
  floatingStrip.appendChild(fStopBtn);
  floatingStrip.appendChild(fLoopBtn);
  floatingStrip.appendChild(fShareBtn);
  floatingStrip.appendChild(fClearBtn);
  canvasArea.appendChild(floatingStrip);

  // ── Info Overlay Modals ────────────────────────────────────────────

  let activeOverlay: HTMLElement | null = null;

  function buildOverlay(title: string, bodyHtml: string, testId: string): HTMLElement {
    const wrapper = el("div", C.overlay, { "data-testid": testId });
    const overlayBg = el("div", C.overlayBackdrop);
    const panel = el("div", C.overlayPanel);

    const hdr = el("div", C.overlayHeader);
    const titleEl2 = el("h2", C.overlayTitle);
    titleEl2.textContent = title;
    const closeBtn = el("button", C.overlayClose, { "aria-label": "Close" });
    closeBtn.textContent = "✕";
    hdr.appendChild(titleEl2);
    hdr.appendChild(closeBtn);

    const body = el("div", C.overlayBody);
    body.innerHTML = bodyHtml;

    panel.appendChild(hdr);
    panel.appendChild(body);
    wrapper.appendChild(overlayBg);
    wrapper.appendChild(panel);

    function dismiss(): void {
      wrapper.remove();
      if (activeOverlay === wrapper) activeOverlay = null;
    }

    closeBtn.addEventListener("click", dismiss);
    overlayBg.addEventListener("click", dismiss);

    return wrapper;
  }

  function openOverlay(title: string, bodyHtml: string, testId: string): void {
    // Close any existing overlay first
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
    const overlay = buildOverlay(title, bodyHtml, testId);
    appRoot.appendChild(overlay);
    activeOverlay = overlay;
  }

  const HOW_TO_USE_HTML = `
    <h2>Three Ways to Play</h2>
    <ul>
      <li><strong>Play directly</strong> by clicking on elements — nodes (for single notes), triangles (for triads), or edges (for tetrachords).</li>
      <li><strong>Type your own progression</strong> into the top field and press play.</li>
      <li><strong>Load from the library</strong> below to play it; click a card title to expand for more info on the progression.</li>
    </ul>
    <p>Drag anywhere to pan the view. Scroll or pinch to zoom in/out. Press and hold to sustain a chord.</p>

    <h2>Chord Duration</h2>
    <p>Each chord plays for one beat. For songs with one chord per bar, each chord represents a whole note (e.g. <code>Am Dm Am E</code>).</p>
    <p>To play two chords in one bar, treat each chord as a half note and double the tempo. For example, <code>|C |Am |Dm |G7 C|</code> would be represented as <code>C C Am Am Dm Dm G7 C</code> and played at twice the tempo.</p>

    <h2>Sharing</h2>
    <p>The app supports sharing/bookmarking any progression by encoding it into a URL, in the form of:</p>
    <p><code>&lt;URL&gt;/#p=Am-C-D-F-Am-C-E-E&amp;t=80</code></p>
    <p>When a progression is loaded, you can generate a link to it using the share button.</p>

    <h2>Supported Chord Reference</h2>
    <p><strong>Directly parsed:</strong> maj, min, dim, aug, 7, m7, maj7, 6, add9, 6/9, dim7, m7b5</p>
    <p><strong>Accepted via input cleaning (aliases):</strong></p>
    <ul>
      <li><code>C9</code>, <code>C+9</code> → <code>Cadd9</code> — 9th chord shorthand</li>
      <li><code>Cø7</code>, <code>Cø</code> → <code>Cm7b5</code> — half-diminished</li>
      <li><code>CΔ7</code>, <code>CΔ</code>, <code>C△7</code>, <code>C△</code> → <code>Cmaj7</code> — triangle symbol</li>
      <li><code>C-7</code>, <code>C-</code> → <code>Cm7</code>, <code>Cm</code> — dash-as-minor</li>
      <li><code>C/E</code> → <code>C</code> — slash bass stripped</li>
      <li><code>C(b9)</code> → <code>C</code> — parenthesized alterations stripped</li>
      <li><code>Csus4</code>, <code>Csus2</code>, <code>Csus</code> → <code>C</code> — sus stripped</li>
      <li><code>Caug7</code> → <code>Caug</code> — aug extension stripped</li>
    </ul>
    <p>Unrecognized symbols are silently stripped — the progression plays with whatever parsed successfully.</p>
    <p><strong>Not supported:</strong> aug extended chords (aug7, augMaj7), 11/13 tensions.</p>

    <h2>Troubleshooting</h2>
    <p><strong>No sound on iPhone/iPad?</strong> Check that the silent mode switch on the side of the device is off (showing no orange).</p>
  `;

  const ABOUT_HTML = `
    <h2>What is a Tonnetz?</h2>
    <p>The Tonnetz (German: "tone network") is a geometric lattice that maps musical pitch classes into a two-dimensional space where spatial proximity represents harmonic relationships.</p>

    <h2>How Harmony Maps to Geometry</h2>
    <p>On the Tonnetz, each node represents a pitch class (C, C#, D, etc.). Adjacent nodes along each axis are related by specific intervals:</p>
    <ul>
      <li><strong>Horizontal axis</strong> — perfect fifths (7 semitones)</li>
      <li><strong>Diagonal axis (up-right)</strong> — major thirds (4 semitones)</li>
      <li><strong>Diagonal axis (up-left)</strong> — minor thirds (3 semitones)</li>
    </ul>
    <p>Major triads form upward-pointing triangles. Minor triads form downward-pointing triangles. Voice-leading between chords corresponds to short geometric distances on the lattice.</p>

    <h2>Voice-Leading as Distance</h2>
    <p>Smooth voice-leading between two chords means the notes move by small intervals — which translates to small geometric steps on the Tonnetz.</p>

    <h2>About Tone Nets</h2>
    <p>Tone Nets is built by The Moving Finger Studios.</p>
  `;

  // ── Mount ──────────────────────────────────────────────────────────

  appRoot.appendChild(backdrop);
  appRoot.appendChild(sidebar);
  appRoot.appendChild(canvasArea);
  root.appendChild(appRoot);

  // ── Button state management ────────────────────────────────────────

  function updateButtonStates(): void {
    const hasText = !!textarea.value.trim();
    const hasContent = progressionLoaded || hasText;
    playBtn.disabled = !playbackRunning && !hasContent;
    loopBtn.disabled = !progressionLoaded;
    shareBtn.disabled = !progressionLoaded;
    clearBtn.disabled = !hasContent;
    tempoField.disabled = !hasContent;
    if (tempoField.disabled) {
      tempoGroup.classList.add("disabled");
    } else {
      tempoGroup.classList.remove("disabled");
    }
    // Play/Stop toggle: swap icon based on state
    if (playbackRunning) {
      playBtn.textContent = "■";
      playBtn.setAttribute("aria-label", "Stop");
    } else {
      playBtn.textContent = "▶";
      playBtn.setAttribute("aria-label", "Play");
    }
  }

  function updateLoopVisual(): void {
    if (loopEnabled) {
      loopBtn.classList.add(C.transportBtnActive);
    } else {
      loopBtn.classList.remove(C.transportBtnActive);
    }
  }

  // ── Sidebar open/close (mobile) ────────────────────────────────────

  function setSidebarOpen(open: boolean): void {
    if (open) {
      sidebar.classList.add(C.sidebarOpen);
      backdrop.classList.add(C.sidebarOpen);
      floatingStrip.classList.remove("visible");
    } else {
      sidebar.classList.remove(C.sidebarOpen);
      backdrop.classList.remove(C.sidebarOpen);
      updateFloatingVisibility();
    }
  }

  function updateFloatingVisibility(): void {
    // Show floating transport when: progression loaded, sidebar closed, mobile
    const sidebarOpen = sidebar.classList.contains(C.sidebarOpen);
    if (progressionLoaded && !sidebarOpen) {
      floatingStrip.classList.add("visible");
    } else {
      floatingStrip.classList.remove("visible");
    }
    // Sync play/stop visibility
    if (playbackRunning) {
      fPlayBtn.style.display = "none";
      fStopBtn.style.display = "flex";
    } else {
      fPlayBtn.style.display = "flex";
      fStopBtn.style.display = "none";
    }
    // Sync loop visual
    fLoopBtn.style.opacity = loopEnabled ? "1" : "0.5";
  }

  // ── Event handlers ─────────────────────────────────────────────────

  function handlePlayStop(): void {
    if (playbackRunning) {
      handleStop();
    } else {
      handlePlay();
    }
  }
  function handlePlay(): void {
    const text = textarea.value.trim();
    if (text) {
      onLoadProgression(text);
    }
    onPlay();
    // Auto-hide sidebar on mobile after pressing Play
    setSidebarOpen(false);
  }
  function handleStop(): void { onStop(); }
  function handleClear(): void { onClear(); }
  function handleShare(): void {
    const url = onShare?.();
    if (!url) return;
    // Copy to clipboard with fallback for non-HTTPS contexts
    function fallbackCopy(text: string): void {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    const copyPromise = navigator.clipboard
      ? navigator.clipboard.writeText(url).catch(() => fallbackCopy(url))
      : Promise.resolve(fallbackCopy(url));
    copyPromise.then(() => {
      // Brief "Copied!" feedback on both sidebar and floating share buttons
      const origShare = shareBtn.innerHTML;
      const origFShare = fShareBtn.innerHTML;
      shareBtn.textContent = "✓";
      fShareBtn.textContent = "✓";
      setTimeout(() => {
        shareBtn.innerHTML = origShare;
        fShareBtn.innerHTML = origFShare;
      }, 1500);
    });
  }
  function handleHowToUse(): void {
    openOverlay("How to Use", HOW_TO_USE_HTML, "overlay-how");
    onHowToUse?.();
  }
  function handleAbout(): void {
    openOverlay("What This Is", ABOUT_HTML, "overlay-about");
    onAbout?.();
  }

  function handleLoopToggle(): void {
    loopEnabled = !loopEnabled;
    updateLoopVisual();
    updateFloatingVisibility();
    onLoopToggle(loopEnabled);
  }

  let playbackMode: "piano" | "pad" = "piano";
  function handlePlaybackModeToggle(): void {
    playbackMode = playbackMode === "piano" ? "pad" : "piano";
    playbackModeBtn.textContent = playbackMode === "piano" ? "Staccato" : "Legato";
    if (onPlaybackModeChange) onPlaybackModeChange(playbackMode);
  }

  function handlePresetChange(): void {
    const selectedName = presetSelect.value;
    const preset = ALL_PRESETS.find((p) => p.name === selectedName);
    if (preset && preset !== currentPreset) {
      currentPreset = preset;
      if (onPresetChange) onPresetChange(preset);
    }
  }

  function handleTempoInput(): void {
    const bpm = clampTempo(Number(tempoField.value));
    onTempoChange(bpm);
  }

  function handleTempoBlur(): void {
    const bpm = clampTempo(Number(tempoField.value));
    tempoField.value = String(bpm);
  }

  function handleHamburger(): void {
    const isOpen = sidebar.classList.contains(C.sidebarOpen);
    setSidebarOpen(!isOpen);
  }

  function handleBackdropClick(): void {
    setSidebarOpen(false);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      // Dismiss overlay first, then sidebar
      if (activeOverlay) {
        activeOverlay.remove();
        activeOverlay = null;
        return;
      }
      if (sidebar.classList.contains(C.sidebarOpen)) {
        setSidebarOpen(false);
      }
    }
  }

  // Textarea: Enter key loads progression (Shift+Enter for newline)
  function handleTextareaKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePlay();
    }
  }

  // ── Attach listeners ───────────────────────────────────────────────

  playBtn.addEventListener("click", handlePlayStop);
  clearBtn.addEventListener("click", handleClear);
  loopBtn.addEventListener("click", handleLoopToggle);
  shareBtn.addEventListener("click", handleShare);
  playbackModeBtn.addEventListener("click", handlePlaybackModeToggle);
  presetSelect.addEventListener("change", handlePresetChange);
  howBtn.addEventListener("click", handleHowToUse);
  aboutBtn.addEventListener("click", handleAbout);
  tempoField.addEventListener("input", handleTempoInput);
  tempoField.addEventListener("blur", handleTempoBlur);
  hamburgerBtn.addEventListener("click", handleHamburger);
  backdrop.addEventListener("click", handleBackdropClick);
  textarea.addEventListener("keydown", handleTextareaKeydown);
  textarea.addEventListener("input", updateButtonStates);
  document.addEventListener("keydown", handleKeydown);

  // Floating transport buttons
  fPlayBtn.addEventListener("click", handlePlay);
  fStopBtn.addEventListener("click", handleStop);
  fLoopBtn.addEventListener("click", handleLoopToggle);
  fShareBtn.addEventListener("click", handleShare);
  fClearBtn.addEventListener("click", handleClear);

  // ── Public interface ───────────────────────────────────────────────

  return {
    getCanvasContainer(): HTMLElement {
      return canvasArea;
    },

    setProgressionLoaded(loaded: boolean): void {
      progressionLoaded = loaded;
      updateButtonStates();
      updateFloatingVisibility();
    },

    setPlaybackRunning(running: boolean): void {
      playbackRunning = running;
      updateButtonStates();
      updateFloatingVisibility();
    },

    setInputText(text: string): void {
      textarea.value = text;
    },


    setTempo(bpm: number): void {
      const clamped = clampTempo(bpm);
      tempoField.value = String(clamped);
    },

    setLoopEnabled(enabled: boolean): void {
      loopEnabled = enabled;
      updateLoopVisual();
    },

    isLoopEnabled(): boolean {
      return loopEnabled;
    },

    setPlaybackMode(mode: "piano" | "pad"): void {
      if (mode !== playbackMode) {
        playbackMode = mode;
        playbackModeBtn.textContent = mode === "piano" ? "Staccato" : "Legato";
        if (onPlaybackModeChange) onPlaybackModeChange(mode);
      }
    },

    getPlaybackMode(): "piano" | "pad" {
      return playbackMode;
    },

    setPreset(preset: SynthPreset): void {
      currentPreset = preset;
      presetSelect.value = preset.name;
    },

    getPreset(): SynthPreset {
      return currentPreset;
    },

    switchToTab(_tab: "play" | "library"): void {
      // No-op — single-panel view, tabs removed
    },

    getLibraryListContainer(): HTMLElement {
      return libraryList;
    },

    open(): void {
      setSidebarOpen(true);
    },

    close(): void {
      setSidebarOpen(false);
    },

    destroy(): void {
      // Remove listeners
      playBtn.removeEventListener("click", handlePlayStop);
      clearBtn.removeEventListener("click", handleClear);
      loopBtn.removeEventListener("click", handleLoopToggle);
      presetSelect.removeEventListener("change", handlePresetChange);
      howBtn.removeEventListener("click", handleHowToUse);
      aboutBtn.removeEventListener("click", handleAbout);
      tempoField.removeEventListener("input", handleTempoInput);
      tempoField.removeEventListener("blur", handleTempoBlur);
      hamburgerBtn.removeEventListener("click", handleHamburger);
      backdrop.removeEventListener("click", handleBackdropClick);
      textarea.removeEventListener("keydown", handleTextareaKeydown);
      document.removeEventListener("keydown", handleKeydown);

      // Remove DOM
      appRoot.remove();
    },
  };
}
