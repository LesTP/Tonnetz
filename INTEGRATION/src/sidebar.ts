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
  /** Callback when path mode toggle changes. */
  onPathModeChange: (mode: "root" | "tonal") => void;
  /** Callback when loop toggle changes. */
  onLoopToggle: (enabled: boolean) => void;
  /** Callback when playback mode toggle changes (piano = hard cut, pad = voice continuation). */
  onPlaybackModeChange?: (mode: "piano" | "pad") => void;
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
  /** Get the current path display mode. */
  getPathMode(): "root" | "tonal";
  /** Set the playback mode (piano/pad). */
  setPlaybackMode(mode: "piano" | "pad"): void;
  /** Get the current playback mode. */
  getPlaybackMode(): "piano" | "pad";
  /** Programmatically switch to a tab. */
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
const BREAKPOINT = 768;

const C = {
  app: "tonnetz-app",
  backdrop: "tonnetz-sidebar-backdrop",
  sidebar: "tonnetz-sidebar",
  sidebarOpen: "tonnetz-sidebar--open",
  header: "tonnetz-sidebar-header",
  titleRow: "tonnetz-sidebar-title-row",
  title: "tonnetz-sidebar-title",
  subtitle: "tonnetz-sidebar-subtitle",
  infoFooter: "tonnetz-sidebar-info-footer",
  infoFooterBtn: "tonnetz-sidebar-info-footer-btn",
  infoFooterBtnLarge: "tonnetz-sidebar-info-footer-btn-lg",
  tabBar: "tonnetz-sidebar-tabs",
  tabBtn: "tonnetz-sidebar-tab-btn",
  tabBtnActive: "tonnetz-sidebar-tab-btn--active",
  tabPanel: "tonnetz-sidebar-tab-panel",
  inputGroup: "tonnetz-sidebar-input-group",
  textarea: "tonnetz-sidebar-textarea",
  transport: "tonnetz-sidebar-transport",
  transportBtn: "tonnetz-sidebar-transport-btn",
  transportBtnActive: "tonnetz-sidebar-transport-btn--active",
  tempoSection: "tonnetz-sidebar-tempo",
  tempoHeader: "tonnetz-sidebar-tempo-header",
  tempoMarking: "tonnetz-sidebar-tempo-marking",
  tempoSlider: "tonnetz-sidebar-tempo-slider",
  tempoLabel: "tonnetz-sidebar-tempo-label",
  pathToggle: "tonnetz-sidebar-path-toggle",
  pathToggleBtn: "tonnetz-sidebar-path-toggle-btn",
  pathToggleBtnActive: "tonnetz-sidebar-path-toggle-btn--active",
  loadBtn: "tonnetz-sidebar-load-btn",
  clearBtn: "tonnetz-sidebar-clear-btn",
  libraryList: "tonnetz-sidebar-library-list",
  canvasArea: "tonnetz-canvas-area",
  hamburger: "tonnetz-hamburger",
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
  width: 300px;
  flex-shrink: 0;
  background: #fafafa;
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
    width: 300px;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: none;
  }
  .${C.sidebar}.${C.sidebarOpen} {
    transform: translateX(0);
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  }
}

