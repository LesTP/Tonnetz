import { describe, it, expect } from "vitest";
import { pc, nodeId, coord, parseNodeId } from "../coords.js";
import type { NodeId } from "../types.js";

describe("pc (pitch class mapping)", () => {
  it("pc(0,0) = 0 (C)", () => {
    expect(pc(0, 0)).toBe(0);
  });

  it("pc(1,0) = 7 (G, fifth above C)", () => {
    expect(pc(1, 0)).toBe(7);
  });

  it("pc(0,1) = 4 (E, major third above C)", () => {
    expect(pc(0, 1)).toBe(4);
  });

  it("pc(1,1) = 11 (B)", () => {
    expect(pc(1, 1)).toBe(11);
  });

  it("pc(-1,0) = 5 (F, fifth below C)", () => {
    expect(pc(-1, 0)).toBe(5);
  });

  it("negative coordinates wrap correctly: pc(-2,-3) = 10", () => {
    // (0 + 7*(-2) + 4*(-3)) mod 12 = (-26) mod 12 = 10
    expect(pc(-2, -3)).toBe(10);
  });

  it("result is always in 0..11", () => {
    for (let u = -10; u <= 10; u++) {
      for (let v = -10; v <= 10; v++) {
        const result = pc(u, v);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(12);
      }
    }
  });
});

describe("nodeId", () => {
  it('nodeId(3, -1) = "N:3,-1"', () => {
    expect(nodeId(3, -1)).toBe("N:3,-1");
  });

  it('nodeId(0, 0) = "N:0,0"', () => {
    expect(nodeId(0, 0)).toBe("N:0,0");
  });

  it("produces branded NodeId type", () => {
    const id: NodeId = nodeId(1, 2);
    // At runtime it's a plain string, usable as Map key
    const map = new Map<NodeId, number>();
    map.set(id, 42);
    expect(map.get(id)).toBe(42);
  });
});

describe("coord", () => {
  it("constructs a NodeCoord with correct fields", () => {
    const c = coord(5, -3);
    expect(c.u).toBe(5);
    expect(c.v).toBe(-3);
  });
});

describe("parseNodeId", () => {
  it("round-trips with nodeId for (0, 0)", () => {
    const id = nodeId(0, 0);
    const parsed = parseNodeId(id);
    expect(parsed.u).toBe(0);
    expect(parsed.v).toBe(0);
  });

  it("round-trips with nodeId for positive coords", () => {
    const id = nodeId(3, 7);
    const parsed = parseNodeId(id);
    expect(parsed.u).toBe(3);
    expect(parsed.v).toBe(7);
  });

  it("round-trips with nodeId for negative coords", () => {
    const id = nodeId(-5, -2);
    const parsed = parseNodeId(id);
    expect(parsed.u).toBe(-5);
    expect(parsed.v).toBe(-2);
  });

  it("parses raw string correctly", () => {
    const parsed = parseNodeId("N:12,34" as NodeId);
    expect(parsed.u).toBe(12);
    expect(parsed.v).toBe(34);
  });
});
