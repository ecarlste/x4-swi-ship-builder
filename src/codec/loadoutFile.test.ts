import { describe, expect, test } from "vitest";
import { memoryStorage } from "./testing/memoryStorage.ts";
import { MAX_LOADOUT_FILE_BYTES, exportLoadoutFile, importLoadoutFile } from "./loadoutFile.ts";
import { readSavedLoadouts, type LoadoutStorage } from "./savedLoadouts.ts";

const escort = {
  format: 1 as const,
  gameData: { swi: "091", x4: "800" },
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

/** A picked file holding this text. */
const blob = (text: string) => new Blob([text], { type: "application/json" });

const file = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts: [escort], ...over });

describe("exporting a Loadout File", () => {
  test("writes the envelope, pretty-printed, with the Loadouts as they are", () => {
    const text = exportLoadoutFile([escort, gone]);

    expect(text).toBe(JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts: [escort, gone] }, null, 2));
  });
});

describe("importing a Loadout File", () => {
  test("round trip: an exported file imported into an empty browser adds every Loadout unchanged", async () => {
    const storage = memoryStorage();

    const result = await importLoadoutFile(storage, blob(exportLoadoutFile([escort, gone])));

    expect(result).toEqual({ ok: true, added: [escort, gone] });
    expect(listed(storage)).toEqual([escort, gone]);
  });

  test("only adds: stored Saved Loadouts, Unreadable ones included, are kept exactly as they were", async () => {
    const storage = memoryStorage([gone, { name: "broken" }]);

    await importLoadoutFile(storage, blob(file()));

    expect(JSON.parse(storage.raw()!)).toEqual([gone, { name: "broken" }, escort]);
  });

  test("a Loadout whose id clashes with a stored one gets a new id, and both are kept", async () => {
    const storage = memoryStorage([escort]);
    const renamed = { ...escort, name: "Escort (theirs)" };

    const result = await importLoadoutFile(storage, blob(file({ loadouts: [renamed] })), {
      newId: ids("99999999-8888-4777-8666-555555555555"),
    });

    const theirs = { ...renamed, id: "99999999-8888-4777-8666-555555555555" };
    expect(result).toEqual({ ok: true, added: [theirs] });
    expect(listed(storage)).toEqual([escort, theirs]);
  });

  test("Loadouts sharing an id within one file each get their own", async () => {
    const storage = memoryStorage();

    await importLoadoutFile(storage, blob(file({ loadouts: [escort, escort] })), {
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

  test("an exported Loadout's Crew comes back unchanged on import", async () => {
    const storage = memoryStorage();

    const result = await importLoadoutFile(storage, blob(exportLoadoutFile([boarding, gone])));

    expect(result).toEqual({ ok: true, added: [boarding, gone] });
    expect(listed(storage)).toEqual([boarding, gone]);
  });

  test("the envelope is the same as before Crew", () => {
    expect(Object.keys(JSON.parse(exportLoadoutFile([boarding])))).toEqual(["app", "format", "loadouts"]);
    expect(JSON.parse(exportLoadoutFile([boarding]))).toMatchObject({ app: "x4-swi-ship-builder", format: 1 });
  });

  test("a file from before Crew imports, with no Crew", async () => {
    const storage = memoryStorage();

    expect(await importLoadoutFile(storage, blob(file()))).toEqual({ ok: true, added: [escort] });
  });

  test("a Crew count that isn't a positive integer fails the whole file", async () => {
    for (const crew of [{ service: 0 }, { marines: -2 }, { service: 0.5 }]) {
      const storage = memoryStorage();
      expect(await importLoadoutFile(storage, blob(file({ loadouts: [escort, { ...boarding, crew }] })))).toEqual({
        ok: false,
        error: expect.stringMatching(/isn't a Loadout File/),
      });
      expect(storage.raw()).toBeNull();
    }
  });
});

describe("rejecting a Loadout File in full", () => {
  const rejects = async (text: string, error: RegExp | string) => {
    const storage = memoryStorage([gone]);
    const before = storage.raw();

    const result = await importLoadoutFile(storage, blob(text));

    expect(result).toEqual({ ok: false, error: expect.stringMatching(error) });
    expect(storage.raw()).toBe(before);
  };

  test("text that isn't JSON", async () => {
    await rejects("not json at all", /isn't a Loadout File/);
  });

  test("JSON that isn't this app's envelope", async () => {
    await rejects(JSON.stringify([escort]), /isn't a Loadout File/);
    await rejects(file({ app: "some-other-builder" }), /isn't a Loadout File/);
    await rejects(file({ loadouts: "none" }), /isn't a Loadout File/);
  });

  test("one bad Loadout fails the whole file, and the good ones aren't added either", async () => {
    await rejects(file({ loadouts: [escort, { ...gone, name: "" }] }), /isn't a Loadout File/);
    await rejects(file({ loadouts: [escort, { ...gone, id: "not-a-uuid" }] }), /isn't a Loadout File/);
  });

  test("a newer file format, or a newer Loadout format inside it", async () => {
    await rejects(file({ format: 2 }), "This Loadout File was made by a newer version of the builder.");
    await rejects(file({ loadouts: [escort, { ...gone, format: 2 }] }), "This Loadout File was made by a newer version of the builder.");
  });

  test("a file over 5 MB", async () => {
    const padding = "x".repeat(5 * 1024 * 1024);
    await rejects(file({ loadouts: [{ ...escort, name: padding }] }), /over 5 MB/);
  });

  test("a file over 5 MB is rejected by its size, without being read", async () => {
    const storage = memoryStorage([gone]);
    const unread = {
      size: MAX_LOADOUT_FILE_BYTES + 1,
      text: () => Promise.reject(new Error("read a file over the cap")),
    } as unknown as Blob;

    expect(await importLoadoutFile(storage, unread)).toEqual({ ok: false, error: expect.stringMatching(/over 5 MB/) });
    expect(listed(storage)).toEqual([gone]);
  });

  test("a stored value that isn't a list is left untouched", async () => {
    const storage = memoryStorage('{"not":"a list"}');

    const result = await importLoadoutFile(storage, blob(file()));

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/couldn't be read/) });
    expect(storage.raw()).toBe('{"not":"a list"}');
  });
});

describe("the size cap", () => {
  test("a file of exactly 5 MB is accepted", async () => {
    const base = file({ loadouts: [{ ...escort, name: "" }] });
    const name = "x".repeat(5 * 1024 * 1024 - base.length);
    const storage = memoryStorage();

    const result = await importLoadoutFile(storage, blob(file({ loadouts: [{ ...escort, name }] })));

    expect(result.ok).toBe(true);
  });
});
