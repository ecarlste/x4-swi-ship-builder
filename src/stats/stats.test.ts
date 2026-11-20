import { describe, expect, test } from "vitest";
import { loadoutStats, type StatRow } from "./stats.ts";
import { gameData, loadout, priced, shield, shieldGroup, shieldSlot, ship } from "./testing/fixtures.ts";

/** The row for one of the game's `UILoadoutStatistics5` fields. */
function row(rows: StatRow[], id: string): StatRow {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`no ${id} row`);
  return found;
}

describe("survivability", () => {
  test("Hull is the Ship's hull@max", () => {
    const data = gameData([ship({ stats: { ...ship().stats, hull: 8500 } })]);
    const stats = loadoutStats(data, loadout("fx_ship"));
    expect(row(stats.rows, "HullValue")).toMatchObject({ value: 8500, shown: 8500 });
  });

  // YT-1300 (#12): six S shield Slots, generators as (capacity, rate, delay).
  const yt1300 = ship({ slots: [1, 2, 3, 4, 5, 6].map((n) => shieldSlot(`con_shield_0${n}`)) });
  const yt1300Shields = [
    shield("cec", 2695, 100, 18),
    shield("gnk", 3000, 40, 0),
    shield("r4", 300, 25, 0),
    shield("novaldex", 2291, 40, 8),
  ];
  const fitted = (...ids: string[]) =>
    loadout("fx_ship", { slots: Object.fromEntries(ids.map((id, i) => [`con_shield_0${i + 1}`, id])) });

  test("Shield and recharge rate sum the Slots' generators; delay is their plain average (YT-1300: 12.00)", () => {
    const stats = loadoutStats(gameData([yt1300], yt1300Shields), fitted("cec", "cec", "cec", "cec", "gnk", "r4"));
    expect(row(stats.rows, "ShieldValue").shown).toBe(14080);
    expect(row(stats.rows, "ShieldRate").shown).toBe(465);
    expect(row(stats.rows, "ShieldDelay")).toMatchObject({ decimals: 2, shown: 12 });
  });

  test("mixed shield delays average to 8.66, rounded down (YT-1300 with Novaldex)", () => {
    const stats = loadoutStats(
      gameData([yt1300], yt1300Shields),
      fitted("novaldex", "novaldex", "gnk", "r4", "cec", "cec"),
    );
    expect(row(stats.rows, "ShieldValue").shown).toBe(13272);
    expect(row(stats.rows, "ShieldRate").shown).toBe(345);
    expect(row(stats.rows, "ShieldDelay").value).toBeCloseTo(8.6667, 4);
    expect(row(stats.rows, "ShieldDelay").shown).toBe(8.66);
  });

  test("the X-wing's two CEC and one R4 average to 12.00", () => {
    const stats = loadoutStats(gameData([yt1300], yt1300Shields), fitted("cec", "cec", "r4"));
    expect(row(stats.rows, "ShieldValue").shown).toBe(5690);
    expect(row(stats.rows, "ShieldRate").shown).toBe(225);
    expect(row(stats.rows, "ShieldDelay").shown).toBe(12);
  });

  // Class 546 Cruiser (#12, #22): two L shield Slots and eight shield Slot Groups.
  const cruiser = ship({
    size: "l",
    slots: [shieldSlot("con_shield_l_01"), shieldSlot("con_shield_l_02")],
    slotGroups: [
      shieldGroup("engine", 2),
      shieldGroup("main", 2),
      shieldGroup("left-pd", 2),
      shieldGroup("top-tb", 1),
      shieldGroup("right-pd", 2),
      shieldGroup("left-tb", 2),
      shieldGroup("mid-pd", 1),
      shieldGroup("right-tb", 2),
    ],
  });
  const cruiserShields = [
    shield("palisade", 533665, 410, 0),
    shield("ga30", 35613, 98, 0),
    shield("cec500", 41897, 78, 0),
  ];

  test("group shields don't feed the main row (546 Cruiser: 1,067,330 / 820)", () => {
    const stats = loadoutStats(
      gameData([cruiser], cruiserShields),
      loadout("fx_ship", {
        slots: { con_shield_l_01: "palisade", con_shield_l_02: "palisade" },
        groups: { main: { shield: { equipment: "ga30", count: 2 } } },
      }),
    );
    expect(row(stats.rows, "ShieldValue").shown).toBe(1067330);
    expect(row(stats.rows, "ShieldRate").shown).toBe(820);
  });

  test("Avg. Group Shield sums each fitted group, then averages over fitted groups (59,703 / 127)", () => {
    const stats = loadoutStats(
      gameData([cruiser], cruiserShields),
      loadout("fx_ship", {
        groups: {
          "mid-pd": { shield: { equipment: "ga30", count: 1 } },
          engine: { shield: { equipment: "cec500", count: 2 } },
        },
      }),
    );
    expect(row(stats.rows, "ShieldValue").shown).toBe(0);
    expect(row(stats.rows, "GroupedShieldValue").shown).toBe(59703);
    expect(row(stats.rows, "GroupedShieldRate").shown).toBe(127);
    expect(row(stats.rows, "GroupedShieldDelay").shown).toBe(0);
  });

  test("Avg. Group Shield delay is the per-group average of the fitted generators' delays", () => {
    const data = gameData([cruiser], [shield("slow", 100, 10, 9), shield("quick", 100, 10, 2)]);
    const stats = loadoutStats(
      data,
      loadout("fx_ship", {
        groups: {
          engine: { shield: { equipment: "slow", count: 2 } },
          main: { shield: { equipment: "quick", count: 1 } },
        },
      }),
    );
    expect(row(stats.rows, "GroupedShieldDelay").shown).toBe(5.5);
  });
});

