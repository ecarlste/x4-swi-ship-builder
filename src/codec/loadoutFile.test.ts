import { describe, expect, test } from "vitest";
import { exportLoadoutFile, importLoadoutFile } from "./loadoutFile.ts";
import { SAVED_LOADOUTS_KEY, readSavedLoadouts, type LoadoutStorage } from "./savedLoadouts.ts";

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

const escort = {
  format: 1 as const,
  gameData: { swi: "091", x4: "8.00" },
  ship: "ship_xwing",
  slots: { con_weapon_01: "weapon_laser" },
  groups: { group_turrets: { turret: { equipment: "turret_quad", count: 3 } } },
  engine: "engine_fusial",
  thruster: "thruster_s",
  software: ["software_dock"],
  consumables: { missile_proton: 20 },
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

/** A Loadout whose Ship is no longer in the Game Data: still carried unchanged. */
const gone = {
  format: 1 as const,
  gameData: { swi: "080", x4: "7.50" },
  ship: "ship_removed_long_ago",
  id: "11111111-2222-4333-8444-555555555555",
  name: "Old Freighter",
  createdAt: "2025-01-01T10:00:00.000Z",
  updatedAt: "2025-01-01T10:00:00.000Z",
};

const ids = (...list: string[]) => {
  const queue = [...list];
  return () => queue.shift() ?? "00000000-0000-4000-8000-000000000000";
};

const listed = (storage: LoadoutStorage) =>
  readSavedLoadouts(storage).entries.map((e) => (e.status === "ok" ? e.loadout : e));

const file = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts: [escort], ...over });

describe("exporting a Loadout File", () => {
  test("writes the envelope, pretty-printed, with the Loadouts as they are", () => {
    const text = exportLoadoutFile([escort, gone]);

    expect(text).toBe(JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts: [escort, gone] }, null, 2));
  });
});

describe("importing a Loadout File", () => {
  test("round trip: an exported file imported into an empty browser adds every Loadout unchanged", () => {
    const storage = memoryStorage();

    const result = importLoadoutFile(storage, exportLoadoutFile([escort, gone]));

    expect(result).toEqual({ ok: true, added: [escort, gone] });
    expect(listed(storage)).toEqual([escort, gone]);
  });

  test("only adds: stored Saved Loadouts, Unreadable ones included, are kept exactly as they were", () => {
    const storage = memoryStorage([gone, { name: "broken" }]);

    importLoadoutFile(storage, file());

    expect(JSON.parse(storage.raw()!)).toEqual([gone, { name: "broken" }, escort]);
  });

  test("a Loadout whose id clashes with a stored one gets a new id, and both are kept", () => {
    const storage = memoryStorage([escort]);
    const renamed = { ...escort, name: "Escort (theirs)" };

    const result = importLoadoutFile(storage, file({ loadouts: [renamed] }), {
      newId: ids("99999999-8888-4777-8666-555555555555"),
    });

    const theirs = { ...renamed, id: "99999999-8888-4777-8666-555555555555" };
    expect(result).toEqual({ ok: true, added: [theirs] });
    expect(listed(storage)).toEqual([escort, theirs]);
  });

  test("Loadouts sharing an id within one file each get their own", () => {
    const storage = memoryStorage();

    importLoadoutFile(storage, file({ loadouts: [escort, escort] }), {
      newId: ids("99999999-8888-4777-8666-555555555555"),
    });

    expect(listed(storage).map((l) => ("id" in l ? l.id : undefined))).toEqual([
      escort.id,
      "99999999-8888-4777-8666-555555555555",
    ]);
  });
});

describe("Loadout Files and Crew (ADR 0004)", () => {
  const boarding = { ...escort, crew: { service: 2, marines: 3 } };

  test("an exported Loadout's Crew comes back unchanged on import", () => {
    const storage = memoryStorage();

    const result = importLoadoutFile(storage, exportLoadoutFile([boarding, gone]));

    expect(result).toEqual({ ok: true, added: [boarding, gone] });
    expect(listed(storage)).toEqual([boarding, gone]);
  });

  test("the envelope is the same as before Crew", () => {
    expect(Object.keys(JSON.parse(exportLoadoutFile([boarding])))).toEqual(["app", "format", "loadouts"]);
    expect(JSON.parse(exportLoadoutFile([boarding]))).toMatchObject({ app: "x4-swi-ship-builder", format: 1 });
  });

  test("a file from before Crew imports, with no Crew", () => {
    const storage = memoryStorage();

    expect(importLoadoutFile(storage, file())).toEqual({ ok: true, added: [escort] });
  });

  test("a Crew count that isn't a positive integer fails the whole file", () => {
    for (const crew of [{ service: 0 }, { marines: -2 }, { service: 0.5 }]) {
      const storage = memoryStorage();
      expect(importLoadoutFile(storage, file({ loadouts: [escort, { ...boarding, crew }] }))).toEqual({
        ok: false,
        error: expect.stringMatching(/isn't a Loadout File/),
      });
      expect(storage.raw()).toBeNull();
    }
  });
});

describe("rejecting a Loadout File in full", () => {
  const rejects = (text: string, error: RegExp | string) => {
    const storage = memoryStorage([gone]);
    const before = storage.raw();

    const result = importLoadoutFile(storage, text);

    expect(result).toEqual({ ok: false, error: expect.stringMatching(error) });
    expect(storage.raw()).toBe(before);
  };

  test("text that isn't JSON", () => {
    rejects("not json at all", /isn't a Loadout File/);
  });

  test("JSON that isn't this app's envelope", () => {
    rejects(JSON.stringify([escort]), /isn't a Loadout File/);
    rejects(file({ app: "some-other-builder" }), /isn't a Loadout File/);
    rejects(file({ loadouts: "none" }), /isn't a Loadout File/);
  });

  test("one bad Loadout fails the whole file, and the good ones aren't added either", () => {
    rejects(file({ loadouts: [escort, { ...gone, name: "" }] }), /isn't a Loadout File/);
    rejects(file({ loadouts: [escort, { ...gone, id: "not-a-uuid" }] }), /isn't a Loadout File/);
  });

  test("a newer file format, or a newer Loadout format inside it", () => {
    rejects(file({ format: 2 }), "This Loadout File was made by a newer version of the builder.");
    rejects(file({ loadouts: [escort, { ...gone, format: 2 }] }), "This Loadout File was made by a newer version of the builder.");
  });

  test("a file over 5 MB", () => {
    const padding = "x".repeat(5 * 1024 * 1024);
    rejects(file({ loadouts: [{ ...escort, name: padding }] }), /over 5 MB/);
  });

  test("a stored value that isn't a list is left untouched", () => {
    const storage = memoryStorage('{"not":"a list"}');

    const result = importLoadoutFile(storage, file());

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/couldn't be read/) });
    expect(storage.raw()).toBe('{"not":"a list"}');
  });
});

describe("the size cap", () => {
  test("a file of exactly 5 MB is accepted", () => {
    const base = file({ loadouts: [{ ...escort, name: "" }] });
    const name = "x".repeat(5 * 1024 * 1024 - base.length);
    const storage = memoryStorage();

    const result = importLoadoutFile(storage, file({ loadouts: [{ ...escort, name }] }));

    expect(result.ok).toBe(true);
  });
});
