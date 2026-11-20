import { describe, expect, test } from "vitest";
import {
  SAVED_LOADOUTS_KEY,
  deleteSavedLoadout,
  readSavedLoadouts,
  saveLoadout,
  type LoadoutStorage,
} from "./savedLoadouts.ts";

/** An in-memory stand-in for localStorage. */
function memoryStorage(initial?: unknown): LoadoutStorage & { raw(): string | null } {
  let value: string | null = initial === undefined ? null : typeof initial === "string" ? initial : JSON.stringify(initial);
  return {
    getItem: (key) => (key === SAVED_LOADOUTS_KEY ? value : null),
    setItem: (key, v) => {
      if (key === SAVED_LOADOUTS_KEY) value = v;
    },
    raw: () => value,
  };
}

const loadout = { format: 1 as const, gameData: { swi: "091", x4: "8.00" }, ship: "ship_xwing" };

const stored = {
  ...loadout,
  slots: { con_weapon_01: "weapon_laser" },
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

const ids = (...list: string[]) => {
  const queue = [...list];
  return () => queue.shift() ?? "00000000-0000-4000-8000-000000000000";
};

describe("reading Saved Loadouts", () => {
  test("nothing stored is an empty list", () => {
    expect(readSavedLoadouts(memoryStorage())).toEqual({ ok: true, entries: [] });
  });

  test("each entry is validated on its own, and a bad one is Unreadable", () => {
    const storage = memoryStorage([stored, { name: "broken" }, { ...stored, format: 2 }]);

    const list = readSavedLoadouts(storage);

    expect(list.ok).toBe(true);
    expect(list.entries).toHaveLength(3);
    expect(list.entries[0]).toEqual({ status: "ok", index: 0, loadout: stored });
    expect(list.entries[1]).toMatchObject({ status: "unreadable", index: 1 });
    expect(list.entries[2]).toEqual({
      status: "unreadable",
      index: 2,
      error: "This Loadout was made by a newer version of the builder.",
    });
  });

  test("a top-level value that isn't an array is an empty list with an error, and is left untouched", () => {
    for (const raw of ['{"not":"a list"}', "not json at all", "42"]) {
      const storage = memoryStorage(raw);

      const list = readSavedLoadouts(storage);

      expect(list.ok).toBe(false);
      expect(list.entries).toEqual([]);
      expect(storage.raw()).toBe(raw);
    }
  });
});

describe("saving a Loadout", () => {
  test("a first save adds it under a name with a new id and times", () => {
    const storage = memoryStorage();
    const now = new Date("2026-11-19T12:00:00.000Z");

    const result = saveLoadout(storage, loadout, { name: "Patrol" }, { now, newId: ids(stored.id) });

    const saved = { ...loadout, id: stored.id, name: "Patrol", createdAt: now.toISOString(), updatedAt: now.toISOString() };
    expect(result).toEqual({ ok: true, saved });
    expect(readSavedLoadouts(storage)).toEqual({ ok: true, entries: [{ status: "ok", index: 0, loadout: saved }] });
  });

  test("saving the opened Saved Loadout again updates it in place", () => {
    const other = { ...stored, id: "11111111-2222-4333-8444-555555555555", name: "Other" };
    const storage = memoryStorage([stored, other]);
    const now = new Date("2026-11-19T12:00:00.000Z");
    const changed = { ...loadout, thruster: "thruster_s" };

    saveLoadout(storage, changed, { id: stored.id, name: stored.name }, { now });

    const list = readSavedLoadouts(storage);
    expect(list.entries.map((e) => e.status === "ok" && e.loadout)).toEqual([
      { ...changed, id: stored.id, name: "Escort", createdAt: stored.createdAt, updatedAt: now.toISOString() },
      other,
    ]);
  });

  test("other stored entries, Unreadable ones included, are kept exactly as they were", () => {
    const unreadable = { name: "broken", extra: [1, 2, 3] };
    const storage = memoryStorage([unreadable, stored]);

    saveLoadout(storage, loadout, { name: "New" });

    const raw = JSON.parse(storage.raw()!);
    expect(raw).toHaveLength(3);
    expect(raw[0]).toEqual(unreadable);
    expect(raw[1]).toEqual(stored);
  });

  test("refuses to save over a top-level value that isn't an array", () => {
    const storage = memoryStorage('{"not":"a list"}');

    const result = saveLoadout(storage, loadout, { name: "Patrol" });

    expect(result.ok).toBe(false);
    expect(storage.raw()).toBe('{"not":"a list"}');
  });
});

describe("deleting a Saved Loadout", () => {
  test("removes an OK entry by its id", () => {
    const other = { ...stored, id: "11111111-2222-4333-8444-555555555555", name: "Other" };
    const storage = memoryStorage([stored, other]);

    deleteSavedLoadout(storage, { status: "ok", index: 0, loadout: stored });

    expect(JSON.parse(storage.raw()!)).toEqual([other]);
  });

  test("removes an Unreadable entry by its place, leaving the rest", () => {
    const storage = memoryStorage([stored, "junk", { ...stored, format: 2 }]);

    const list = readSavedLoadouts(storage);
    deleteSavedLoadout(storage, list.entries[1]!);

    expect(JSON.parse(storage.raw()!)).toEqual([stored, { ...stored, format: 2 }]);
  });
});
