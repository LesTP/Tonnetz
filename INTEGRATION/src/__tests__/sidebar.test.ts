/**
 * Sidebar DOM structure and behavior tests.
 *
 * Phase 1a: Validates sidebar layout, tab switching, button states,
 * mobile hamburger, callbacks, tempo control, and destroy cleanup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSidebar } from "../sidebar.js";
import type { Sidebar, SidebarOptions } from "../sidebar.js";
import { clearInjectedStyles } from "rendering-ui";

// ── Helpers ──────────────────────────────────────────────────────────

function makeRoot(): HTMLElement {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  return root;
}

function defaultOptions(
  root: HTMLElement,
  overrides?: Partial<SidebarOptions>,
): SidebarOptions {
  return {
    root,
    onLoadProgression: vi.fn(),
    onPlay: vi.fn(),
    onStop: vi.fn(),
    onClear: vi.fn(),
    onResetView: vi.fn(),
    onTempoChange: vi.fn(),
    onLoopToggle: vi.fn(),
    initialTempo: 120,
    ...overrides,
  };
}

function q(root: HTMLElement, testId: string): HTMLElement | null {
  return root.querySelector(`[data-testid="${testId}"]`);
}

// ── Tests ────────────────────────────────────────────────────────────

describe("createSidebar", () => {
  let root: HTMLElement;
  let sidebar: Sidebar;
  let opts: SidebarOptions;

  beforeEach(() => {
    clearInjectedStyles();
    root = makeRoot();
    opts = defaultOptions(root);
  });

  afterEach(() => {
    sidebar?.destroy();
    root.remove();
  });

  // ── DOM Structure ──────────────────────────────────────────────────

  describe("DOM structure", () => {
    it("creates the app root with sidebar and canvas area", () => {
      sidebar = createSidebar(opts);
      const appRoot = root.querySelector(".tonnetz-app");
      expect(appRoot).not.toBeNull();

      const sidebarEl = appRoot!.querySelector(".tonnetz-sidebar");
      expect(sidebarEl).not.toBeNull();
      expect(sidebarEl!.tagName).toBe("ASIDE");

      const canvasArea = appRoot!.querySelector(".tonnetz-canvas-area");
      expect(canvasArea).not.toBeNull();
      expect(canvasArea!.tagName).toBe("MAIN");
    });

    it("creates backdrop for mobile overlay", () => {
      sidebar = createSidebar(opts);
      const backdrop = root.querySelector(".tonnetz-sidebar-backdrop");
      expect(backdrop).not.toBeNull();
    });

    it("creates header with title and subtitle", () => {
      sidebar = createSidebar(opts);
      const title = root.querySelector(".tonnetz-sidebar-title");
      expect(title).not.toBeNull();
      expect(title!.textContent).toContain("Tone Nets");

      const subtitle = root.querySelector(".tonnetz-sidebar-subtitle");
      expect(subtitle).not.toBeNull();
      expect(subtitle!.textContent).toBe("an interactive Tonnetz explorer");
    });

    it("creates info buttons (? and ⓘ) as mini triangles", () => {
      sidebar = createSidebar(opts);
      const howBtn = q(root, "how-btn");
      const aboutBtn = q(root, "about-btn");
      expect(howBtn).not.toBeNull();
      expect(howBtn!.querySelector("svg")).not.toBeNull();
      expect(howBtn!.innerHTML).toContain("?");
      expect(aboutBtn).not.toBeNull();
      expect(aboutBtn!.querySelector("svg")).not.toBeNull();
      expect(aboutBtn!.innerHTML).toContain("i");
    });

    it("creates tab bar with Play and Library tabs", () => {
      sidebar = createSidebar(opts);
      const playTab = q(root, "tab-play");
      const libraryTab = q(root, "tab-library");
      expect(playTab).not.toBeNull();
      expect(playTab!.textContent).toBe("▶ Play");
      expect(libraryTab).not.toBeNull();
      expect(libraryTab!.textContent).toBe("📚 Library");
    });

    it("creates chord display with placeholder", () => {
      sidebar = createSidebar(opts);
      const display = q(root, "chord-display");
      expect(display).not.toBeNull();
      expect(display!.textContent).toBe("Tap a triangle to play");
      expect(display!.classList.contains("tonnetz-sidebar-chord-display--placeholder")).toBe(true);
    });

    it("creates progression input textarea and Load button", () => {
      sidebar = createSidebar(opts);
      const textarea = q(root, "progression-input") as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();
      expect(textarea.tagName).toBe("TEXTAREA");

      const loadBtn = q(root, "load-btn");
      expect(loadBtn).not.toBeNull();
      expect(loadBtn!.textContent).toBe("Load");
    });

    it("creates transport buttons (Play, Stop, Loop, Clear)", () => {
      sidebar = createSidebar(opts);
      const playBtn = q(root, "play-btn");
      const stopBtn = q(root, "stop-btn");
      const loopBtn = q(root, "loop-btn");
      const clearBtn = q(root, "clear-btn");

      expect(playBtn!.textContent).toBe("▶");
      expect(stopBtn!.textContent).toBe("■");
      expect(loopBtn!.textContent).toBe("⟳");
      expect(clearBtn!.textContent).toBe("Clear");
    });

    it("creates tempo slider with initial value", () => {
      sidebar = createSidebar({ ...opts, initialTempo: 140 });
      const slider = q(root, "tempo-slider") as HTMLInputElement;
      const label = q(root, "tempo-label");

      expect(slider).not.toBeNull();
      expect(slider.value).toBe("140");
      expect(slider.min).toBe("40");
      expect(slider.max).toBe("240");
      expect(label!.textContent).toBe("140 BPM");
    });

    it("creates hamburger button in canvas area", () => {
      sidebar = createSidebar(opts);
      const hamburger = q(root, "hamburger-btn");
      expect(hamburger).not.toBeNull();
      expect(hamburger!.textContent).toBe("☰");
    });

    it("creates Reset View button in sidebar (bottom)", () => {
      sidebar = createSidebar(opts);
      const resetBtn = q(root, "reset-view-btn");
      expect(resetBtn).not.toBeNull();
      expect(resetBtn!.textContent).toBe("Reset View");
      // Verify it's inside the sidebar, not the canvas area
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;
      expect(sidebarEl.contains(resetBtn!)).toBe(true);
    });

    it("creates library panel with placeholder", () => {
      sidebar = createSidebar(opts);
      const libraryPanel = q(root, "panel-library");
      expect(libraryPanel).not.toBeNull();
      expect(libraryPanel!.textContent).toContain("Library coming soon");
    });

    it("getCanvasContainer() returns the canvas area element", () => {
      sidebar = createSidebar(opts);
      const canvas = sidebar.getCanvasContainer();
      expect(canvas.classList.contains("tonnetz-canvas-area")).toBe(true);
      expect(canvas.getAttribute("data-testid")).toBe("canvas-container");
    });

    it("getLibraryListContainer() returns the library list element", () => {
      sidebar = createSidebar(opts);
      const list = sidebar.getLibraryListContainer();
      expect(list.getAttribute("data-testid")).toBe("library-list");
    });
  });

  // ── Tab Switching ──────────────────────────────────────────────────

  describe("tab switching", () => {
    it("Play tab is active by default, Library panel hidden", () => {
      sidebar = createSidebar(opts);
      const playPanel = q(root, "panel-play")!;
      const libraryPanel = q(root, "panel-library")!;
      const playTab = q(root, "tab-play")!;
      const libraryTab = q(root, "tab-library")!;

      expect(playPanel.classList.contains("tonnetz-hidden")).toBe(false);
      expect(libraryPanel.classList.contains("tonnetz-hidden")).toBe(true);
      expect(playTab.classList.contains("tonnetz-sidebar-tab-btn--active")).toBe(true);
      expect(libraryTab.classList.contains("tonnetz-sidebar-tab-btn--active")).toBe(false);
    });

    it("clicking Library tab shows library panel, hides play panel", () => {
      sidebar = createSidebar(opts);
      const libraryTab = q(root, "tab-library")!;
      libraryTab.click();

      const playPanel = q(root, "panel-play")!;
      const libraryPanel = q(root, "panel-library")!;
      expect(playPanel.classList.contains("tonnetz-hidden")).toBe(true);
      expect(libraryPanel.classList.contains("tonnetz-hidden")).toBe(false);
    });

    it("clicking Play tab restores play panel", () => {
      sidebar = createSidebar(opts);
      q(root, "tab-library")!.click();
      q(root, "tab-play")!.click();

      const playPanel = q(root, "panel-play")!;
      expect(playPanel.classList.contains("tonnetz-hidden")).toBe(false);
    });

    it("switchToTab() programmatically switches tabs", () => {
      sidebar = createSidebar(opts);
      sidebar.switchToTab("library");

      const libraryPanel = q(root, "panel-library")!;
      expect(libraryPanel.classList.contains("tonnetz-hidden")).toBe(false);

      sidebar.switchToTab("play");
      const playPanel = q(root, "panel-play")!;
      expect(playPanel.classList.contains("tonnetz-hidden")).toBe(false);
    });

    it("clicking active tab is a no-op", () => {
      sidebar = createSidebar(opts);
      q(root, "tab-play")!.click(); // Already active

      const playPanel = q(root, "panel-play")!;
      expect(playPanel.classList.contains("tonnetz-hidden")).toBe(false);
    });
  });

  // ── Button States ──────────────────────────────────────────────────

  describe("button states", () => {
    it("Play/Stop/Loop/Clear all disabled initially", () => {
      sidebar = createSidebar(opts);
      expect((q(root, "play-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "stop-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "loop-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "clear-btn") as HTMLButtonElement).disabled).toBe(true);
    });

    it("setProgressionLoaded(true) enables Play, Loop, Clear; Stop stays disabled", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);

      expect((q(root, "play-btn") as HTMLButtonElement).disabled).toBe(false);
      expect((q(root, "stop-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "loop-btn") as HTMLButtonElement).disabled).toBe(false);
      expect((q(root, "clear-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    it("setPlaybackRunning(true) disables Play, enables Stop", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      sidebar.setPlaybackRunning(true);

      expect((q(root, "play-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "stop-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    it("setPlaybackRunning(false) re-enables Play, disables Stop", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      sidebar.setPlaybackRunning(true);
      sidebar.setPlaybackRunning(false);

      expect((q(root, "play-btn") as HTMLButtonElement).disabled).toBe(false);
      expect((q(root, "stop-btn") as HTMLButtonElement).disabled).toBe(true);
    });

    it("setProgressionLoaded(false) disables all transport buttons", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      sidebar.setProgressionLoaded(false);

      expect((q(root, "play-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "loop-btn") as HTMLButtonElement).disabled).toBe(true);
      expect((q(root, "clear-btn") as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ── Callbacks ──────────────────────────────────────────────────────

  describe("callbacks", () => {
    it("Load button fires onLoadProgression with textarea content", () => {
      sidebar = createSidebar(opts);
      const textarea = q(root, "progression-input") as HTMLTextAreaElement;
      textarea.value = "Dm7 | G7 | Cmaj7";
      q(root, "load-btn")!.click();

      expect(opts.onLoadProgression).toHaveBeenCalledWith("Dm7 | G7 | Cmaj7");
    });

    it("Load button does not fire for empty textarea", () => {
      sidebar = createSidebar(opts);
      const textarea = q(root, "progression-input") as HTMLTextAreaElement;
      textarea.value = "   ";
      q(root, "load-btn")!.click();

      expect(opts.onLoadProgression).not.toHaveBeenCalled();
    });

    it("Enter key in textarea fires onLoadProgression", () => {
      sidebar = createSidebar(opts);
      const textarea = q(root, "progression-input") as HTMLTextAreaElement;
      textarea.value = "Am F C G";
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(opts.onLoadProgression).toHaveBeenCalledWith("Am F C G");
    });

    it("Shift+Enter in textarea does NOT fire onLoadProgression", () => {
      sidebar = createSidebar(opts);
      const textarea = q(root, "progression-input") as HTMLTextAreaElement;
      textarea.value = "Am F C G";
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));

      expect(opts.onLoadProgression).not.toHaveBeenCalled();
    });

    it("Play button fires onPlay", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      q(root, "play-btn")!.click();
      expect(opts.onPlay).toHaveBeenCalled();
    });

    it("Stop button fires onStop", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      sidebar.setPlaybackRunning(true);
      q(root, "stop-btn")!.click();
      expect(opts.onStop).toHaveBeenCalled();
    });

    it("Clear button fires onClear", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      q(root, "clear-btn")!.click();
      expect(opts.onClear).toHaveBeenCalled();
    });

    it("Reset View button fires onResetView", () => {
      sidebar = createSidebar(opts);
      q(root, "reset-view-btn")!.click();
      expect(opts.onResetView).toHaveBeenCalled();
    });

    it("How to Use button fires onHowToUse", () => {
      const onHowToUse = vi.fn();
      sidebar = createSidebar({ ...opts, onHowToUse });
      q(root, "how-btn")!.click();
      expect(onHowToUse).toHaveBeenCalled();
    });

    it("About button fires onAbout", () => {
      const onAbout = vi.fn();
      sidebar = createSidebar({ ...opts, onAbout });
      q(root, "about-btn")!.click();
      expect(onAbout).toHaveBeenCalled();
    });
  });

  // ── Loop Toggle ────────────────────────────────────────────────────

  describe("loop toggle", () => {
    it("Loop button toggles and fires onLoopToggle", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      const loopBtn = q(root, "loop-btn")!;

      loopBtn.click();
      expect(opts.onLoopToggle).toHaveBeenCalledWith(true);
      expect(loopBtn.classList.contains("tonnetz-sidebar-transport-btn--active")).toBe(true);
      expect(sidebar.isLoopEnabled()).toBe(true);

      loopBtn.click();
      expect(opts.onLoopToggle).toHaveBeenCalledWith(false);
      expect(loopBtn.classList.contains("tonnetz-sidebar-transport-btn--active")).toBe(false);
      expect(sidebar.isLoopEnabled()).toBe(false);
    });

    it("setLoopEnabled() programmatically sets loop state", () => {
      sidebar = createSidebar(opts);
      sidebar.setProgressionLoaded(true);
      sidebar.setLoopEnabled(true);

      const loopBtn = q(root, "loop-btn")!;
      expect(loopBtn.classList.contains("tonnetz-sidebar-transport-btn--active")).toBe(true);
      expect(sidebar.isLoopEnabled()).toBe(true);

      sidebar.setLoopEnabled(false);
      expect(loopBtn.classList.contains("tonnetz-sidebar-transport-btn--active")).toBe(false);
    });
  });

  // ── Tempo Control ──────────────────────────────────────────────────

  describe("tempo control", () => {
    it("tempo slider fires onTempoChange on input", () => {
      sidebar = createSidebar(opts);
      const slider = q(root, "tempo-slider") as HTMLInputElement;
      slider.value = "160";
      slider.dispatchEvent(new Event("input", { bubbles: true }));

      expect(opts.onTempoChange).toHaveBeenCalledWith(160);
      expect(q(root, "tempo-label")!.textContent).toBe("160 BPM");
    });

    it("setTempo() updates slider and label", () => {
      sidebar = createSidebar(opts);
      sidebar.setTempo(88);

      const slider = q(root, "tempo-slider") as HTMLInputElement;
      expect(slider.value).toBe("88");
      expect(q(root, "tempo-label")!.textContent).toBe("88 BPM");
    });

    it("tempo is clamped to 40–240 range", () => {
      sidebar = createSidebar({ ...opts, initialTempo: 10 });
      const slider = q(root, "tempo-slider") as HTMLInputElement;
      expect(slider.value).toBe("40");

      sidebar.setTempo(999);
      expect(slider.value).toBe("240");
      expect(q(root, "tempo-label")!.textContent).toBe("240 BPM");
    });

    it("shows tempo marking that updates with BPM", () => {
      sidebar = createSidebar({ ...opts, initialTempo: 120 });
      const marking = q(root, "tempo-marking")!;
      expect(marking.textContent).toBe("Allegro");

      sidebar.setTempo(50);
      expect(marking.textContent).toBe("Largo");

      sidebar.setTempo(66);
      expect(marking.textContent).toBe("Adagio");

      sidebar.setTempo(90);
      expect(marking.textContent).toBe("Andante");

      sidebar.setTempo(110);
      expect(marking.textContent).toBe("Moderato");

      sidebar.setTempo(170);
      expect(marking.textContent).toBe("Vivace");

      sidebar.setTempo(180);
      expect(marking.textContent).toBe("Presto");

      sidebar.setTempo(220);
      expect(marking.textContent).toBe("Prestissimo");
    });

    it("tempo marking updates on slider input", () => {
      sidebar = createSidebar(opts);
      const slider = q(root, "tempo-slider") as HTMLInputElement;
      const marking = q(root, "tempo-marking")!;

      slider.value = "55";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      expect(marking.textContent).toBe("Largo");

      slider.value = "140";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      expect(marking.textContent).toBe("Allegro");
    });
  });

  // ── Chord Display ──────────────────────────────────────────────────

  describe("chord display", () => {
    it("setActiveChord() shows chord name", () => {
      sidebar = createSidebar(opts);
      sidebar.setActiveChord("Am7");

      const display = q(root, "chord-display")!;
      expect(display.textContent).toBe("Am7");
      expect(display.classList.contains("tonnetz-sidebar-chord-display--placeholder")).toBe(false);
    });

    it("setActiveChord(null) restores placeholder", () => {
      sidebar = createSidebar(opts);
      sidebar.setActiveChord("Dm");
      sidebar.setActiveChord(null);

      const display = q(root, "chord-display")!;
      expect(display.textContent).toBe("Tap a triangle to play");
      expect(display.classList.contains("tonnetz-sidebar-chord-display--placeholder")).toBe(true);
    });
  });

  // ── Mobile Hamburger ───────────────────────────────────────────────

  describe("mobile hamburger", () => {
    it("hamburger button toggles sidebar open class", () => {
      sidebar = createSidebar(opts);
      const hamburger = q(root, "hamburger-btn")!;
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;

      hamburger.click();
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(true);

      hamburger.click();
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(false);
    });

    it("backdrop click closes sidebar", () => {
      sidebar = createSidebar(opts);
      const hamburger = q(root, "hamburger-btn")!;
      const backdrop = root.querySelector(".tonnetz-sidebar-backdrop")!;
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;

      hamburger.click(); // open
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(true);

      (backdrop as HTMLElement).click(); // close via backdrop
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(false);
    });

    it("Escape key closes sidebar", () => {
      sidebar = createSidebar(opts);
      const hamburger = q(root, "hamburger-btn")!;
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;

      hamburger.click(); // open
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(false);
    });

    it("Escape does nothing when sidebar is already closed", () => {
      sidebar = createSidebar(opts);
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(false);
    });

    it("open() and close() work programmatically", () => {
      sidebar = createSidebar(opts);
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;

      sidebar.open();
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(true);

      sidebar.close();
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(false);
    });
  });

  // ── Info Overlays ───────────────────────────────────────────────────

  describe("info overlays", () => {
    it("? button opens How to Use overlay", () => {
      sidebar = createSidebar(opts);
      q(root, "how-btn")!.click();
      const overlay = q(root, "overlay-how");
      expect(overlay).not.toBeNull();
      expect(overlay!.textContent).toContain("How to Use");
      expect(overlay!.textContent).toContain("Tap triangle");
    });

    it("ⓘ button opens What This Is overlay", () => {
      sidebar = createSidebar(opts);
      q(root, "about-btn")!.click();
      const overlay = q(root, "overlay-about");
      expect(overlay).not.toBeNull();
      expect(overlay!.textContent).toContain("What is a Tonnetz");
    });

    it("close button dismisses overlay", () => {
      sidebar = createSidebar(opts);
      q(root, "how-btn")!.click();
      expect(q(root, "overlay-how")).not.toBeNull();

      const closeBtn = root.querySelector("[aria-label='Close']") as HTMLElement;
      closeBtn.click();
      expect(q(root, "overlay-how")).toBeNull();
    });

    it("backdrop click dismisses overlay", () => {
      sidebar = createSidebar(opts);
      q(root, "how-btn")!.click();
      const backdrop = root.querySelector(".tonnetz-overlay-backdrop") as HTMLElement;
      backdrop.click();
      expect(q(root, "overlay-how")).toBeNull();
    });

    it("Escape key dismisses overlay", () => {
      sidebar = createSidebar(opts);
      q(root, "how-btn")!.click();
      expect(q(root, "overlay-how")).not.toBeNull();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(q(root, "overlay-how")).toBeNull();
    });

    it("only one overlay open at a time", () => {
      sidebar = createSidebar(opts);
      q(root, "how-btn")!.click();
      expect(q(root, "overlay-how")).not.toBeNull();

      q(root, "about-btn")!.click();
      expect(q(root, "overlay-how")).toBeNull();
      expect(q(root, "overlay-about")).not.toBeNull();
    });

    it("Escape dismisses overlay before sidebar", () => {
      sidebar = createSidebar(opts);
      const sidebarEl = root.querySelector(".tonnetz-sidebar")!;

      // Open sidebar (mobile)
      q(root, "hamburger-btn")!.click();
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(true);

      // Open overlay
      q(root, "how-btn")!.click();
      expect(q(root, "overlay-how")).not.toBeNull();

      // First Escape closes overlay, sidebar stays open
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(q(root, "overlay-how")).toBeNull();
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(true);

      // Second Escape closes sidebar
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(sidebarEl.classList.contains("tonnetz-sidebar--open")).toBe(false);
    });
  });

  // ── Destroy ────────────────────────────────────────────────────────

  describe("destroy", () => {
    it("removes all DOM elements from root", () => {
      sidebar = createSidebar(opts);
      expect(root.querySelector(".tonnetz-app")).not.toBeNull();

      sidebar.destroy();
      expect(root.querySelector(".tonnetz-app")).toBeNull();

      // Prevent afterEach from double-destroying
      sidebar = null as unknown as Sidebar;
    });

    it("removes document-level keydown listener", () => {
      sidebar = createSidebar(opts);
      sidebar.destroy();

      // Open shouldn't work after destroy
      const sidebarEl = root.querySelector(".tonnetz-sidebar");
      expect(sidebarEl).toBeNull();

      sidebar = null as unknown as Sidebar;
    });
  });
});
