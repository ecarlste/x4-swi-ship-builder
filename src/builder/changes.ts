/**
 * Changes since loading (spec #25, decided in #10): the builder keeps a
 * snapshot of the Loadout it opened or last saved, and shows differences
 * only while the current Loadout differs from it.
 */
import type { Loadout } from "./loadout.ts";

/** A key-order-independent form of a Loadout; software is a set, so its order doesn't count. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => {
          const v = (value as Record<string, unknown>)[key];
          return [key, key === "software" && Array.isArray(v) ? [...v].sort() : canonical(v)];
        }),
    );
  }
  return value;
}

/** Whether two Loadouts fit the same things in the same places. */
export function sameLoadout(a: Loadout, b: Loadout): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** The snapshot to compare against, or null when there is none or nothing has changed. */
export function changedSince(snapshot: Loadout | null, loadout: Loadout | null): Loadout | null {
  if (!snapshot || !loadout || snapshot.ship !== loadout.ship) return null;
  return sameLoadout(snapshot, loadout) ? null : snapshot;
}