/* Header */
.${C.header} {
  flex-shrink: 0;
  padding: 24px 14px 16px;
  text-align: center;
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
  padding: 10px 14px 12px;
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

/* Tab bar */
.${C.tabBar} {
  display: flex;
  border-top: 1px solid #e0e0e0;
  border-bottom: 1px solid #d0d0d0;
  margin-top: 14px;
}

.${C.tabBtn} {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: #777;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}
.${C.tabBtn}:hover {
  color: #333;
}
.${C.tabBtnActive} {
  color: #2a9d8f;
  border-bottom-color: #2a9d8f;
}

/* Tab panels */
.${C.tabPanel} {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

/* Load button */
.${C.loadBtn} {
  align-self: stretch;
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  background: #2a9d8f;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  min-height: 40px;
  transition: background 0.15s;
  letter-spacing: 0.3px;
}
.${C.loadBtn}:hover:not(:disabled) {
  background: #21867a;
}
.${C.loadBtn}:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Transport buttons */
.${C.transport} {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
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

/* Clear button — subtle, red accent on hover */
.${C.clearBtn} {
  min-width: 44px;
  min-height: 44px;
  padding: 0 14px;
  border: 1.5px solid #ddd;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  cursor: pointer;
  color: #999;
  margin-left: auto;
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
  border-color: #e8e8e8;
}

/* Tempo section */
.${C.tempoSection} {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.${C.tempoHeader} {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.${C.tempoMarking} {
  font-size: 13px;
  font-weight: 600;
  font-style: italic;
  color: #444;
}

.${C.tempoSlider} {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #ddd;
  border-radius: 2px;
  outline: none;
}
.${C.tempoSlider}::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2a9d8f;
  cursor: pointer;
}

.${C.tempoLabel} {
  font-size: 12px;
  color: #555;
  white-space: nowrap;
  min-width: 56px;
  text-align: right;
}

/* Path mode toggle */
.${C.pathToggle} {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f0f0f0;
  border-radius: 6px;
  padding: 2px;
}
.${C.pathToggleBtn} {
  flex: 1;
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  background: none;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  color: #888;
  transition: background 0.15s, color 0.15s;
}
.${C.pathToggleBtn}:hover {
  color: #555;
}
.${C.pathToggleBtnActive} {
  background: #fff;
  color: #222;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
    onPathModeChange,
    onLoopToggle,
    onPlaybackModeChange,
    onHowToUse,
    onAbout,
    initialTempo,
  } = options;

  // ── State ──────────────────────────────────────────────────────────

  let progressionLoaded = false;
  let playbackRunning = false;
  let loopEnabled = false;
  let activeTab: "play" | "library" = "play";

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

  // Tab bar
  const tabBar = el("nav", C.tabBar);
  const playTabBtn = el("button", `${C.tabBtn} ${C.tabBtnActive}`, { "data-tab": "play", "data-testid": "tab-play" });
  playTabBtn.textContent = "▶  Play";
  const libraryTabBtn = el("button", C.tabBtn, { "data-tab": "library", "data-testid": "tab-library" });
  libraryTabBtn.innerHTML = `<span style="font-size:1.5em">●</span>  Library`;
  tabBar.appendChild(playTabBtn);
  tabBar.appendChild(libraryTabBtn);

  header.appendChild(titleEl);
  header.appendChild(tabBar);

  // ── Play Tab Panel ─────────────────────────────────────────────────

  const playPanel = el("section", C.tabPanel, { "data-tab": "play", "data-testid": "panel-play" });

  // Progression input
  const inputGroup = el("div", C.inputGroup);
  const inputLabel = el("label");
  inputLabel.textContent = "Progression:";
  const textarea = el("textarea", C.textarea, {
    placeholder: "Enter chords (e.g., Dm7 | G7 | Cmaj7)",
    "data-testid": "progression-input",
  });
  textarea.rows = 3;
  inputGroup.appendChild(inputLabel);
  inputGroup.appendChild(textarea);

  // Transport buttons
  const transportRow = el("div", C.transport);

  const playBtn = el("button", C.transportBtn, { "data-testid": "play-btn", "aria-label": "Play" });
  playBtn.textContent = "▶";
  playBtn.disabled = true;

  const stopBtn = el("button", C.transportBtn, { "data-testid": "stop-btn", "aria-label": "Stop" });
  stopBtn.textContent = "■";
  stopBtn.disabled = true;

  const loopBtn = el("button", C.transportBtn, { "data-testid": "loop-btn", "aria-label": "Loop" });
  loopBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8a6 6 0 0 1 10.5-4"/><path d="M14 8a6 6 0 0 1-10.5 4"/><polyline points="12,1 13,4 10,4.5"/><polyline points="4,15 3,12 6,11.5"/></svg>`;
  loopBtn.disabled = true;

  const clearBtn = el("button", C.clearBtn, { "data-testid": "clear-btn" });
  clearBtn.textContent = "Clear";
  clearBtn.disabled = true;

  transportRow.appendChild(playBtn);
  transportRow.appendChild(stopBtn);
  transportRow.appendChild(loopBtn);
  transportRow.appendChild(clearBtn);

  // Tempo control
  const tempoSection = el("div", C.tempoSection);
  const tempoHeader = el("div", C.tempoHeader);
  const tempoLabel = el("span", C.tempoLabel, { "data-testid": "tempo-label" });
  tempoLabel.textContent = `${clampTempo(initialTempo)} BPM`;
  tempoHeader.appendChild(tempoLabel);

  const tempoSlider = el("input", C.tempoSlider, {
    type: "range",
    min: String(TEMPO_MIN),
    max: String(TEMPO_MAX),
    value: String(clampTempo(initialTempo)),
    "data-testid": "tempo-slider",
    "aria-label": "Tempo",
  });
  tempoSection.appendChild(tempoHeader);
  tempoSection.appendChild(tempoSlider);

  // Path mode toggle (Root Motion vs Tonal Centroid)
  const pathToggle = el("div", C.pathToggle, { "data-testid": "path-toggle" });
  const rootBtn = el("button", `${C.pathToggleBtn} ${C.pathToggleBtnActive}`, { "data-testid": "path-mode-root" });
  rootBtn.textContent = "Root Motion";
  const tonalBtn = el("button", C.pathToggleBtn, { "data-testid": "path-mode-tonal" });
  tonalBtn.textContent = "Tonal Centroid";
  pathToggle.appendChild(rootBtn);
  pathToggle.appendChild(tonalBtn);

  // Playback mode toggle (Staccato / Legato)
  const modeToggle = el("div", C.pathToggle, { "data-testid": "mode-toggle" });
  const pianoBtn = el("button", `${C.pathToggleBtn} ${C.pathToggleBtnActive}`, { "data-testid": "mode-piano" });
  pianoBtn.textContent = "Staccato";
  const padBtn = el("button", C.pathToggleBtn, { "data-testid": "mode-pad" });
  padBtn.textContent = "Legato";
  modeToggle.appendChild(pianoBtn);
  modeToggle.appendChild(padBtn);

  // Assemble play panel
  playPanel.appendChild(inputGroup);
  playPanel.appendChild(transportRow);
  playPanel.appendChild(tempoSection);
  playPanel.appendChild(pathToggle);
  playPanel.appendChild(modeToggle);

  // ── Library Tab Panel ──────────────────────────────────────────────

  const libraryPanel = el("section", `${C.tabPanel} ${C.hidden}`, { "data-tab": "library", "data-testid": "panel-library" });
  const libraryList = el("div", C.libraryList, { "data-testid": "library-list" });
  const libraryPlaceholder = el("div");
  libraryPlaceholder.style.cssText = "text-align:center;color:#999;padding:24px 0;font-size:13px;";
  libraryPlaceholder.textContent = "Library coming soon";
  libraryList.appendChild(libraryPlaceholder);
  libraryPanel.appendChild(libraryList);

  // ── Assemble Sidebar ───────────────────────────────────────────────

  sidebar.appendChild(header);
  sidebar.appendChild(playPanel);
  sidebar.appendChild(libraryPanel);
  sidebar.appendChild(infoFooter);

  // ── Canvas Area ────────────────────────────────────────────────────

  const canvasArea = el("main", C.canvasArea, { "data-testid": "canvas-container" });

  const hamburgerBtn = el("button", C.hamburger, { "data-testid": "hamburger-btn", "aria-label": "Open menu" });
  hamburgerBtn.textContent = "☰";

  canvasArea.appendChild(hamburgerBtn);

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
    <h2>Interacting with the Lattice</h2>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tap any triangle on the lattice to hear a triad. Tap near a shared edge between two triangles to hear a four-note union chord.</p>
    <ul>
      <li><strong>Tap triangle</strong> — play triad (major or minor)</li>
      <li><strong>Tap near edge</strong> — play union chord (4 notes)</li>
      <li><strong>Drag anywhere</strong> — pan the view</li>
      <li><strong>Scroll / pinch</strong> — zoom in/out</li>
      <li><strong>Press and hold</strong> — sustain chord while held</li>
    </ul>

    <h2>Loading a Progression</h2>
    <p>Type or paste chord symbols into the text field and press <strong>▶ Play</strong>.</p>
    <p>Supported formats: <code>Dm7 | G7 | Cmaj7</code> or <code>Dm7 G7 Cmaj7</code></p>
    <p>Each chord plays for one bar (4 beats). Use the tempo slider to control speed.</p>

    <h2>Multiple Chords per Bar</h2>
    <p>To play two chords in one bar, write each chord twice and double the tempo. For example:</p>
    <p><code>Dm7 Dm7 G7 G7 Cmaj7 Cmaj7</code> at 240 BPM sounds the same as <code>Dm7 G7 Cmaj7</code> at 120 BPM — but with two chord changes per bar.</p>

    <h2>Supported Chord Types</h2>
    <p>Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis.</p>
    <ul>
      <li>Triads: <code>C</code>, <code>Cm</code>, <code>Cdim</code>, <code>Caug</code></li>
      <li>7ths: <code>C7</code>, <code>Cmaj7</code>, <code>Cm7</code>, <code>Cdim7</code>, <code>Cm7b5</code></li>
      <li>Extensions: <code>C6</code>, <code>Cadd9</code>, <code>C6/9</code></li>
    </ul>

    <h2>Keyboard Shortcuts</h2>
    <ul>
      <li><code>Space</code> — play / stop</li>
      <li><code>Escape</code> — clear progression</li>
    </ul>

    <h2>Playback Controls</h2>
    <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.</p>
    <ul>
      <li><strong>▶</strong> Play — start progression playback</li>
      <li><strong>■</strong> Stop — stop playback</li>
      <li><strong>🔁</strong> Loop — toggle auto-repeat</li>
      <li><strong>Clear</strong> — dismiss progression and return to exploration</li>
    </ul>
  `;

  const ABOUT_HTML = `
    <h2>What is a Tonnetz?</h2>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. The Tonnetz (German: "tone network") is a geometric lattice that maps musical pitch classes into a two-dimensional space where spatial proximity represents harmonic relationships.</p>
    <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>

    <h2>How Harmony Maps to Geometry</h2>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. On the Tonnetz, each node represents a pitch class (C, C#, D, etc.). Adjacent nodes along each axis are related by specific intervals:</p>
    <ul>
      <li><strong>Horizontal axis</strong> — perfect fifths (7 semitones)</li>
      <li><strong>Diagonal axis (up-right)</strong> — major thirds (4 semitones)</li>
      <li><strong>Diagonal axis (up-left)</strong> — minor thirds (3 semitones)</li>
    </ul>
    <p>Major triads form upward-pointing triangles. Minor triads form downward-pointing triangles. Voice-leading between chords corresponds to short geometric distances on the lattice.</p>

    <h2>Voice-Leading as Distance</h2>
    <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Smooth voice-leading between two chords means the notes move by small intervals — which translates to small geometric steps on the Tonnetz.</p>

    <h2>About Tone Nets</h2>
    <p>Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur. Tone Nets is an interactive harmonic exploration tool built as a web application with zero dependencies.</p>
  `;

  // ── Mount ──────────────────────────────────────────────────────────

  appRoot.appendChild(backdrop);
  appRoot.appendChild(sidebar);
  appRoot.appendChild(canvasArea);
  root.appendChild(appRoot);

  // ── Button state management ────────────────────────────────────────

  function updateButtonStates(): void {
    playBtn.disabled = playbackRunning || (!progressionLoaded && !textarea.value.trim());
    stopBtn.disabled = !playbackRunning;
    loopBtn.disabled = !progressionLoaded;
    clearBtn.disabled = !progressionLoaded;
  }

  function updateLoopVisual(): void {
    if (loopEnabled) {
      loopBtn.classList.add(C.transportBtnActive);
    } else {
      loopBtn.classList.remove(C.transportBtnActive);
    }
  }

  // ── Tab switching ──────────────────────────────────────────────────

  function switchTab(tab: "play" | "library"): void {
    activeTab = tab;
    if (tab === "play") {
      playTabBtn.classList.add(C.tabBtnActive);
      libraryTabBtn.classList.remove(C.tabBtnActive);
      playPanel.classList.remove(C.hidden);
      libraryPanel.classList.add(C.hidden);
    } else {
      libraryTabBtn.classList.add(C.tabBtnActive);
      playTabBtn.classList.remove(C.tabBtnActive);
      libraryPanel.classList.remove(C.hidden);
      playPanel.classList.add(C.hidden);
    }
  }

  // ── Sidebar open/close (mobile) ────────────────────────────────────

  function setSidebarOpen(open: boolean): void {
    if (open) {
      sidebar.classList.add(C.sidebarOpen);
      backdrop.classList.add(C.sidebarOpen);
    } else {
      sidebar.classList.remove(C.sidebarOpen);
      backdrop.classList.remove(C.sidebarOpen);
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────

  function handlePlay(): void {
    const text = textarea.value.trim();
    if (text) {
      onLoadProgression(text);
    }
    onPlay();
  }
  function handleStop(): void { onStop(); }
  function handleClear(): void { onClear(); }
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
    onLoopToggle(loopEnabled);
  }

  let pathMode: "root" | "tonal" = "root";
  function handlePathToggle(mode: "root" | "tonal"): void {
    if (mode === pathMode) return;
    pathMode = mode;
    rootBtn.className = `${C.pathToggleBtn} ${mode === "root" ? C.pathToggleBtnActive : ""}`;
    tonalBtn.className = `${C.pathToggleBtn} ${mode === "tonal" ? C.pathToggleBtnActive : ""}`;
    onPathModeChange(mode);
  }

  let playbackMode: "piano" | "pad" = "piano";
  function handleModeToggle(mode: "piano" | "pad"): void {
    if (mode === playbackMode) return;
    playbackMode = mode;
    pianoBtn.className = `${C.pathToggleBtn} ${mode === "piano" ? C.pathToggleBtnActive : ""}`;
    padBtn.className = `${C.pathToggleBtn} ${mode === "pad" ? C.pathToggleBtnActive : ""}`;
    if (onPlaybackModeChange) onPlaybackModeChange(mode);
  }

  function handleTempoInput(): void {
    const bpm = clampTempo(Number(tempoSlider.value));
    tempoLabel.textContent = `${bpm} BPM`;
    onTempoChange(bpm);
  }

  function handleTabClick(e: Event): void {
    const target = e.currentTarget as HTMLElement;
    const tab = target.getAttribute("data-tab") as "play" | "library" | null;
    if (tab && tab !== activeTab) {
      switchTab(tab);
    }
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

  playBtn.addEventListener("click", handlePlay);
  stopBtn.addEventListener("click", handleStop);
  clearBtn.addEventListener("click", handleClear);
  loopBtn.addEventListener("click", handleLoopToggle);
  rootBtn.addEventListener("click", () => handlePathToggle("root"));
  tonalBtn.addEventListener("click", () => handlePathToggle("tonal"));
  pianoBtn.addEventListener("click", () => handleModeToggle("piano"));
  padBtn.addEventListener("click", () => handleModeToggle("pad"));
  howBtn.addEventListener("click", handleHowToUse);
  aboutBtn.addEventListener("click", handleAbout);
  tempoSlider.addEventListener("input", handleTempoInput);
  playTabBtn.addEventListener("click", handleTabClick);
  libraryTabBtn.addEventListener("click", handleTabClick);
  hamburgerBtn.addEventListener("click", handleHamburger);
  backdrop.addEventListener("click", handleBackdropClick);
  textarea.addEventListener("keydown", handleTextareaKeydown);
  textarea.addEventListener("input", updateButtonStates);
  document.addEventListener("keydown", handleKeydown);

  // ── Public interface ───────────────────────────────────────────────

  return {
    getCanvasContainer(): HTMLElement {
      return canvasArea;
    },

    setProgressionLoaded(loaded: boolean): void {
      progressionLoaded = loaded;
      updateButtonStates();
    },

    setPlaybackRunning(running: boolean): void {
      playbackRunning = running;
      updateButtonStates();
    },

    setInputText(text: string): void {
      textarea.value = text;
    },


    setTempo(bpm: number): void {
      const clamped = clampTempo(bpm);
      tempoSlider.value = String(clamped);
      tempoLabel.textContent = `${clamped} BPM`;
    },

    setLoopEnabled(enabled: boolean): void {
      loopEnabled = enabled;
      updateLoopVisual();
    },

    isLoopEnabled(): boolean {
      return loopEnabled;
    },
    getPathMode(): "root" | "tonal" {
      return pathMode;
    },

    setPlaybackMode(mode: "piano" | "pad"): void {
      handleModeToggle(mode);
    },

    getPlaybackMode(): "piano" | "pad" {
      return playbackMode;
    },

    switchToTab(tab: "play" | "library"): void {
      switchTab(tab);
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
      playBtn.removeEventListener("click", handlePlay);
      stopBtn.removeEventListener("click", handleStop);
      clearBtn.removeEventListener("click", handleClear);
      loopBtn.removeEventListener("click", handleLoopToggle);
      howBtn.removeEventListener("click", handleHowToUse);
      aboutBtn.removeEventListener("click", handleAbout);
      tempoSlider.removeEventListener("input", handleTempoInput);
      playTabBtn.removeEventListener("click", handleTabClick);
      libraryTabBtn.removeEventListener("click", handleTabClick);
      hamburgerBtn.removeEventListener("click", handleHamburger);
      backdrop.removeEventListener("click", handleBackdropClick);
      textarea.removeEventListener("keydown", handleTextareaKeydown);
      document.removeEventListener("keydown", handleKeydown);

      // Remove DOM
      appRoot.remove();
    },
  };
}
