import { describe, expect, test } from "vitest";
import { parseLoadout, parseSavedLoadout } from "./loadout.ts";

const empty = { format: 1, gameData: { swi: "091", x4: "8.00" }, ship: "ship_xwing" };

const full = {
  ...empty,
  slots: { con_weapon_01: "weapon_laser" },
  groups: { group_front: { turret: { equipment: "turret_quad", count: 3 } } },
  engine: "engine_fusial",
  thruster: "thruster_s",
  software: ["software_dock"],
  consumables: { missile_proton: 20 },
  crew: { service: 2, marines: 3 },
};

const saved = {
  ...full,
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-02T10:00:00.000Z",
};

describe("parseLoadout", () => {
  test("accepts an Empty Loadout", () => {
    expect(parseLoadout(empty)).toEqual({ ok: true, loadout: empty });
  });

  test("accepts a Loadout with every kind of entry", () => {
    expect(parseLoadout(full)).toEqual({ ok: true, loadout: full });
  });

  test("rejects a value that isn't a Loadout", () => {
    expect(parseLoadout({ ...empty, ship: 7 }).ok).toBe(false);
    expect(parseLoadout({ ...full, consumables: { missile_proton: -1 } }).ok).toBe(false);
    expect(parseLoadout({ ...full, groups: { g: { turret: { equipment: "t", count: 1.5 } } } }).ok).toBe(false);
    expect(parseLoadout({ ...full, groups: { g: { weapon: { equipment: "t", count: 1 } } } }).ok).toBe(false);
    expect(parseLoadout("nope").ok).toBe(false);
    expect(parseLoadout({ ...empty, gameData: undefined }).ok).toBe(false);
  });

  test("accepts Crew with only one of its counts (ADR 0004)", () => {
    expect(parseLoadout({ ...empty, crew: { marines: 1 } }).ok).toBe(true);
    expect(parseLoadout({ ...empty, crew: { service: 4 } }).ok).toBe(true);
  });

  test("rejects a Crew count that isn't a positive integer", () => {
    expect(parseLoadout({ ...empty, crew: { service: 0 } }).ok).toBe(false);
    expect(parseLoadout({ ...empty, crew: { marines: -1 } }).ok).toBe(false);
    expect(parseLoadout({ ...empty, crew: { service: 1.5 } }).ok).toBe(false);
    expect(parseLoadout({ ...empty, crew: { captain: 1 } }).ok).toBe(false);
  });

  test("rejects engines in a Slot Group: the engine is fitted to the whole Ship (#50)", () => {
    expect(parseLoadout({ ...full, groups: { g: { engine: { equipment: "engine_fusial", count: 2 } } } }).ok).toBe(false);
  });

  test("rejects a newer format as made by a newer version of the builder", () => {
    expect(parseLoadout({ ...full, format: 2, slots: "whatever this format means" })).toEqual({
      ok: false,
      error: "This Loadout was made by a newer version of the builder.",
    });
  });
});

describe("parseSavedLoadout", () => {
  test("accepts a Loadout with its id, name and times", () => {
    expect(parseSavedLoadout(saved)).toEqual({ ok: true, loadout: saved });
  });

  test("rejects a Saved Loadout without a UUID id or a name", () => {
    expect(parseSavedLoadout({ ...saved, id: "1" }).ok).toBe(false);
    expect(parseSavedLoadout({ ...saved, name: undefined }).ok).toBe(false);
    expect(parseSavedLoadout(full).ok).toBe(false);
  });

  test("rejects a newer format as made by a newer version of the builder", () => {
    expect(parseSavedLoadout({ ...saved, format: 3 })).toEqual({
      ok: false,
      error: "This Loadout was made by a newer version of the builder.",
    });
  });
});
