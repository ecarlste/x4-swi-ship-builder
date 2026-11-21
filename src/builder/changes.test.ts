/**
 * Changes since loading, through `sameLoadout` and `changedSince`, against hand-made Game Data.
 */
import { describe, expect, test } from "vitest";
import { gameData, launcher, loadout, missile, priced, ship, weaponSlot } from "../loadout/testing/fixtures.ts";
import { loadoutRules } from "../loadout/rules.ts";
import { changedSince, sameLoadout } from "./changes.ts";

const gunboat = ship({
  slots: [weaponSlot("con_weapon_01")],
  capacities: { missiles: 10, drones: 0, deployables: 0, countermeasures: 0, crew: 4, cargo: 0 },
});
const data = gameData(
  [gunboat, { ...ship(), id: "fx_other" }],
  [
    launcher("weapon", "fx_launcher", "fl_darts"),
    missile("fx_dart", 100, 0, 1),
    priced("software", "fx_scanner", { min: 0, average: 0, max: 0 }),
    priced("software", "fx_assist", { min: 0, average: 0, max: 0 }),
  ],
  [{ id: "fl_darts", equipment: ["fx_dart"] }],
);
const armed = loadout("fx_ship", {
  slots: { con_weapon_01: "fx_launcher" },
  consumables: { fx_dart: 4 },
  software: ["fx_scanner", "fx_assist"],
  crew: { marines: 2 },
});

describe("sameLoadout", () => {
  test("a difference in the Game Data version stamp alone isn't a change", () => {
    expect(sameLoadout(data, armed, { ...armed, gameData: { swi: "090", x4: "7.60" } })).toBe(true);
  });

  test("software is a set: its order isn't a change", () => {
    expect(sameLoadout(data, armed, { ...armed, software: ["fx_assist", "fx_scanner"] })).toBe(true);
  });

  test("a different count or different Equipment at any Place is a change", () => {
    expect(sameLoadout(data, armed, { ...armed, consumables: { fx_dart: 3 } })).toBe(false);
    expect(sameLoadout(data, armed, { ...armed, software: ["fx_scanner"] })).toBe(false);
    expect(sameLoadout(data, armed, { ...armed, crew: { service: 2 } })).toBe(false);
  });

  test("missiles that lost their launcher count as a change, though the Ship no longer offers their Place", () => {
    const rules = loadoutRules(data, gunboat);
    const unarmed = rules.setSlot(armed, "con_weapon_01", null).loadout;
    expect(unarmed.consumables).toBeUndefined();
    expect(sameLoadout(data, armed, unarmed)).toBe(false);
    expect(sameLoadout(data, unarmed, armed)).toBe(false);
    // Fitting the launcher again doesn't bring its missiles back.
    const rearmed = rules.setSlot(unarmed, "con_weapon_01", "fx_launcher").loadout;
    expect(sameLoadout(data, armed, rearmed)).toBe(false);
  });

  test("Loadouts of different Ships aren't the same", () => {
    expect(sameLoadout(data, loadout("fx_ship"), loadout("fx_other"))).toBe(false);
  });
});

describe("changedSince", () => {
  test("gives the Loaded Loadout while the Loadout differs from it, and null once it doesn't", () => {
    const edited = { ...armed, crew: { marines: 3 } };
    expect(changedSince(data, armed, edited)).toBe(armed);
    expect(changedSince(data, armed, { ...armed, gameData: { swi: "090", x4: "7.60" } })).toBeNull();
  });

  test("gives null with no Loaded Loadout, or when the Loadout is of another Ship", () => {
    expect(changedSince(data, null, armed)).toBeNull();
    expect(changedSince(data, armed, null)).toBeNull();
    expect(changedSince(data, armed, loadout("fx_other"))).toBeNull();
  });
});
