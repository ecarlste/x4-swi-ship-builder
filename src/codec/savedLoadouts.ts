/**
 * Saved Loadouts in the browser (spec #25, decided in #24): one array under
 * the localStorage key `swi-builder:saved-loadouts:v1`.
 *
 * Each stored entry is validated on its own, so one damaged entry never hides
 * the rest: it's listed as Unreadable and can only be deleted. If the
 * top-level value isn't an array, the list is empty with an error, and the
 * value is left untouched. Storage is never wiped automatically, and entries
 * a write doesn't touch are written back exactly as they were read.
 */
import type { Loadout } from "../loadout/loadout.ts";
import { parseSavedLoadout, type SavedLoadout } from "./loadout.ts";

export const SAVED_LOADOUTS_KEY = "swi-builder:saved-loadouts:v1";

/** The part of the Storage interface Saved Loadouts use. */
export type LoadoutStorage = Pick<Storage, "getItem" | "setItem">;

/** One stored entry, by its place in the stored array. */
export type SavedLoadoutEntry =
  | { status: "ok"; index: number; loadout: SavedLoadout }
  | { status: "unreadable"; index: number; error: string };

export type SavedLoadoutList =
  | { ok: true; entries: SavedLoadoutEntry[] }
  | { ok: false; error: string; entries: [] };

const NOT_A_LIST_ERROR =
  "Your Saved Loadouts couldn't be read: the stored value isn't a list. It has been left as it is.";

/** The stored array as raw values, or an error if the stored value isn't one. */
function readRaw(storage: LoadoutStorage): { ok: true; raw: unknown[] } | { ok: false; error: string } {
  const text = storage.getItem(SAVED_LOADOUTS_KEY);
  if (text === null) return { ok: true, raw: [] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_LIST_ERROR };
  }
  return Array.isArray(value) ? { ok: true, raw: value } : { ok: false, error: NOT_A_LIST_ERROR };
}

function writeRaw(storage: LoadoutStorage, raw: unknown[]) {
  storage.setItem(SAVED_LOADOUTS_KEY, JSON.stringify(raw));
}

const idOf = (value: unknown) => {
  const result = parseSavedLoadout(value);
  return result.ok ? result.loadout.id : undefined;
};

/** Lists the Saved Loadouts, each one OK or Unreadable. */
export function readSavedLoadouts(storage: LoadoutStorage): SavedLoadoutList {
  const read = readRaw(storage);
  if (!read.ok) return { ok: false, error: read.error, entries: [] };
  return {
    ok: true,
    entries: read.raw.map((value, index): SavedLoadoutEntry => {
      const result = parseSavedLoadout(value);
      return result.ok
        ? { status: "ok", index, loadout: result.loadout }
        : { status: "unreadable", index, error: result.error };
    }),
  };
}

/** A Loadout's name, with the id of the Saved Loadout it is, if it is one. */
export interface LoadoutName {
  id?: string;
  name: string;
}

/**
 * Saves a Loadout under a name. Without an id it's added as a new Saved
 * Loadout; with the id of a stored one, that one is updated in place.
 */
export function saveLoadout(
  storage: LoadoutStorage,
  loadout: Loadout,
  target: LoadoutName,
  { now = new Date(), newId = () => crypto.randomUUID() }: { now?: Date; newId?: () => string } = {},
): { ok: true; saved: SavedLoadout } | { ok: false; error: string } {
  const read = readRaw(storage);
  if (!read.ok) return read;

  const at = now.toISOString();
  const index = target.id === undefined ? -1 : read.raw.findIndex((value) => idOf(value) === target.id);
  const existing = index >= 0 ? parseSavedLoadout(read.raw[index]) : undefined;
  const saved: SavedLoadout = {
    ...loadout,
    id: target.id ?? newId(),
    name: target.name,
    createdAt: existing?.ok ? existing.loadout.createdAt : at,
    updatedAt: at,
  };

  const raw = [...read.raw];
  if (index >= 0) raw[index] = saved;
  else raw.push(saved);
  writeRaw(storage, raw);
  return { ok: true, saved };
}

/**
 * Adds Saved Loadouts after the stored ones, as they are, without touching
 * the rest. One whose id clashes with a stored one (or an earlier one added
 * here) gets a new id, so both copies are kept.
 */
export function addSavedLoadouts(
  storage: LoadoutStorage,
  loadouts: SavedLoadout[],
  { newId = () => crypto.randomUUID() }: { newId?: () => string } = {},
): { ok: true; added: SavedLoadout[] } | { ok: false; error: string } {
  const read = readRaw(storage);
  if (!read.ok) return read;

  const taken = new Set(read.raw.map(idOf).filter((id) => id !== undefined));
  const added = loadouts.map((loadout) => {
    let id = loadout.id;
    while (taken.has(id)) id = newId();
    taken.add(id);
    return id === loadout.id ? loadout : { ...loadout, id };
  });
  writeRaw(storage, [...read.raw, ...added]);
  return { ok: true, added };
}

/** Deletes one Saved Loadout: an OK one by its id, an Unreadable one by its place. */
export function deleteSavedLoadout(storage: LoadoutStorage, entry: SavedLoadoutEntry) {
  const read = readRaw(storage);
  if (!read.ok) return;
  const raw =
    entry.status === "ok"
      ? read.raw.filter((value) => idOf(value) !== entry.loadout.id)
      : read.raw.filter((_, i) => i !== entry.index);
  writeRaw(storage, raw);
}