describe("capacities", () => {
  const freighter = ship({
    stats: { ...ship().stats, radarRange: 40000 },
    capacities: { missiles: 6, drones: 12, deployables: 5, countermeasures: 8, crew: 4, cargo: 6200 },
  });
  const stats = loadoutStats(gameData([freighter]), loadout("fx_ship"));

  test("Crew is people@capacity plus the pilot (YT-1300: 4 + 1 = 5)", () => {
    expect(row(stats.rows, "CrewCapacity")).toMatchObject({ label: "Crew", shown: 5 });
  });

  test("radar range is shown in km", () => {
    expect(row(stats.rows, "RadarRange")).toMatchObject({ label: "Radar Range", unit: "km", shown: 40 });
  });

  test("missile, drone, deployable and countermeasure capacities and cargo come from the Ship", () => {
    expect(row(stats.rows, "MissileCapacity")).toMatchObject({ label: "Missiles", shown: 6 });
    expect(row(stats.rows, "UnitCapacity")).toMatchObject({ label: "Units", shown: 12 });
    expect(row(stats.rows, "DeployableCapacity")).toMatchObject({ label: "Deployables", shown: 5 });
    expect(row(stats.rows, "CountermeasureCapacity")).toMatchObject({ label: "Countermeasures", shown: 8 });
    expect(row(stats.rows, "CargoCapacity")).toMatchObject({ unit: "m³", shown: 6200 });
  });
});

