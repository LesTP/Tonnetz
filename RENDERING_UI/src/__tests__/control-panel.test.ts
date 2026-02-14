// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createControlPanel } from "../control-panel.js";
import type { ControlPanel, ControlPanelOptions } from "../control-panel.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

function getButton(container: HTMLElement, testId: string): HTMLButtonElement {
  return container.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  return container.querySelector(`[data-testid="progression-input"]`) as HTMLTextAreaElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createControlPanel — rendering", () => {
  let container: HTMLElement;
  let panel: ControlPanel;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    panel?.destroy();
    container.remove();
  });

  it("renders into container", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    expect(container.children.length).toBeGreaterThan(0);
  });

  it("renders progression textarea", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    const textarea = getTextarea(container);
    expect(textarea).not.toBeNull();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("renders Load button", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    const btn = getButton(container, "load-btn");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Load");
  });

  it("renders Play button (disabled by default)", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    const btn = getButton(container, "play-btn");
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });

  it("renders Stop button (disabled by default)", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    const btn = getButton(container, "stop-btn");
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });

  it("renders Clear button (disabled by default)", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    const btn = getButton(container, "clear-btn");
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });
});

describe("createControlPanel — input handling", () => {
  let container: HTMLElement;
  let panel: ControlPanel;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    panel?.destroy();
    container.remove();
  });

  it("getInputText returns textarea value", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    const textarea = getTextarea(container);
    textarea.value = "Dm7 | G7 | Cmaj7";

    expect(panel.getInputText()).toBe("Dm7 | G7 | Cmaj7");
  });

  it("setInputText sets textarea value", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    panel.setInputText("Am | F | C | G");

    const textarea = getTextarea(container);
    expect(textarea.value).toBe("Am | F | C | G");
  });
});

describe("createControlPanel — Load button", () => {
  let container: HTMLElement;
  let panel: ControlPanel;
  let onLoadProgression: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = makeContainer();
    onLoadProgression = vi.fn();
  });

  afterEach(() => {
    panel?.destroy();
    container.remove();
  });

  it("fires onLoadProgression with input text", () => {
    panel = createControlPanel({
      container,
      onLoadProgression,
      onClear: vi.fn(),
    });

    const textarea = getTextarea(container);
    textarea.value = "Dm7 | G7 | Cmaj7";

    const btn = getButton(container, "load-btn");
    btn.click();

    expect(onLoadProgression).toHaveBeenCalledWith("Dm7 | G7 | Cmaj7");
  });

  it("trims input text before calling callback", () => {
    panel = createControlPanel({
      container,
      onLoadProgression,
      onClear: vi.fn(),
    });

    const textarea = getTextarea(container);
    textarea.value = "  Dm7 | G7  ";

    const btn = getButton(container, "load-btn");
    btn.click();

    expect(onLoadProgression).toHaveBeenCalledWith("Dm7 | G7");
  });

  it("does not fire callback if input is empty", () => {
    panel = createControlPanel({
      container,
      onLoadProgression,
      onClear: vi.fn(),
    });

    const textarea = getTextarea(container);
    textarea.value = "   ";

    const btn = getButton(container, "load-btn");
    btn.click();

    expect(onLoadProgression).not.toHaveBeenCalled();
  });
});

describe("createControlPanel — Clear button (UX-D5)", () => {
  let container: HTMLElement;
  let panel: ControlPanel;
  let onClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = makeContainer();
    onClear = vi.fn();
  });

  afterEach(() => {
    panel?.destroy();
    container.remove();
  });

  it("fires onClear when clicked", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear,
    });

    panel.setProgressionLoaded(true);

    const btn = getButton(container, "clear-btn");
    btn.click();

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("is disabled when no progression loaded", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear,
    });

    const btn = getButton(container, "clear-btn");
    expect(btn.disabled).toBe(true);
  });

  it("is enabled when progression loaded", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear,
    });

    panel.setProgressionLoaded(true);

    const btn = getButton(container, "clear-btn");
    expect(btn.disabled).toBe(false);
  });

  it("is disabled again after setProgressionLoaded(false)", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear,
    });

    panel.setProgressionLoaded(true);
    panel.setProgressionLoaded(false);

    const btn = getButton(container, "clear-btn");
    expect(btn.disabled).toBe(true);
  });
});

describe("createControlPanel — Play/Stop buttons", () => {
  let container: HTMLElement;
  let panel: ControlPanel;
  let onPlay: ReturnType<typeof vi.fn>;
  let onStop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = makeContainer();
    onPlay = vi.fn();
    onStop = vi.fn();
  });

  afterEach(() => {
    panel?.destroy();
    container.remove();
  });

  it("Play is enabled when progression loaded", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay,
      onStop,
    });

    panel.setProgressionLoaded(true);

    const btn = getButton(container, "play-btn");
    expect(btn.disabled).toBe(false);
  });

  it("Play is disabled during playback", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay,
      onStop,
    });

    panel.setProgressionLoaded(true);
    panel.setPlaybackRunning(true);

    const btn = getButton(container, "play-btn");
    expect(btn.disabled).toBe(true);
  });

  it("Stop is enabled during playback", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay,
      onStop,
    });

    panel.setProgressionLoaded(true);
    panel.setPlaybackRunning(true);

    const btn = getButton(container, "stop-btn");
    expect(btn.disabled).toBe(false);
  });

  it("Stop is disabled when not playing", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay,
      onStop,
    });

    panel.setProgressionLoaded(true);

    const btn = getButton(container, "stop-btn");
    expect(btn.disabled).toBe(true);
  });

  it("fires onPlay when Play clicked", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay,
      onStop,
    });

    panel.setProgressionLoaded(true);

    const btn = getButton(container, "play-btn");
    btn.click();

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("fires onStop when Stop clicked", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
      onPlay,
      onStop,
    });

    panel.setProgressionLoaded(true);
    panel.setPlaybackRunning(true);

    const btn = getButton(container, "stop-btn");
    btn.click();

    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("createControlPanel — show/hide", () => {
  let container: HTMLElement;
  let panel: ControlPanel;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    panel?.destroy();
    container.remove();
  });

  it("hide() adds hidden class", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    panel.hide();

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("tonnetz-hidden")).toBe(true);
  });

  it("show() removes hidden class", () => {
    panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    panel.hide();
    panel.show();

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("tonnetz-cp-hidden")).toBe(false);
  });
});

describe("createControlPanel — destroy", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
  });

  it("removes DOM elements", () => {
    const panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear: vi.fn(),
    });

    expect(container.children.length).toBeGreaterThan(0);

    panel.destroy();

    expect(container.children.length).toBe(0);
  });

  it("removes event listeners (no errors on click after destroy)", () => {
    const onClear = vi.fn();
    const panel = createControlPanel({
      container,
      onLoadProgression: vi.fn(),
      onClear,
    });

    const clearBtn = getButton(container, "clear-btn");
    panel.destroy();

    // Button was removed, so clicking should not throw
    expect(() => clearBtn.click()).not.toThrow();
    expect(onClear).not.toHaveBeenCalled();
  });
});
