/**
 * The Loadout's lines, through `loadoutLines`, against hand-made Game Data.
 */
import { describe, expect, test } from "vitest";
import {
  engine,
  engineSlot,
  gameData,
  loadout,
  priced,
  shield,
  shieldGroup,
  shieldSlot,
  ship,
  thruster,
} from "./testing/fixtures.ts";
import { loadoutLines } from "./lines.ts";

const at = (average: number) => ({ min: average - 10, average, max: average + 10 });
const big = { ...shield("fx_big", 1, 1, 0), price: at(5000) };
const small = { ...shield("fx_small", 1, 1, 0), price: at(700) };
const drive = {
  ...engine("fx_drive", 1, { thrust: 1, acceleration: 1, duration: 1, recharge: 1 }, { thrust: 1, charge: 1, attack: 0 }),
  price: at(2000),
};
const nimble = { ...thruster("fx_nimble", { strafe: 1, pitch: 1, yaw: 1, roll: 1 }), price: at(400) };
const scanner = priced("software", "fx_scanner", at(300));
const assist = priced("software", "fx_assist", at(0));
const flare = priced("countermeasure", "fx_flare", at(20));

const cruiser = ship({
  price: at(1_000_000),
  slots: [engineSlot("con_engine_01"), { ...shieldSlot("con_shield_01"), mandatory: true }, shieldSlot("con_shield_02")],
  slotGroups: [shieldGroup("front", 3), { id: "back", kinds: { engine: { count: 2, fitList: "fl_any" } } }],
  capacities: { missiles: 0, drones: 0, deployables: 0, countermeasures: 10, crew: 6, cargo: 0 },
  software: { fitList: "fl_software", mandatory: ["fx_assist"] },
  countermeasures: "fl_countermeasures",
});
const data = gameData(
  [cruiser],
  [big, small, drive, nimble, scanner, assist, flare],
  [
    { id: "fl_software", equipment: ["fx_scanner", "fx_assist"] },
    { id: "fl_countermeasures", equipment: ["fx_flare"] },
  ],
);
const fitted = loadout("fx_ship", {
  slots: { con_shield_01: "fx_big" },
  groups: { front: { shield: { equipment: "fx_small", count: 3 } } },
  engine: "fx_drive",
  software: ["fx_scanner"],
  consumables: { fx_flare: 8 },
  crew: { service: 2, marines: 1 },
});

describe("loadoutLines", () => {
  test("gives every Place the Ship offers, empty ones included, in table order after the Chassis", () => {
    expect(loadoutLines(data, cruiser, loadout("fx_ship")).map((l) => l.place)).toEqual([
      null,
      { kind: "engine" },
      { kind: "slot", slot: "con_shield_01" },
      { kind: "slot", slot: "con_shield_02" },
      { kind: "group", group: "front", groupKind: "shield" },
      { kind: "thruster" },
      { kind: "consumable", equipment: "fx_flare" },
      { kind: "software", equipment: "fx_scanner" },
      { kind: "software", equipment: "fx_assist" },
      { kind: "crew", role: "service" },
      { kind: "crew", role: "marines" },
    ]);
  });

  test("each line has its Equipment, its count and its price, the engine once per engine; empty Places cost 0", () => {
    const lines = loadoutLines(data, cruiser, fitted);
    expect(lines.map((l) => [l.equipment?.id ?? null, l.count, l.price.average])).toEqual([
      [null, 1, 1_000_000],
      // 1 engine Slot plus the engine Slot Group's 2, whatever else the Slot Groups hold (ADR 0001).
      ["fx_drive", 3, 6000],
      ["fx_big", 1, 5000],
      [null, 0, 0],
      ["fx_small", 3, 2100],
      [null, 0, 0],
      ["fx_flare", 8, 160],
      ["fx_scanner", 1, 300],
      [null, 0, 0],
      // The Crew at the crew price, 7,500 a head; the Captain is free and has no line (ADR 0004).
      [null, 2, 15_000],
      [null, 1, 7500],
    ]);
  });

  test("the lines, the Chassis included, add up to the Price's min, average and max", () => {
    const total = loadoutLines(data, cruiser, fitted).reduce(
      (sum, l) => ({ min: sum.min + l.price.min, average: sum.average + l.price.average, max: sum.max + l.price.max }),
      { min: 0, average: 0, max: 0 },
    );
    // Each item is ±10 a unit: 1 + 3 + 1 + 3 + 8 + 1 = 17 units, and the Crew is 5,000–10,000 a head.
    expect(total).toEqual({ min: 1_028_390, average: 1_036_060, max: 1_043_730 });
  });

  test("Equipment that isn't in the Game Data gives a line that costs nothing; the engine count still comes from the Ship", () => {
    const lines = loadoutLines(data, cruiser, loadout("fx_ship", { engine: "fx_gone", slots: { con_shield_01: "fx_gone" } }));
    expect(lines[1]).toMatchObject({ equipment: null, count: 3, price: { min: 0, average: 0, max: 0 } });
    expect(lines[2]).toMatchObject({ equipment: null, count: 1, price: { min: 0, average: 0, max: 0 } });
  });

  test("marks the mandatory Places left empty: the engines, Slots tagged mandatory and the thruster", () => {
    const missing = (l: typeof fitted) => loadoutLines(data, cruiser, l).filter((line) => line.missing).map((line) => line.place);
    expect(missing(loadout("fx_ship"))).toEqual([{ kind: "engine" }, { kind: "slot", slot: "con_shield_01" }, { kind: "thruster" }]);
    expect(missing({ ...fitted, thruster: "fx_nimble" })).toEqual([]);
  });

  test("never marks software, whose mandatory families are always fitted (ADR 0006)", () => {
    const lines = loadoutLines(data, cruiser, loadout("fx_ship"));
    expect(lines.filter((line) => line.place?.kind === "software").some((line) => line.missing)).toBe(false);
  });

  test("a Ship with no engines isn't missing any", () => {
    const glider = ship({ software: { fitList: "fl_none", mandatory: [] } });
    const lines = loadoutLines(gameData([glider], [nimble]), glider, loadout("fx_ship", { thruster: "fx_nimble" }));
    expect(lines.map((l) => l.place)).toEqual([null, { kind: "thruster" }]);
    expect(lines.some((l) => l.missing)).toBe(false);
  });

  test("with a Loaded Loadout, a line carries what that Loadout held there, only where it differs", () => {
    const edited = loadout("fx_ship", {
      slots: { con_shield_01: "fx_small", con_shield_02: "fx_big" },
      groups: { front: { shield: { equipment: "fx_small", count: 2 } } },
      engine: "fx_drive",
      consumables: { fx_flare: 5 },
      crew: { marines: 1 },
    });
    const was = loadoutLines(data, cruiser, edited, fitted).map((l) => [l.place?.kind ?? "chassis", l.was]);
    expect(was).toEqual([
      ["chassis", undefined],
      ["engine", undefined],
      ["slot", { equipment: "fx_big", count: 1 }],
      ["slot", null],
      ["group", { equipment: "fx_small", count: 3 }],
      ["thruster", undefined],
      ["consumable", { equipment: "fx_flare", count: 8 }],
      ["software", { equipment: "fx_scanner", count: 1 }],
      ["software", undefined],
      ["crew", { equipment: null, count: 2 }],
      ["crew", undefined],
    ]);
  });

  test("without a Loaded Loadout, no line carries a was value", () => {
    expect(loadoutLines(data, cruiser, fitted).every((l) => !("was" in l))).toBe(true);
  });
});
