// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createToolbar } from "../toolbar.js";
import type { Toolbar } from "../toolbar.js";

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createToolbar — rendering", () => {
  let container: HTMLElement;
  let toolbar: Toolbar;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    toolbar?.destroy();
    container.remove();
  });

  it("renders into container", () => {
    toolbar = createToolbar({
      container,
      onResetView: vi.fn(),
    });

    expect(container.children.length).toBeGreaterThan(0);
  });

  it("renders Reset View button", () => {
    toolbar = createToolbar({
      container,
      onResetView: vi.fn(),
    });

    const btn = getButton(container, "reset-view-btn");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Reset View");
  });
});

describe("createToolbar — Reset View button", () => {
  let container: HTMLElement;
  let toolbar: Toolbar;
  let onResetView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = makeContainer();
    onResetView = vi.fn();
  });

  afterEach(() => {
    toolbar?.destroy();
    container.remove();
  });

  it("fires onResetView when clicked", () => {
    toolbar = createToolbar({
      container,
      onResetView,
    });

    const btn = getButton(container, "reset-view-btn");
    btn.click();

    expect(onResetView).toHaveBeenCalledTimes(1);
  });

  it("can be clicked multiple times", () => {
    toolbar = createToolbar({
      container,
      onResetView,
    });

    const btn = getButton(container, "reset-view-btn");
    btn.click();
    btn.click();
    btn.click();

    expect(onResetView).toHaveBeenCalledTimes(3);
  });
});

describe("createToolbar — show/hide", () => {
  let container: HTMLElement;
  let toolbar: Toolbar;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    toolbar?.destroy();
    container.remove();
  });

  it("hide() adds hidden class", () => {
    toolbar = createToolbar({
      container,
      onResetView: vi.fn(),
    });

    toolbar.hide();

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("tonnetz-hidden")).toBe(true);
  });

  it("show() removes hidden class", () => {
    toolbar = createToolbar({
      container,
      onResetView: vi.fn(),
    });

    toolbar.hide();
    toolbar.show();

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("tonnetz-tb-hidden")).toBe(false);
  });
});

describe("createToolbar — destroy", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
  });

  it("removes DOM elements", () => {
    const toolbar = createToolbar({
      container,
      onResetView: vi.fn(),
    });

    expect(container.children.length).toBeGreaterThan(0);

    toolbar.destroy();

    expect(container.children.length).toBe(0);
  });

  it("removes event listeners (no errors on click after destroy)", () => {
    const onResetView = vi.fn();
    const toolbar = createToolbar({
      container,
      onResetView,
    });

    const resetBtn = getButton(container, "reset-view-btn");
    toolbar.destroy();

    // Button was removed, so clicking should not throw
    expect(() => resetBtn.click()).not.toThrow();
    expect(onResetView).not.toHaveBeenCalled();
  });
});
