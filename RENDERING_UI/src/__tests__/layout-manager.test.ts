// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createLayoutManager } from "../layout-manager.js";
import type { LayoutManager } from "../layout-manager.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoot(): HTMLElement {
  const root = document.createElement("div");
  root.style.width = "1024px";
  root.style.height = "768px";
  document.body.appendChild(root);
  return root;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createLayoutManager — structure creation", () => {
  let root: HTMLElement;
  let layout: LayoutManager;

  beforeEach(() => {
    root = makeRoot();
  });

  afterEach(() => {
    layout?.destroy();
    root.remove();
  });

  it("creates layout structure in root", () => {
    layout = createLayoutManager({ root });

    expect(root.children.length).toBe(1);
    expect(root.firstElementChild?.classList.contains("tonnetz-layout")).toBe(true);
  });

  it("clears existing root content", () => {
    root.innerHTML = "<div>existing content</div>";

    layout = createLayoutManager({ root });

    expect(root.querySelector(".tonnetz-layout")).not.toBeNull();
    expect(root.textContent).not.toContain("existing content");
  });

  it("creates toolbar container", () => {
    layout = createLayoutManager({ root });

    const container = root.querySelector('[data-testid="toolbar-container"]');
    expect(container).not.toBeNull();
  });

  it("creates canvas container", () => {
    layout = createLayoutManager({ root });

    const container = root.querySelector('[data-testid="canvas-container"]');
    expect(container).not.toBeNull();
  });

  it("creates control panel container", () => {
    layout = createLayoutManager({ root });

    const container = root.querySelector('[data-testid="control-panel-container"]');
    expect(container).not.toBeNull();
  });
});

describe("createLayoutManager — container getters", () => {
  let root: HTMLElement;
  let layout: LayoutManager;

  beforeEach(() => {
    root = makeRoot();
  });

  afterEach(() => {
    layout?.destroy();
    root.remove();
  });

  it("getCanvasContainer returns canvas container", () => {
    layout = createLayoutManager({ root });

    const container = layout.getCanvasContainer();
    expect(container.getAttribute("data-testid")).toBe("canvas-container");
  });

  it("getControlPanelContainer returns control panel container", () => {
    layout = createLayoutManager({ root });

    const container = layout.getControlPanelContainer();
    expect(container.getAttribute("data-testid")).toBe("control-panel-container");
  });

  it("getToolbarContainer returns toolbar container", () => {
    layout = createLayoutManager({ root });

    const container = layout.getToolbarContainer();
    expect(container.getAttribute("data-testid")).toBe("toolbar-container");
  });
});

describe("createLayoutManager — control panel toggle", () => {
  let root: HTMLElement;
  let layout: LayoutManager;

  beforeEach(() => {
    root = makeRoot();
  });

  afterEach(() => {
    layout?.destroy();
    root.remove();
  });

  it("control panel is visible by default", () => {
    layout = createLayoutManager({ root });

    expect(layout.isControlPanelVisible()).toBe(true);
  });

  it("toggleControlPanel(false) hides control panel", () => {
    layout = createLayoutManager({ root });

    layout.toggleControlPanel(false);

    const container = layout.getControlPanelContainer();
    expect(container.classList.contains("tonnetz-hidden")).toBe(true);
    expect(layout.isControlPanelVisible()).toBe(false);
  });

  it("toggleControlPanel(true) shows control panel", () => {
    layout = createLayoutManager({ root });

    layout.toggleControlPanel(false);
    layout.toggleControlPanel(true);

    const container = layout.getControlPanelContainer();
    expect(container.classList.contains("tonnetz-layout-hidden")).toBe(false);
    expect(layout.isControlPanelVisible()).toBe(true);
  });
});

describe("createLayoutManager — destroy", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = makeRoot();
  });

  afterEach(() => {
    root.remove();
  });

  it("removes layout structure from root", () => {
    const layout = createLayoutManager({ root });

    expect(root.children.length).toBe(1);

    layout.destroy();

    expect(root.children.length).toBe(0);
  });
});

describe("createLayoutManager — onCanvasResize callback", () => {
  let root: HTMLElement;
  let layout: LayoutManager;

  beforeEach(() => {
    root = makeRoot();
  });

  afterEach(() => {
    layout?.destroy();
    root.remove();
  });

  it("accepts onCanvasResize callback without error", () => {
    const onCanvasResize = vi.fn();

    expect(() => {
      layout = createLayoutManager({ root, onCanvasResize });
    }).not.toThrow();
  });

  // Note: Testing actual ResizeObserver behavior is complex in happy-dom.
  // In a real browser, the callback would fire when canvas size changes.
  // We verify the callback is accepted and the layout manager is created successfully.
});
