import { describe, expect, test } from "vitest";
import { gunOutput, loadoutStats, type StatRow } from "./stats.ts";
import {
  gameData,
  gun,
  launcher,
  loadout,
  missile,
  priced,
  shield,
  shieldGroup,
  shieldSlot,
  ship,
  turretGroup,
  turretSlot,
  weaponSlot,
} from "./testing/fixtures.ts";
import { engine, engineSlot, thruster } from "./testing/fixtures.ts";
import type { Ship } from "../gameData.ts";

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

  test.each(["s", "m"] as const)("a %s Ship has no Avg. Group Shield rows", (size) => {
    const stats = loadoutStats(gameData([ship({ size })]), loadout("fx_ship"));
    expect(stats.rows.filter((r) => r.id.startsWith("GroupedShield"))).toEqual([]);
  });

  test.each(["l", "xl"] as const)("an %s Ship shows Avg. Group Shield rows even with no group shield fitted", (size) => {
    const stats = loadoutStats(gameData([ship({ size })]), loadout("fx_ship"));
    expect(stats.rows.filter((r) => r.id.startsWith("GroupedShield")).map((r) => r.shown)).toEqual([0, 0, 0]);
  });
});

describe("firepower", () => {
  // T-65B X-wing (#12): four KX5 lasers and two Krupx launchers with MG7-A torpedoes.
  const xwing = ship({ slots: [1, 2, 3, 4, 5, 6].map((n) => weaponSlot(`con_weapon_0${n}`)) });
  const kx5 = gun("weapon", "kx5", {
    damage: { value: 193, noShield: 135 },
    fireRate: 2.4,
    heat: { perShot: 280, overheat: 10000, coolDelay: 1.13, coolRate: 3000 },
  });
  const krupx = launcher("weapon", "krupx", "fl_torpedoes");
  const mg7a = missile("mg7a", 7000, 7000, 10);
  const xwingData = gameData([xwing], [kx5, krupx, mg7a], [{ id: "fl_torpedoes", equipment: ["mg7a"] }]);
  const xwingWith = (weapons: string[], consumables: Record<string, number> = {}) =>
    loadout("fx_ship", {
      slots: Object.fromEntries(weapons.map((id, i) => [`con_weapon_0${i + 1}`, id])),
      consumables,
    });

  test("lasers: burst sums damage + noshield × rate; sustained follows the heat model (X-wing: 3,148 / 2,422)", () => {
    const stats = loadoutStats(xwingData, xwingWith(["kx5", "kx5", "kx5", "kx5"]));
    expect(row(stats.rows, "BurstDPS")).toMatchObject({ label: "Burst Weapon Output", unit: "MW", shown: 3148 });
    expect(row(stats.rows, "SustainedDPS")).toMatchObject({ label: "Sustained Weapon Output", unit: "MW", shown: 2422 });
  });

  test("launchers count: (explosion + hull damage) / reload, with no heat (X-wing: 2,800 / 2,800)", () => {
    const stats = loadoutStats(xwingData, xwingWith(["krupx", "krupx"], { mg7a: 6 }));
    expect(row(stats.rows, "BurstDPS").shown).toBe(2800);
    expect(row(stats.rows, "SustainedDPS").shown).toBe(2800);
  });

  test("lasers and launchers together (X-wing: 5,948 / 5,222)", () => {
    const stats = loadoutStats(xwingData, xwingWith(["kx5", "kx5", "kx5", "kx5", "krupx", "krupx"], { mg7a: 6 }));
    expect(row(stats.rows, "BurstDPS").shown).toBe(5948);
    expect(row(stats.rows, "SustainedDPS").shown).toBe(5222);
  });

  // Encyclopedia turret entries (#12): rate of fire and Weapon Output.
  const rh2 = gun("turret", "rh2", {
    damage: { value: 255, noShield: 189 },
    barrelAmount: 2,
    fireRate: 2,
    magazine: { size: 2, reloadTime: 3 },
  });
  const rm76 = gun("turret", "rm76", {
    damage: { value: 110, noShield: 35 },
    fireRate: 5,
    magazine: { size: 20, reloadTime: 3 },
  });

  test("a magazine sets the rate of fire: mag / (reload + mag / rate) (RH2: 0.5 / 444, RM-76: 2.86 / 414)", () => {
    expect(gunOutput(rh2).rateOfFire).toBe(0.5);
    expect(gunOutput(rh2).burst).toBe(444);
    expect(gunOutput(rm76).rateOfFire).toBeCloseTo(2.857, 3);
    expect(Math.floor(gunOutput(rm76).burst)).toBe(414);
  });

  const twoTurrets = ship({ slots: [turretSlot("con_turret_01"), turretSlot("con_turret_02")] });
  const turretsData = gameData([twoTurrets], [rh2, rm76]);
  const turrets = (...ids: string[]) =>
    loadout("fx_ship", { slots: Object.fromEntries(ids.map((id, i) => [`con_turret_0${i + 1}`, id])) });

  test("Avg. Turret Output is the turrets' summed output / 6 (YT-1300: 2× RM-76 = 138, 1× = 69)", () => {
    const two = loadoutStats(turretsData, turrets("rm76", "rm76"));
    expect(row(two.rows, "TurretSustainedDPS")).toMatchObject({ label: "Avg. Turret Output", unit: "MW", shown: 138 });
    expect(row(loadoutStats(turretsData, turrets("rm76")).rows, "TurretSustainedDPS").shown).toBe(69);
  });

  test("turrets don't feed the forward weapon rows (YT-1300: 0 / 0)", () => {
    const stats = loadoutStats(turretsData, turrets("rm76", "rm76"));
    expect(row(stats.rows, "BurstDPS").shown).toBe(0);
    expect(row(stats.rows, "SustainedDPS").shown).toBe(0);
  });

  test("dual-barrel turrets count both barrels (Gozanti: 2× RH2 = 148)", () => {
    const stats = loadoutStats(turretsData, turrets("rh2", "rh2"));
    expect(row(stats.rows, "TurretSustainedDPS").shown).toBe(148);
  });

  // Class 546 Cruiser (#12): 18× RH3, 10× D6 and 2× XX-18, in turret Slots and Slot Groups.
  // #12 records only each type's total (8,769.6 / 11,652 / 3,605.7), so these
  // inputs are made up to give the same per-turret output through magazines: unconfirmed (#63).
  test("L Ships count Slot Group turrets too, as the grouped row (546 Cruiser: 4,004)", () => {
    const rh3 = gun("turret", "rh3", {
      damage: { value: 174, noShield: 0 },
      barrelAmount: 2,
      fireRate: 3.5,
      magazine: { size: 7, reloadTime: 3 },
    }); // 348 × 1.4 = 487.2
    const d6 = gun("turret", "d6", {
      damage: { value: 600, noShield: 371 },
      fireRate: 3,
      magazine: { size: 6, reloadTime: 3 },
    }); // 971 × 1.2 = 1,165.2
    const xx18 = gun("turret", "xx18", {
      damage: { value: 800, noShield: 401.9 },
      fireRate: 3,
      magazine: { size: 3, reloadTime: 1 },
    }); // 1,201.9 × 1.5 = 1,802.85
    const cruiser = ship({
      size: "l",
      slots: [turretSlot("con_turret_01"), turretSlot("con_turret_02")],
      slotGroups: [turretGroup("left", 9), turretGroup("right", 9), turretGroup("top", 10)],
    });
    const stats = loadoutStats(
      gameData([cruiser], [rh3, d6, xx18]),
      loadout("fx_ship", {
        slots: { con_turret_01: "xx18", con_turret_02: "xx18" },
        groups: {
          left: { turret: { equipment: "rh3", count: 9 } },
          right: { turret: { equipment: "rh3", count: 9 } },
          top: { turret: { equipment: "d6", count: 10 } },
        },
      }),
    );
    expect(row(stats.rows, "GroupedTurretSustainedDPS")).toMatchObject({ label: "Avg. Turret Output", shown: 4004 });
    expect(stats.rows.some((r) => r.id === "TurretSustainedDPS")).toBe(false);
  });

  test("a launcher with none of its missiles loaded adds nothing", () => {
    const stats = loadoutStats(xwingData, xwingWith(["krupx", "krupx"]));
    expect(row(stats.rows, "BurstDPS").shown).toBe(0);
    expect(row(stats.rows, "SustainedDPS").shown).toBe(0);
  });
});

