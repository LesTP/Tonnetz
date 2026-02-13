import type { NodeCoord, NodeId } from "./types.js";

const PC0 = 0; // default origin: C

/**
 * Compute pitch class for a lattice node.
 * pc(u,v) = (pc0 + 7*u + 4*v) mod 12
 *
 * Uses safe modulo to handle negative coordinates.
 */
export function pc(u: number, v: number): number {
  return (((PC0 + 7 * u + 4 * v) % 12) + 12) % 12;
}

/**
 * Construct a branded NodeId from coordinates.
 * Format: "N:u,v"
 */
export function nodeId(u: number, v: number): NodeId {
  return `N:${u},${v}` as NodeId;
}

/**
 * Construct a NodeCoord from u, v values.
 */
export function coord(u: number, v: number): NodeCoord {
  return { u, v };
}
