// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Shape, Chord, TriRef } from "harmony-core";
import {
  createUIStateController,
} from "../ui-state.js";
import type {
  UIStateController,
  UIState,
  UIStateChangeEvent,
} from "../ui-state.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChord(rootPc: number): Chord {
  return {
    root_pc: rootPc,
    quality: "maj",
    extension: null,
    chord_pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12],
    main_triad_pcs: [rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12] as [number, number, number],
  };
}

function makeShape(rootPc: number = 0): Shape {
  const tri: TriRef = { orientation: "U", anchor: { u: 0, v: 0 } };
  return {
    chord: makeChord(rootPc),
    main_tri: tri,
    ext_tris: [],
    dot_pcs: [],
    covered_pcs: new Set([rootPc, (rootPc + 4) % 12, (rootPc + 7) % 12]),
    root_vertex_index: 0,
    centroid_uv: { u: 0.33, v: 0.33 },
  };
}

function makeProgression(): Shape[] {
  return [
    makeShape(2),  // Dm
    makeShape(7),  // G
    makeShape(0),  // C
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createUIStateController — initial state", () => {
  it("starts in idle state", () => {
    const controller = createUIStateController();
    expect(controller.getState()).toBe("idle");
  });

  it("has no selected shape initially", () => {
    const controller = createUIStateController();
    expect(controller.getSelectedShape()).toBeNull();
  });

  it("has no progression initially", () => {
    const controller = createUIStateController();
    expect(controller.getProgression()).toBeNull();
  });
});

describe("createUIStateController — selectChord", () => {
  let controller: UIStateController;

  beforeEach(() => {
    controller = createUIStateController();
  });

  it("transitions idle → chord-selected", () => {
    const shape = makeShape();
    controller.selectChord(shape);
    expect(controller.getState()).toBe("chord-selected");
  });

  it("stores selected shape", () => {
    const shape = makeShape(5);
    controller.selectChord(shape);
    expect(controller.getSelectedShape()).toBe(shape);
  });

  it("allows re-selection in chord-selected state", () => {
    const shape1 = makeShape(0);
    const shape2 = makeShape(7);

    controller.selectChord(shape1);
    expect(controller.getSelectedShape()).toBe(shape1);

    controller.selectChord(shape2);
    expect(controller.getState()).toBe("chord-selected");
    expect(controller.getSelectedShape()).toBe(shape2);
  });

  it("transitions progression-loaded → chord-selected (POL-D28)", () => {
    const progression = makeProgression();
    controller.loadProgression(progression);
    expect(controller.getState()).toBe("progression-loaded");

    const shape = makeShape();
    controller.selectChord(shape);
    expect(controller.getState()).toBe("chord-selected");
    expect(controller.getSelectedShape()).toBe(shape);
  });

  it("is ignored in playback-running state", () => {
    const progression = makeProgression();
    controller.loadProgression(progression);
    controller.startPlayback();
    expect(controller.getState()).toBe("playback-running");

    const shape = makeShape();
    controller.selectChord(shape);
    expect(controller.getState()).toBe("playback-running");
  });
});

describe("createUIStateController — clearSelection", () => {
  let controller: UIStateController;

  beforeEach(() => {
    controller = createUIStateController();
  });

  it("transitions chord-selected → idle", () => {
    controller.selectChord(makeShape());
    expect(controller.getState()).toBe("chord-selected");

    controller.clearSelection();
    expect(controller.getState()).toBe("idle");
  });

  it("clears selected shape", () => {
    controller.selectChord(makeShape());
    controller.clearSelection();
    expect(controller.getSelectedShape()).toBeNull();
  });

  it("is no-op from idle state", () => {
    controller.clearSelection();
    expect(controller.getState()).toBe("idle");
  });

  it("is no-op from progression-loaded state", () => {
    controller.loadProgression(makeProgression());
    controller.clearSelection();
    expect(controller.getState()).toBe("progression-loaded");
  });
});

describe("createUIStateController — loadProgression", () => {
  let controller: UIStateController;

  beforeEach(() => {
    controller = createUIStateController();
  });

  it("transitions idle → progression-loaded", () => {
    controller.loadProgression(makeProgression());
    expect(controller.getState()).toBe("progression-loaded");
  });

  it("transitions chord-selected → progression-loaded", () => {
    controller.selectChord(makeShape());
    controller.loadProgression(makeProgression());
    expect(controller.getState()).toBe("progression-loaded");
  });

  it("stores progression shapes", () => {
    const progression = makeProgression();
    controller.loadProgression(progression);
    expect(controller.getProgression()).toBe(progression);
  });

  it("clears selected shape when loading progression", () => {
    controller.selectChord(makeShape());
    controller.loadProgression(makeProgression());
    expect(controller.getSelectedShape()).toBeNull();
  });

  it("ignores empty progression", () => {
    controller.loadProgression([]);
    expect(controller.getState()).toBe("idle");
    expect(controller.getProgression()).toBeNull();
  });

  it("is ignored in playback-running state", () => {
    controller.loadProgression(makeProgression());
    controller.startPlayback();
    const newProgression = [makeShape(5)];
    controller.loadProgression(newProgression);
    expect(controller.getState()).toBe("playback-running");
  });
});