// The builder's own rule, not the game's (ADR 0002): a launcher fires its loaded
// compatible missile with the highest output, and gives 0 with none loaded.
// Inputs are the 091_x4-800 Game Data's.
describe("a launcher fires its best loaded missile (ADR 0002)", () => {
  // Gozanti C-ROC Corsair: a Krupx Medium Warhead Launcher and a KV22 (1,744 / 1,564).
  const corsair = ship({ id: "gozanti_croc_raider", slots: [weaponSlot("con_weapon_01"), weaponSlot("con_weapon_02")] });
  const kv22 = gun("weapon", "weapon_kv22_m_laser", {
    damage: { value: 1428, noShield: 462 },
    fireRate: 1.2,
    magazine: { size: 2, reloadTime: 0.5 },
    heat: { perShot: 280, overheat: 10000, coolDelay: 1.13, coolRate: 3000 },
  });
  const krupxMedium = launcher("weapon", "weapon_protonlauncher", "fl_krupx_medium");
  const ion = missile("missile_ion_medium", 3000, 0, 18); // 166.6
  const proton = missile("missile_proton_medium", 12500, 12500, 18); // 1,388.8
  const corsairData = gameData(
    [corsair],
    [kv22, krupxMedium, ion, proton],
    // The fit list's order puts the weaker missile first.
    [{ id: "fl_krupx_medium", equipment: ["missile_ion_medium", "missile_proton_medium"] }],
  );
  const corsairWith = (consumables: Record<string, number>) =>
    loadoutStats(
      corsairData,
      loadout("gozanti_croc_raider", {
        slots: { con_weapon_01: "weapon_protonlauncher", con_weapon_02: "weapon_kv22_m_laser" },
        consumables,
      }),
    );
  const output = (stats: ReturnType<typeof loadoutStats>) => [row(stats.rows, "BurstDPS").shown, row(stats.rows, "SustainedDPS").shown];

  test("with two compatible missiles loaded, it fires the stronger (C2, 5 Ion + 5 Proton: 3,133 / 2,953)", () => {
    expect(output(corsairWith({ missile_ion_medium: 5, missile_proton_medium: 5 }))).toEqual([3133, 2953]);
  });

  test("with only the weaker missile loaded, it fires that one (C4, 5 Ion: 1,911)", () => {
    expect(output(corsairWith({ missile_ion_medium: 5 }))[0]).toBe(1911);
  });

  test("with no compatible missile loaded, it gives 0 and the gun counts alone (C5: 1,744 / 1,564)", () => {
    expect(output(corsairWith({}))).toEqual([1744, 1564]);
  });

  test("a launcher turret in a Slot Group with no missiles gives 0 (H3, Heraklon: Avg. Turret Output 0)", () => {
    const heraklon = ship({ id: "heraklon_solid", size: "l", slotGroups: [turretGroup("missile", 1)] });
    const tubeLight = launcher("turret", "turret_m_conctubelight", "fl_concussion_light");
    const concussion = missile("missile_concussion_light", 5000, 1500, 4);
    const data = gameData([heraklon], [tubeLight, concussion], [{ id: "fl_concussion_light", equipment: ["missile_concussion_light"] }]);
    const stats = loadoutStats(
      data,
      loadout("heraklon_solid", { groups: { missile: { turret: { equipment: "turret_m_conctubelight", count: 1 } } } }),
    );
    expect(row(stats.rows, "GroupedTurretSustainedDPS").shown).toBe(0);
  });
});

