/** An in-memory stand-in for localStorage, for tests of Saved Loadouts and what uses them. */
import { SAVED_LOADOUTS_KEY, type LoadoutStorage } from "../savedLoadouts.ts";

/** Storage holding `initial` (a raw string, or a value stored as JSON) under the Saved Loadouts key. */
export function memoryStorage(initial?: unknown): LoadoutStorage & { raw(): string | null } {
  let value: string | null = initial === undefined ? null : typeof initial === "string" ? initial : JSON.stringify(initial);
  return {
    getItem: (key) => (key === SAVED_LOADOUTS_KEY ? value : null),
    setItem: (key, v) => {
      if (key === SAVED_LOADOUTS_KEY) value = v;
    },
    raw: () => value,
  };
}
