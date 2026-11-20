import type { Ship } from "./schema.ts";

/**
 * Where a Ship's engines go: one part per engine Slot (count 1) and one per
 * engine Slot Group (its size). In game they take one engine type between
 * them (ADR 0001), so they must all share one fit list.
 */
export function engineParts(ship: Ship): { count: number; fitList: string }[] {
  return [
    ...ship.slots.filter((s) => s.kind === "engine").map((s) => ({ count: 1, fitList: s.fitList })),
    ...ship.slotGroups.flatMap((g) => (g.kinds.engine ? [g.kinds.engine] : [])),
  ];
}