describe("createUIStateController — clearProgression (UX-D5)", () => {
  let controller: UIStateController;

  beforeEach(() => {
    controller = createUIStateController();
  });

  it("transitions progression-loaded → idle", () => {
    controller.loadProgression(makeProgression());
    controller.clearProgression();
    expect(controller.getState()).toBe("idle");
  });

  it("clears progression data", () => {
    controller.loadProgression(makeProgression());
    controller.clearProgression();
    expect(controller.getProgression()).toBeNull();
  });

  it("is no-op from idle state", () => {
    controller.clearProgression();
    expect(controller.getState()).toBe("idle");
  });

  it("is no-op from chord-selected state", () => {
    controller.selectChord(makeShape());
    controller.clearProgression();
    expect(controller.getState()).toBe("chord-selected");
  });

  it("is no-op from playback-running state", () => {
    controller.loadProgression(makeProgression());
    controller.startPlayback();
    controller.clearProgression();
    expect(controller.getState()).toBe("playback-running");
  });
});

describe("createUIStateController — playback (deferred)", () => {
  let controller: UIStateController;

  beforeEach(() => {
    controller = createUIStateController();
  });

  it("startPlayback transitions progression-loaded → playback-running", () => {
    controller.loadProgression(makeProgression());
    controller.startPlayback();
    expect(controller.getState()).toBe("playback-running");
  });

  it("stopPlayback transitions playback-running → progression-loaded", () => {
    controller.loadProgression(makeProgression());
    controller.startPlayback();
    controller.stopPlayback();
    expect(controller.getState()).toBe("progression-loaded");
  });

  it("startPlayback is no-op from idle", () => {
    controller.startPlayback();
    expect(controller.getState()).toBe("idle");
  });

  it("stopPlayback is no-op from progression-loaded", () => {
    controller.loadProgression(makeProgression());
    controller.stopPlayback();
    expect(controller.getState()).toBe("progression-loaded");
  });

  it("progression is preserved through playback cycle", () => {
    const progression = makeProgression();
    controller.loadProgression(progression);
    controller.startPlayback();
    controller.stopPlayback();
    expect(controller.getProgression()).toBe(progression);
  });
});

describe("createUIStateController — onStateChange", () => {
  let controller: UIStateController;

  beforeEach(() => {
    controller = createUIStateController();
  });

  it("fires callback on state change", () => {
    const callback = vi.fn();
    controller.onStateChange(callback);

    controller.selectChord(makeShape());

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("provides correct event data", () => {
    const callback = vi.fn();
    controller.onStateChange(callback);

    const shape = makeShape(5);
    controller.selectChord(shape);

    const event: UIStateChangeEvent = callback.mock.calls[0][0];
    expect(event.state).toBe("chord-selected");
    expect(event.prevState).toBe("idle");
    expect(event.selectedShape).toBe(shape);
    expect(event.progression).toBeNull();
  });

  it("fires for each transition", () => {
    const callback = vi.fn();
    controller.onStateChange(callback);

    controller.selectChord(makeShape());
    controller.loadProgression(makeProgression());
    controller.startPlayback();
    controller.stopPlayback();
    controller.clearProgression();

    expect(callback).toHaveBeenCalledTimes(5);
  });

  it("fires on re-selection in chord-selected", () => {
    const callback = vi.fn();
    controller.onStateChange(callback);

    controller.selectChord(makeShape(0));
    controller.selectChord(makeShape(7));

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("returns unsubscribe function", () => {
    const callback = vi.fn();
    const unsubscribe = controller.onStateChange(callback);

    controller.selectChord(makeShape());
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    controller.clearSelection();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("supports multiple listeners", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    controller.onStateChange(callback1);
    controller.onStateChange(callback2);

    controller.selectChord(makeShape());

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});

describe("createUIStateController — destroy", () => {
  it("clears all listeners", () => {
    const controller = createUIStateController();
    const callback = vi.fn();
    controller.onStateChange(callback);

    controller.destroy();
    controller.selectChord(makeShape());

    expect(callback).not.toHaveBeenCalled();
  });

  it("clears internal data", () => {
    const controller = createUIStateController();
    controller.selectChord(makeShape());

    controller.destroy();

    expect(controller.getSelectedShape()).toBeNull();
    expect(controller.getProgression()).toBeNull();
  });
});