describe("the configuration screen's rows", () => {
  test("come in the game's order, labels, units, decimals and groups", () => {
    const stats = loadoutStats(gameData([ship()]), loadout("fx_ship"));
    expect(stats.rows.map(({ group, label, unit, decimals }) => [group, label, unit, decimals])).toEqual([
      ["combat", "Hull", "MJ", 0],
      ["combat", "Shield", "MJ", 0],
      ["combat", "Recharge Rate", "MW", 0],
      ["combat", "Recharge Delay", "s", 2],
      ["combat", "Avg. Group Shield", "MJ", 0],
      ["combat", "Recharge Rate", "MW", 0],
      ["combat", "Recharge Delay", "s", 2],
      ["combat", "Radar Range", "km", 0],
      ["storage", "Cargo", "m³", 0],
      ["crew", "Crew", "", 0],
      ["crew", "Units", "", 0],
      ["crew", "Missiles", "", 0],
      ["crew", "Deployables", "", 0],
      ["crew", "Countermeasures", "", 0],
    ]);
  });

  test("values are rounded down, never to nearest", () => {
    const data = gameData([ship({ stats: { ...ship().stats, radarRange: 40999 } })]);
    const stats = loadoutStats(data, loadout("fx_ship"));
    expect(row(stats.rows, "RadarRange")).toMatchObject({ value: 40.999, shown: 40 });
  });

  test("an Empty Loadout shows zeros where the game does", () => {
    const data = gameData([ship({ price: { min: 90, average: 100, max: 110 } })]);
    const stats = loadoutStats(data, loadout("fx_ship"));
    for (const id of [
      "ShieldValue",
      "ShieldRate",
      "ShieldDelay",
      "GroupedShieldValue",
      "GroupedShieldRate",
      "GroupedShieldDelay",
      "CargoCapacity",
      "MissileCapacity",
    ]) {
      expect(row(stats.rows, id).shown, id).toBe(0);
    }
    expect(row(stats.rows, "HullValue").shown).toBe(1000);
    expect(row(stats.rows, "CrewCapacity").shown).toBe(1);
    expect(stats.price).toEqual({ min: 90, average: 100, max: 110 });
  });
});

describe("mandatory upgrades", () => {
  test("lists the engine and mandatory Slots, unfilled engine groups, the thruster and default software", () => {
    const data = gameData(
      [
        ship({
          slots: [
            { id: "con_engine_01", kind: "engine", size: "s", mandatory: false, fitList: "fl_any" },
            { id: "con_shield_01", kind: "shield", size: "s", mandatory: true, fitList: "fl_any" },
            { id: "con_weapon_01", kind: "weapon", size: "s", mandatory: false, fitList: "fl_any" },
          ],
          slotGroups: [{ id: "back", kinds: { engine: { count: 2, fitList: "fl_any" } } }],
          software: { fitList: "fl_any", mandatory: ["assist"] },
        }),
      ],
      [priced("software", "assist", { min: 0, average: 0, max: 0 })],
    );
    const stats = loadoutStats(data, loadout("fx_ship"));
    expect(stats.missing).toEqual([
      { row: "slot:con_engine_01", label: "Engine con_engine_01" },
      { row: "slot:con_shield_01", label: "Shield con_shield_01" },
      { row: "group:back:engine", label: "Engines back" },
      { row: "thruster", label: "Thruster" },
      { row: "software:assist", label: "assist" },
    ]);
  });
});

describe("price", () => {
  test("totals the Ship, fitted Equipment, group counts, consumables and software, as average and min–max", () => {
    const at = (average: number) => ({ min: average - 10, average, max: average + 10 });
    const cruiser = ship({
      price: at(1_000_000),
      slots: [shieldSlot("con_shield_01")],
      slotGroups: [shieldGroup("front", 3)],
    });
    const data = gameData(
      [cruiser],
      [
        { ...shield("big", 1, 1, 0), price: at(5000) },
        { ...shield("small", 1, 1, 0), price: at(700) },
        priced("software", "scanner", at(300)),
        priced("countermeasure", "flare", at(20)),
      ],
    );
    const stats = loadoutStats(
      data,
      loadout("fx_ship", {
        slots: { con_shield_01: "big" },
        groups: { front: { shield: { equipment: "small", count: 3 } } },
        software: ["scanner"],
        consumables: { flare: 8 },
      }),
    );
    // 1,000,000 + 5,000 + 3 × 700 + 300 + 8 × 20; each of the 14 items is ±10.
    expect(stats.price).toEqual({ min: 1_007_420, average: 1_007_560, max: 1_007_700 });
  });
});
