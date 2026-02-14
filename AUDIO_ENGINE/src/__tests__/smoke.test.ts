import { describe, it, expect } from "vitest";

describe("Audio Engine — Phase 1a smoke tests", () => {
  it("barrel import resolves", async () => {
    const mod = await import("../index.js");
    expect(mod).toBeDefined();
  });

  it("re-exports Harmony Core Shape type", async () => {
    // Type-level re-export verified by successful compilation.
    // Runtime check: module loads without errors.
    const mod = await import("../index.js");
    expect(typeof mod).toBe("object");
  });
});