describe("capacities", () => {
  const freighter = ship({
    stats: { ...ship().stats, radarRange: 40000 },
    capacities: { missiles: 6, drones: 12, deployables: 5, countermeasures: 8, crew: 4, cargo: 6200 },
    cargoTypes: ["container"],
  });
  const stats = loadoutStats(gameData([freighter]), loadout("fx_ship"));
  const storageRows = (cargoTypes: Ship["cargoTypes"]) =>
    loadoutStats(gameData([ship({ ...freighter, cargoTypes })]), loadout("fx_ship"))
      .rows.filter((r) => r.group === "storage")
      .map((r) => [r.id, r.label, r.unit, r.shown]);

  test("Crew is people@capacity plus the pilot (YT-1300: 4 + 1 = 5)", () => {
    expect(row(stats.rows, "CrewCapacity")).toMatchObject({ label: "Crew", shown: 5 });
  });

  test("radar range is shown in km", () => {
    expect(row(stats.rows, "RadarRange")).toMatchObject({ label: "Radar Range", unit: "km", shown: 40 });
  });

  test("missile, drone, deployable and countermeasure capacities come from the Ship", () => {
    expect(row(stats.rows, "MissileCapacity")).toMatchObject({ label: "Missiles", shown: 6 });
    expect(row(stats.rows, "UnitCapacity")).toMatchObject({ label: "Units", shown: 12 });
    expect(row(stats.rows, "DeployableCapacity")).toMatchObject({ label: "Deployables", shown: 5 });
    expect(row(stats.rows, "CountermeasureCapacity")).toMatchObject({ label: "Countermeasures", shown: 8 });
  });

  test("cargo shows the game's storage row for the Ship's cargo type", () => {
    expect(storageRows(["container"])).toEqual([["ContainerCapacity", "Container Storage", "m³", 6200]]);
    expect(storageRows(["condensate"])).toEqual([["CondensateCapacity", "Condensate Storage", "m³", 6200]]);
  });

  test("a Ship whose storage takes several cargo types shows a row for each, in the game's order", () => {
    expect(storageRows(["container", "liquid", "solid"])).toEqual([
      ["ContainerCapacity", "Container Storage", "m³", 6200],
      ["SolidCapacity", "Solid Storage", "m³", 6200],
      ["LiquidCapacity", "Liquid Storage", "m³", 6200],
    ]);
  });

  test("a Ship with no storage shows no storage rows", () => {
    expect(storageRows([])).toEqual([]);
  });
});

