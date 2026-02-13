import { describe, it, expect } from "vitest";
import * as HarmonyCore from "../index.js";

describe("Phase 6a: Public API surface", () => {
  // Functions
  it("exports pc", () => {
    expect(typeof HarmonyCore.pc).toBe("function");
  });

  it("exports nodeId", () => {
    expect(typeof HarmonyCore.nodeId).toBe("function");
  });

  it("exports triId", () => {
    expect(typeof HarmonyCore.triId).toBe("function");
  });

  it("exports triVertices", () => {
    expect(typeof HarmonyCore.triVertices).toBe("function");
  });

  it("exports getTrianglePcs", () => {
    expect(typeof HarmonyCore.getTrianglePcs).toBe("function");
  });

  it("exports edgeId", () => {
    expect(typeof HarmonyCore.edgeId).toBe("function");
  });

  it("exports buildWindowIndices", () => {
    expect(typeof HarmonyCore.buildWindowIndices).toBe("function");
  });

  it("exports getAdjacentTriangles", () => {
    expect(typeof HarmonyCore.getAdjacentTriangles).toBe("function");
  });

  it("exports getEdgeUnionPcs", () => {
    expect(typeof HarmonyCore.getEdgeUnionPcs).toBe("function");
  });

  it("exports parseChordSymbol", () => {
    expect(typeof HarmonyCore.parseChordSymbol).toBe("function");
  });

  it("exports computeChordPcs", () => {
    expect(typeof HarmonyCore.computeChordPcs).toBe("function");
  });

  it("exports placeMainTriad", () => {
    expect(typeof HarmonyCore.placeMainTriad).toBe("function");
  });

  it("exports decomposeChordToShape", () => {
    expect(typeof HarmonyCore.decomposeChordToShape).toBe("function");
  });

  it("exports mapProgressionToShapes", () => {
    expect(typeof HarmonyCore.mapProgressionToShapes).toBe("function");
  });

  it("exports exactly 14 functions", () => {
    const fns = Object.entries(HarmonyCore).filter(
      ([, v]) => typeof v === "function",
    );
    expect(fns.length).toBe(14);
  });

  // Encapsulation: internal helpers should NOT be on the barrel export
  it("does not export coord (internal helper)", () => {
    expect("coord" in HarmonyCore).toBe(false);
  });

  it("does not export triEdges (internal helper)", () => {
    expect("triEdges" in HarmonyCore).toBe(false);
  });

  it("does not export triCentroid (internal helper)", () => {
    expect("triCentroid" in HarmonyCore).toBe(false);
  });

  it("does not export dist2 (internal helper)", () => {
    expect("dist2" in HarmonyCore).toBe(false);
  });

  // Return types match ARCH spec
  it("pc returns a number", () => {
    expect(typeof HarmonyCore.pc(0, 0)).toBe("number");
  });

  it("nodeId returns a string (branded NodeId)", () => {
    expect(typeof HarmonyCore.nodeId(0, 0)).toBe("string");
  });

  it("buildWindowIndices returns an object with expected maps", () => {
    const idx = HarmonyCore.buildWindowIndices({
      uMin: 0,
      uMax: 0,
      vMin: 0,
      vMax: 0,
    });
    expect(idx.edgeToTris).toBeInstanceOf(Map);
    expect(idx.nodeToTris).toBeInstanceOf(Map);
    expect(idx.sigToTris).toBeInstanceOf(Map);
    expect(idx.triIdToRef).toBeInstanceOf(Map);
    expect(idx.bounds).toEqual({ uMin: 0, uMax: 0, vMin: 0, vMax: 0 });
  });

  it("parseChordSymbol returns object with root_pc, quality, extension", () => {
    const parsed = HarmonyCore.parseChordSymbol("Am");
    expect(parsed).toHaveProperty("root_pc", 9);
    expect(parsed).toHaveProperty("quality", "min");
    expect(parsed).toHaveProperty("extension", null);
  });
});
