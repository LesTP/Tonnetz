/**
 * Tests for keyboard shortcuts (Phase 7c).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createKeyboardShortcuts } from "../keyboard-shortcuts.js";
import type { UIStateController } from "rendering-ui";
import type { UIState } from "rendering-ui";

function mockUIState(initialState: UIState = "idle"): UIStateController {
  let state: UIState = initialState;
  return {
    getState: () => state,
    selectChord: vi.fn(),
    loadProgression: vi.fn(() => {
      state = "progression-loaded";
    }),
    startPlayback: vi.fn(() => {
      state = "playback-running";
    }),
    stopPlayback: vi.fn(() => {
      state = "progression-loaded";
    }),
    clearProgression: vi.fn(() => {
      state = "idle";
    }),
    deselectChord: vi.fn(),
    onChange: vi.fn(() => () => {}),
  } as unknown as UIStateController;
}

function fireKey(key: string): KeyboardEvent {
  const e = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(e);
  return e;
}

describe("createKeyboardShortcuts", () => {
  let onClear: ReturnType<typeof vi.fn>;
  let onPlay: ReturnType<typeof vi.fn>;
  let onStop: ReturnType<typeof vi.fn>;
  let destroy: () => void;

  afterEach(() => {
    destroy?.();
  });

  // ── Escape key ────────────────────────────────────────────────────

  describe("Escape key", () => {
    it("calls onClear when progression-loaded", () => {
      const uiState = mockUIState("progression-loaded");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey("Escape");

      expect(onClear).toHaveBeenCalledOnce();
    });

    it("calls onClear when playback-running", () => {
      const uiState = mockUIState("playback-running");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey("Escape");

      expect(onClear).toHaveBeenCalledOnce();
    });

    it("does nothing when idle", () => {
      const uiState = mockUIState("idle");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey("Escape");

      expect(onClear).not.toHaveBeenCalled();
    });

    it("does nothing when chord-selected", () => {
      const uiState = mockUIState("chord-selected");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey("Escape");

      expect(onClear).not.toHaveBeenCalled();
    });
  });

  // ── Space key ─────────────────────────────────────────────────────

  describe("Space key", () => {
    it("calls onPlay when progression-loaded", () => {
      const uiState = mockUIState("progression-loaded");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey(" ");

      expect(onPlay).toHaveBeenCalledOnce();
      expect(onStop).not.toHaveBeenCalled();
    });

    it("calls onStop when playback-running", () => {
      const uiState = mockUIState("playback-running");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey(" ");

      expect(onStop).toHaveBeenCalledOnce();
      expect(onPlay).not.toHaveBeenCalled();
    });

    it("does nothing when idle", () => {
      const uiState = mockUIState("idle");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey(" ");

      expect(onPlay).not.toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();
    });

    it("does nothing when chord-selected", () => {
      const uiState = mockUIState("chord-selected");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      fireKey(" ");

      expect(onPlay).not.toHaveBeenCalled();
      expect(onStop).not.toHaveBeenCalled();
    });
  });

  // ── Text input suppression ────────────────────────────────────────

  describe("text input suppression", () => {
    it("suppresses Space when textarea is focused", () => {
      const uiState = mockUIState("progression-loaded");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      fireKey(" ");

      expect(onPlay).not.toHaveBeenCalled();

      textarea.remove();
    });

    it("suppresses Escape when input is focused", () => {
      const uiState = mockUIState("progression-loaded");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      fireKey("Escape");

      expect(onClear).not.toHaveBeenCalled();

      input.remove();
    });

    it("suppresses when contentEditable element is focused", () => {
      const uiState = mockUIState("progression-loaded");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      ({ destroy } = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      }));

      const div = document.createElement("div");
      div.contentEditable = "true";
      div.tabIndex = 0;
      document.body.appendChild(div);
      div.focus();

      fireKey(" ");

      expect(onPlay).not.toHaveBeenCalled();

      div.remove();
    });
  });

  // ── Destroy ───────────────────────────────────────────────────────

  describe("destroy", () => {
    it("removes listener after destroy", () => {
      const uiState = mockUIState("progression-loaded");
      onClear = vi.fn();
      onPlay = vi.fn();
      onStop = vi.fn();
      const shortcuts = createKeyboardShortcuts({
        uiState,
        onClear,
        onPlay,
        onStop,
      });
      destroy = shortcuts.destroy;

      shortcuts.destroy();

      fireKey(" ");

      expect(onPlay).not.toHaveBeenCalled();
    });
  });

  // ── Unrecognized keys ─────────────────────────────────────────────

  it("ignores unrecognized keys", () => {
    const uiState = mockUIState("progression-loaded");
    onClear = vi.fn();
    onPlay = vi.fn();
    onStop = vi.fn();
    ({ destroy } = createKeyboardShortcuts({
      uiState,
      onClear,
      onPlay,
      onStop,
    }));

    fireKey("a");
    fireKey("Enter");
    fireKey("Tab");

    expect(onClear).not.toHaveBeenCalled();
    expect(onPlay).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });
});