describe("the configuration screen's rows", () => {
  test("come in the game's order, labels, units, decimals and groups", () => {
    const stats = loadoutStats(gameData([ship({ size: "l", cargoTypes: ["container"] })]), loadout("fx_ship"));
    expect(stats.rows.map(({ group, label, unit, decimals }) => [group, label, unit, decimals])).toEqual([
      ["combat", "Hull", "MJ", 0],
      ["combat", "Shield", "MJ", 0],
      ["combat", "Recharge Rate", "MW", 0],
      ["combat", "Recharge Delay", "s", 2],
      ["combat", "Avg. Group Shield", "MJ", 0],
      ["combat", "Recharge Rate", "MW", 0],
      ["combat", "Recharge Delay", "s", 2],
      ["combat", "Radar Range", "km", 0],
      ["combat", "Burst Weapon Output", "MW", 0],
      ["combat", "Sustained Weapon Output", "MW", 0],
      ["combat", "Avg. Turret Output", "MW", 0],
      ["storage", "Container Storage", "m³", 0],
      ["flight", "Speed", "m/s", 0],
      ["flight", "Acceleration", "m/s²", 0],
      ["flight", "Boost Speed", "m/s", 0],
      ["flight", "Boost Acceleration", "m/s²", 0],
      ["flight", "Boost Capacity", "s", 1],
      ["flight", "Boost Recharge Rate", "%/s", 1],
      ["flight", "Travel Speed", "m/s", 0],
      ["flight", "Travel Acceleration", "m/s²", 0],
      ["flight", "Travel Charge Time", "s", 1],
      ["flight", "Strafe Speed", "m/s", 1],
      ["flight", "Strafe Acceleration", "m/s²", 1],
      ["flight", "Yaw", "°/s", 1],
      ["flight", "Pitch", "°/s", 1],
      ["flight", "Roll", "°/s", 1],
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
      "BurstDPS",
      "SustainedDPS",
      "TurretSustainedDPS",
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
  test("lists one engine row for all the Ship's engines, then mandatory Slots, the thruster and default software", () => {
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
      { row: "engine", label: "Engines" },
      { row: "slot:con_shield_01", label: "Shield con_shield_01" },
      { row: "thruster", label: "Thruster" },
      { row: "software:assist", label: "assist" },
    ]);
  });
});

describe("price", () => {
  test("totals the Ship, fitted Equipment, group counts, the engine per engine, consumables and software, as average and min–max", () => {
    const at = (average: number) => ({ min: average - 10, average, max: average + 10 });
    const cruiser = ship({
      price: at(1_000_000),
      slots: [shieldSlot("con_shield_01"), engineSlot("con_engine_01"), engineSlot("con_engine_02")],
      slotGroups: [shieldGroup("front", 3)],
    });
    const data = gameData(
      [cruiser],
      [
        { ...shield("big", 1, 1, 0), price: at(5000) },
        { ...shield("small", 1, 1, 0), price: at(700) },
        { ...engine("drive", 1, { thrust: 1, acceleration: 1, duration: 1, recharge: 1 }, { thrust: 1, charge: 1, attack: 0 }), price: at(2000) },
        priced("software", "scanner", at(300)),
        priced("countermeasure", "flare", at(20)),
      ],
    );
    const stats = loadoutStats(
      data,
      loadout("fx_ship", {
        slots: { con_shield_01: "big" },
        groups: { front: { shield: { equipment: "small", count: 3 } } },
        engine: "drive",
        software: ["scanner"],
        consumables: { flare: 8 },
      }),
    );
    // 1,000,000 + 5,000 + 3 × 700 + 2 × 2,000 + 300 + 8 × 20; each of the 16 items is ±10.
    expect(stats.price).toEqual({ min: 1_011_400, average: 1_011_560, max: 1_011_720 });
  });
});

describe("flight", () => {
  // T-65B X-wing (#12): mass 6, 4 engine Slots, an all-round S thruster.
  // Pitch and roll inputs weren't recorded, so theirs are picked to give the shown 39.9 and 50.0.
  const xwing = ship({
    stats: {
      ...ship().stats,
      mass: 6,
      drag: { forward: 6.65, reverse: 10, horizontal: 8, vertical: 8, pitch: 4, yaw: 4, roll: 3.2 },
      accFactors: { forward: 0.5, reverse: 1, horizontal: 1.4, vertical: 1.4 },
    },
    slots: [1, 2, 3, 4].map((n) => engineSlot(`con_engine_0${n}`)),
  });
  const xwingEquipment = [
    engine(
      "fusial",
      550,
      { thrust: 2.5, acceleration: 1.25, duration: 11, recharge: 80 },
      { thrust: 21.6, charge: 4, attack: 0 },
    ),
    thruster("allround", { strafe: 400, pitch: 160, yaw: 160, roll: 160 }),
  ];
  const xwingStats = loadoutStats(
    gameData([xwing], xwingEquipment),
    loadout("fx_ship", { engine: "fusial", thruster: "allround" }),
  );

  test("the X-wing's speeds: 330, boost 827, travel 7,145", () => {
    expect(row(xwingStats.rows, "ForwardSpeed").shown).toBe(330);
    expect(row(xwingStats.rows, "BoostSpeed").shown).toBe(827);
    expect(row(xwingStats.rows, "TravelSpeed").shown).toBe(7145);
  });

  test("the X-wing's accelerations: 183, boost 229, travel 183 (travel@attack 0)", () => {
    expect(row(xwingStats.rows, "ForwardAcceleration").shown).toBe(183);
    expect(row(xwingStats.rows, "BoostAcceleration").shown).toBe(229);
    expect(row(xwingStats.rows, "TravelAcceleration").shown).toBe(183);
  });

  test("the X-wing's boost and travel drive: capacity 11.0 s, recharge 1.2 %/s, charge 4.0 s", () => {
    expect(row(xwingStats.rows, "BoostMaxDuration")).toMatchObject({ decimals: 1, shown: 11 });
    expect(row(xwingStats.rows, "BoostRechargeRate")).toMatchObject({ value: 1.25, shown: 1.2 });
    expect(row(xwingStats.rows, "TravelChargeTime")).toMatchObject({ decimals: 1, shown: 4 });
  });

  test("the X-wing's strafe: 50.0 m/s, 93.3 m/s²", () => {
    expect(row(xwingStats.rows, "HorizontalStrafeSpeed").shown).toBe(50);
    expect(row(xwingStats.rows, "HorizontalStrafeAcceleration").shown).toBe(93.3);
  });

  test("the X-wing's turning in °/s: yaw 39.9, pitch 39.9, roll 50.0", () => {
    expect(row(xwingStats.rows, "YawSpeed")).toMatchObject({ unit: "°/s", shown: 39.9 });
    expect(row(xwingStats.rows, "PitchSpeed").shown).toBe(39.9);
    expect(row(xwingStats.rows, "RollSpeed").shown).toBe(50);
  });

  test("boost speed rounds down to 438, not to nearest 439 (Gozanti)", () => {
    // The Gozanti's engine inputs weren't recorded; these give the same 438.6.
    const gozanti = ship({
      stats: { ...ship().stats, drag: { ...ship().stats.drag, forward: 4 } },
      slotGroups: [{ id: "back", kinds: { engine: { count: 2, fitList: "fl_any" } } }],
    });
    const data = gameData(
      [gozanti],
      [engine("gg0", 500, { thrust: 1.7544, acceleration: 1, duration: 10, recharge: 50 }, { thrust: 10, charge: 5, attack: 0 })],
    );
    const stats = loadoutStats(data, loadout("fx_ship", { engine: "gg0" }));
    expect(row(stats.rows, "ForwardSpeed").shown).toBe(250);
    expect(row(stats.rows, "BoostSpeed")).toMatchObject({ shown: 438 });
    expect(row(stats.rows, "BoostSpeed").value).toBeCloseTo(438.6, 6);
  });

  test("rotationspeed@max caps turning when it binds", () => {
    const capped = ship({ stats: { ...xwing.stats, maxRotationSpeed: 30 } });
    const stats = loadoutStats(gameData([capped], xwingEquipment), loadout("fx_ship", { thruster: "allround" }));
    expect(row(stats.rows, "YawSpeed").shown).toBe(30);
    expect(row(stats.rows, "RollSpeed").shown).toBe(30);
  });

  test("with no engine the speeds are 0, and with no thruster strafe and turning are 0", () => {
    const stats = loadoutStats(gameData([xwing], xwingEquipment), loadout("fx_ship"));
    for (const id of [
      "ForwardSpeed",
      "ForwardAcceleration",
      "BoostSpeed",
      "BoostAcceleration",
      "BoostMaxDuration",
      "BoostRechargeRate",
      "TravelSpeed",
      "TravelAcceleration",
      "TravelChargeTime",
      "HorizontalStrafeSpeed",
      "HorizontalStrafeAcceleration",
      "YawSpeed",
      "PitchSpeed",
      "RollSpeed",
    ]) {
      expect(row(stats.rows, id).shown, id).toBe(0);
    }
  });
});
