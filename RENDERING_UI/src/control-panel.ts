import { HIDDEN_CLASS, HIDDEN_CSS, injectCSS } from "./css-utils.js";

// --- Types ---

/** Options for creating a control panel. */
export interface ControlPanelOptions {
  /** Container element to render the control panel into. */
  container: HTMLElement;
  /** Callback when user loads a progression (text from input). */
  onLoadProgression: (text: string) => void;
  /** Callback when user clicks Clear button (UX-D5). */
  onClear: () => void;
  /** Callback when user clicks Play button (deferred to Audio Engine). */
  onPlay?: () => void;
  /** Callback when user clicks Stop button (deferred to Audio Engine). */
  onStop?: () => void;
}

/** Control panel interface. */
export interface ControlPanel {
  /** Show the control panel. */
  show(): void;
  /** Hide the control panel. */
  hide(): void;
  /** Update button states based on whether a progression is loaded. */
  setProgressionLoaded(loaded: boolean): void;
  /** Update button states based on whether playback is running. */
  setPlaybackRunning(running: boolean): void;
  /** Get the current progression input text. */
  getInputText(): string;
  /** Set the progression input text. */
  setInputText(text: string): void;
  /** Clean up the control panel. */
  destroy(): void;
}

// --- CSS Class Names ---

const CSS_PREFIX = "tonnetz-cp";
const CSS = {
  root: `${CSS_PREFIX}`,
  inputGroup: `${CSS_PREFIX}-input-group`,
  textarea: `${CSS_PREFIX}-textarea`,
  buttonGroup: `${CSS_PREFIX}-button-group`,
  button: `${CSS_PREFIX}-btn`,
  buttonPrimary: `${CSS_PREFIX}-btn-primary`,
  buttonDanger: `${CSS_PREFIX}-btn-danger`,
  hidden: HIDDEN_CLASS,
} as const;

// --- Inline Styles (MVP — no external CSS) ---

const STYLES = `
.${CSS.root} {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
}

.${CSS.inputGroup} {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.${CSS.textarea} {
  width: 100%;
  min-height: 60px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: inherit;
  resize: vertical;
}

.${CSS.textarea}:focus {
  outline: none;
  border-color: #2a9d8f;
}

.${CSS.buttonGroup} {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.${CSS.button} {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.${CSS.button}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.${CSS.buttonPrimary} {
  background: #2a9d8f;
  color: white;
}

.${CSS.buttonPrimary}:hover:not(:disabled) {
  background: #21867a;
}

.${CSS.buttonDanger} {
  background: #e63946;
  color: white;
}

.${CSS.buttonDanger}:hover:not(:disabled) {
  background: #c5303c;
}

${HIDDEN_CSS}
`;

// --- Style Injection ID ---

const STYLE_ID = "control-panel";

/**
 * Create a control panel component.
 *
 * Provides:
 * - Progression input textarea
 * - Load button (parse and load progression)
 * - Play/Stop buttons (deferred to Audio Engine)
 * - Clear button (UX-D5: dismiss progression)
 */
export function createControlPanel(options: ControlPanelOptions): ControlPanel {
  injectCSS(STYLE_ID, STYLES);

  const { container, onLoadProgression, onClear, onPlay, onStop } = options;

  // Create root element
  const root = document.createElement("div");
  root.className = CSS.root;

  // --- Input group ---
  const inputGroup = document.createElement("div");
  inputGroup.className = CSS.inputGroup;

  const label = document.createElement("label");
  label.textContent = "Progression:";

  const textarea = document.createElement("textarea");
  textarea.className = CSS.textarea;
  textarea.placeholder = "Enter chord progression (e.g., Dm7 | G7 | Cmaj7)";
  textarea.setAttribute("data-testid", "progression-input");

  inputGroup.appendChild(label);
  inputGroup.appendChild(textarea);

  // --- Button group ---
  const buttonGroup = document.createElement("div");
  buttonGroup.className = CSS.buttonGroup;

  const loadBtn = document.createElement("button");
  loadBtn.className = `${CSS.button} ${CSS.buttonPrimary}`;
  loadBtn.textContent = "Load";
  loadBtn.setAttribute("data-testid", "load-btn");

  const playBtn = document.createElement("button");
  playBtn.className = `${CSS.button} ${CSS.buttonPrimary}`;
  playBtn.textContent = "Play";
  playBtn.disabled = true;
  playBtn.setAttribute("data-testid", "play-btn");

  const stopBtn = document.createElement("button");
  stopBtn.className = CSS.button;
  stopBtn.textContent = "Stop";
  stopBtn.disabled = true;
  stopBtn.setAttribute("data-testid", "stop-btn");

  const clearBtn = document.createElement("button");
  clearBtn.className = `${CSS.button} ${CSS.buttonDanger}`;
  clearBtn.textContent = "Clear";
  clearBtn.disabled = true;
  clearBtn.setAttribute("data-testid", "clear-btn");

  buttonGroup.appendChild(loadBtn);
  buttonGroup.appendChild(playBtn);
  buttonGroup.appendChild(stopBtn);
  buttonGroup.appendChild(clearBtn);

  // --- Assemble ---
  root.appendChild(inputGroup);
  root.appendChild(buttonGroup);
  container.appendChild(root);

  // --- Event handlers ---
  function handleLoad(): void {
    const text = textarea.value.trim();
    if (text) {
      onLoadProgression(text);
    }
  }

  function handleClear(): void {
    onClear();
  }

  function handlePlay(): void {
    onPlay?.();
  }

  function handleStop(): void {
    onStop?.();
  }

  loadBtn.addEventListener("click", handleLoad);
  clearBtn.addEventListener("click", handleClear);
  playBtn.addEventListener("click", handlePlay);
  stopBtn.addEventListener("click", handleStop);

  // --- State ---
  let progressionLoaded = false;
  let playbackRunning = false;

  function updateButtonStates(): void {
    clearBtn.disabled = !progressionLoaded;
    playBtn.disabled = !progressionLoaded || playbackRunning;
    stopBtn.disabled = !playbackRunning;
  }

  return {
    show(): void {
      root.classList.remove(CSS.hidden);
    },

    hide(): void {
      root.classList.add(CSS.hidden);
    },

    setProgressionLoaded(loaded: boolean): void {
      progressionLoaded = loaded;
      updateButtonStates();
    },

    setPlaybackRunning(running: boolean): void {
      playbackRunning = running;
      updateButtonStates();
    },

    getInputText(): string {
      return textarea.value;
    },

    setInputText(text: string): void {
      textarea.value = text;
    },

    destroy(): void {
      loadBtn.removeEventListener("click", handleLoad);
      clearBtn.removeEventListener("click", handleClear);
      playBtn.removeEventListener("click", handlePlay);
      stopBtn.removeEventListener("click", handleStop);
      root.remove();
    },
  };
}
