import { describe, expect, test } from "vitest";
import { compareEquipment } from "./stats.ts";
import { engine, gameData, gun, launcher, loadout, missile, shield, ship, thruster } from "../loadout/testing/fixtures.ts";
import type { Equipment } from "../gameData.ts";

const at = <E extends Equipment>(item: E, average: number): E => ({ ...item, price: { min: average, average, max: average } });

// Pulse: 400 burst; fires 5 s, cools 6 s → 181.81 sustained.
const pulse = gun("weapon", "pulse", {
  damage: { value: 100, noShield: 0, hull: 0 },
  fireRate: 4,
  heat: { perShot: 50, overheat: 1000, coolDelay: 1, coolRate: 200 },
});
// Zephyr: 300 burst; fires 10 s, cools 6 s → 187.5 sustained.
const zephyr = gun("weapon", "zephyr", {
  damage: { value: 300, noShield: 0, hull: 0 },
  fireRate: 1,
  heat: { perShot: 100, overheat: 1000, coolDelay: 1, coolRate: 200 },
});

describe("weapons and turrets", () => {
  test("against an empty Slot, each figure's difference is the figure itself", () => {
    const data = gameData([ship()], [pulse]);
    const comparison = compareEquipment(data, loadout("fx_ship"), pulse, null);
    expect(comparison.figures).toEqual([
      { label: "Burst Output", unit: "MW", shown: 400, difference: 400, verdict: "better" },
      { label: "Sustained Output", unit: "MW", shown: 181, difference: 181, verdict: "better" },
    ]);
  });

  test("against a fitted item, each figure and the price show their differences; a lower price is better", () => {
    const data = gameData([ship()], [pulse, zephyr]);
    const comparison = compareEquipment(data, loadout("fx_ship"), at(zephyr, 30000), at(pulse, 12000));
    expect(comparison.figures).toEqual([
      { label: "Burst Output", unit: "MW", shown: 300, difference: -100, verdict: "worse" },
      { label: "Sustained Output", unit: "MW", shown: 187, difference: 6, verdict: "better" },
    ]);
    expect(comparison.price).toEqual({ shown: 30000, difference: 18000, verdict: "worse" });

    const cheaper = compareEquipment(data, loadout("fx_ship"), at(pulse, 12000), at(zephyr, 30000));
    expect(cheaper.price).toEqual({ shown: 12000, difference: -18000, verdict: "better" });
  });

  test("the fitted item compared with itself differs in nothing", () => {
    const data = gameData([ship()], [pulse]);
    const comparison = compareEquipment(data, loadout("fx_ship"), pulse, pulse);
    expect(comparison.figures.map((f) => [f.difference, f.verdict])).toEqual([
      [0, "same"],
      [0, "same"],
    ]);
    expect(comparison.price.verdict).toBe("same");
  });
});

// The Corsair of #65's popover example: a KV22 (1,744 / 1,564) and a Krupx
// Medium Warhead Launcher, whose fit list puts the weaker Ion Torpedo first.
describe("a hovered launcher shows one row per missile (ADR 0002)", () => {
  const kv22 = gun("weapon", "kv22", {
    damage: { value: 1428, noShield: 462, hull: 0 },
    fireRate: 1.2,
    magazine: { size: 2, reloadTime: 0.5 },
    heat: { perShot: 280, overheat: 10000, coolDelay: 1.13, coolRate: 3000 },
  });
  const krupx = launcher("weapon", "krupx", "fl_krupx_medium");
  const ion = { ...missile("ion", 3000, 0, 18), name: "10-IMm Medium Ion Torpedo" };
  const proton = { ...missile("proton", 12500, 12500, 18), name: "MG4-A Medium Proton Torpedo" };
  const data = gameData([ship()], [kv22, krupx, ion, proton], [{ id: "fl_krupx_medium", equipment: ["ion", "proton"] }]);
  /** Each row as [missile, loaded, burst, burst difference, sustained, sustained difference]. */
  const table = (comparison: ReturnType<typeof compareEquipment>) =>
    comparison.missiles?.map((m) => [
      m.missile?.name ?? null,
      m.loaded,
      ...m.figures.flatMap((f) => [f.shown, f.difference]),
    ]);

  test("sorted best first, then No missile, each against the fitted gun; the loaded one is marked", () => {
    const comparison = compareEquipment(data, loadout("fx_ship", { consumables: { ion: 5 } }), krupx, kv22);
    expect(table(comparison)).toEqual([
      ["MG4-A Medium Proton Torpedo", false, 1388, -356, 1388, -176],
      ["10-IMm Medium Ion Torpedo", true, 166, -1578, 166, -1398],
      [null, false, 0, -1744, 0, -1564],
    ]);
    expect(comparison.missiles?.[0]?.figures.map((f) => [f.label, f.unit, f.verdict])).toEqual([
      ["Burst Output", "MW", "worse"],
      ["Sustained Output", "MW", "worse"],
    ]);
    // Its output is all in its missile rows; its own figures are what it adds to the Ship.
    expect(comparison.figures).toEqual([
      { label: "Missile Storage", unit: "", shown: 0, difference: 0, verdict: "same" },
    ]);
  });

  test("with no compatible missile loaded, No missile is marked loaded", () => {
    const comparison = compareEquipment(data, loadout("fx_ship"), krupx, null);
    expect(table(comparison)).toEqual([
      ["MG4-A Medium Proton Torpedo", false, 1388, 1388, 1388, 1388],
      ["10-IMm Medium Ion Torpedo", false, 166, 166, 166, 166],
      [null, true, 0, 0, 0, 0],
    ]);
  });

  test("against a fitted launcher, the differences are from its best loaded missile", () => {
    const loaded = loadout("fx_ship", { consumables: { ion: 5, proton: 5 } });
    const comparison = compareEquipment(data, loaded, krupx, krupx);
    expect(table(comparison)).toEqual([
      ["MG4-A Medium Proton Torpedo", true, 1388, 0, 1388, 0],
      ["10-IMm Medium Ion Torpedo", false, 166, -1222, 166, -1222],
      [null, false, 0, -1388, 0, -1388],
    ]);
  });

  test("a launcher's own missile storage, which adds to the Ship's Missiles, is compared with the fitted launcher's", () => {
    const rockets = launcher("weapon", "rockets", "fl_krupx_medium", 6);
    const withRockets = gameData([ship()], [krupx, rockets, ion], [{ id: "fl_krupx_medium", equipment: ["ion"] }]);
    const comparison = compareEquipment(withRockets, loadout("fx_ship"), krupx, rockets);
    expect(comparison.figures).toEqual([
      { label: "Missile Storage", unit: "", shown: 0, difference: -6, verdict: "worse" },
    ]);
  });

  test("a gun hovered over a fitted launcher keeps one pair, against the launcher's loaded missile", () => {
    const comparison = compareEquipment(data, loadout("fx_ship", { consumables: { ion: 5, proton: 5 } }), kv22, krupx);
    expect(comparison.missiles).toBeNull();
    expect(comparison.figures.map((f) => [f.label, f.shown, f.difference])).toEqual([
      ["Burst Output", 1744, 356],
      ["Sustained Output", 1564, 176],
      ["Missile Storage", 0, 0],
    ]);
  });

  test("a gun hovered over a fitted launcher with storage shows the storage it gives up", () => {
    const rockets = launcher("weapon", "rockets", "fl_krupx_medium", 6);
    const withRockets = gameData([ship()], [kv22, rockets, ion], [{ id: "fl_krupx_medium", equipment: ["ion"] }]);
    const comparison = compareEquipment(withRockets, loadout("fx_ship"), kv22, rockets);
    expect(comparison.figures.at(-1)).toEqual({ label: "Missile Storage", unit: "", shown: 0, difference: -6, verdict: "worse" });
  });

  test("a gun hovered over a gun shows no Missile Storage", () => {
    const comparison = compareEquipment(data, loadout("fx_ship"), kv22, kv22);
    expect(comparison.figures.map((f) => f.label)).toEqual(["Burst Output", "Sustained Output"]);
  });
});

test("shields show capacity, recharge rate and recharge delay; a shorter delay is better", () => {
  const small = shield("small", 1000, 100, 2);
  const medium = shield("medium", 5000, 300, 4.5);
  const comparison = compareEquipment(gameData([ship()], [small, medium]), loadout("fx_ship"), small, medium);
  expect(comparison.figures).toEqual([
    { label: "Shield Capacity", unit: "MJ", shown: 1000, difference: -4000, verdict: "worse" },
    { label: "Recharge Rate", unit: "MW", shown: 100, difference: -200, verdict: "worse" },
    { label: "Recharge Delay", unit: "s", shown: 2, difference: -2.5, verdict: "better" },
  ]);
  const slower = compareEquipment(gameData([ship()], [small, medium]), loadout("fx_ship"), medium, small);
  expect(slower.figures.at(-1)).toEqual({ label: "Recharge Delay", unit: "s", shown: 4.5, difference: 2.5, verdict: "worse" });
});

test("engines show their thrust, boost and travel figures, in the Stats panel's order", () => {
  const sprint = engine("sprint", 1500, { thrust: 4, acceleration: 2, duration: 10, recharge: 20 }, { thrust: 10, charge: 5, attack: 0 });
  const comparison = compareEquipment(gameData([ship()], [sprint]), loadout("fx_ship"), sprint, null);
  expect(comparison.figures).toEqual([
    { label: "Thrust", unit: "kN", shown: 1500, difference: 1500, verdict: "better" },
    { label: "Boost Thrust", unit: "kN", shown: 6000, difference: 6000, verdict: "better" },
    // Boost Acceleration's thrust, before the Ship's mass: 1,500 × 2.
    { label: "Boost Acceleration Thrust", unit: "kN", shown: 3000, difference: 3000, verdict: "better" },
    { label: "Boost Capacity", unit: "s", shown: 10, difference: 10, verdict: "better" },
    // A full recharge in 20 s is 5 % a second, as the Stats panel's row.
    { label: "Boost Recharge Rate", unit: "%/s", shown: 5, difference: 5, verdict: "better" },
    { label: "Travel Thrust", unit: "kN", shown: 15000, difference: 15000, verdict: "better" },
    // Charging longer than an empty Slot's 0 s is worse.
    { label: "Travel Charge Time", unit: "s", shown: 5, difference: 5, verdict: "worse" },
  ]);
});

test("against a fitted engine, a shorter travel charge time is better", () => {
  const boost = { thrust: 2, acceleration: 2, duration: 10, recharge: 30 };
  const quick = engine("quick", 1000, boost, { thrust: 10, charge: 3.5, attack: 0 });
  const slow = engine("slow", 1000, boost, { thrust: 10, charge: 8, attack: 0 });
  const comparison = compareEquipment(gameData([ship()], [quick, slow]), loadout("fx_ship"), quick, slow);
  expect(comparison.figures.find((f) => f.label === "Travel Charge Time")).toEqual({
    label: "Travel Charge Time",
    unit: "s",
    shown: 3.5,
    difference: -4.5,
    verdict: "better",
  });
  // A full recharge in 30 s is 3.3 % a second, rounded down like the Stats panel.
  expect(comparison.figures.find((f) => f.label === "Boost Recharge Rate")?.shown).toBe(3.3);
});

/**
 * Max Travel Thrust as the Encyclopedia shows it, in game on X4 8.00 + SWI
 * 0.9.1 HF (#63). Thrust and travel@thrust are copied from the 091_x4-800
 * Game Data; the boost inputs don't touch these figures.
 */
describe("engines' Travel Thrust matches the Encyclopedia (#63)", () => {
  const boost = { thrust: 1, acceleration: 1, duration: 1, recharge: 1 };
  test.each([
    ["C-ROC Engine", "engine_croc", 800, 20.75, 16600],
    ["Gozanti Engine", "engine_gozanti_01", 1350, 20.6, 27810],
    ["Daedal Engine", "engine_mc75", 8000, 76, 608000],
  ])("%s (%s): Thrust %d kN × travel@thrust %s = Max Travel Thrust %d kN", (_name, id, forward, travel, encyclopedia) => {
    const item = engine(id, forward, boost, { thrust: travel, charge: 1, attack: 0 });
    const comparison = compareEquipment(gameData([ship()], [item]), loadout("fx_ship"), item, null);
    const thrusts = comparison.figures.filter((f) => f.label === "Thrust" || f.label === "Travel Thrust");
    expect(thrusts.map((f) => [f.label, f.unit, f.shown])).toEqual([
      ["Thrust", "kN", forward],
      ["Travel Thrust", "kN", encyclopedia],
    ]);
  });
});

/**
 * Max Boost Thrust as the Encyclopedia shows it, in game on X4 8.00 + SWI
 * 0.9.1 HF (#63's screenshots, checked in #114). Thrust and boost@thrust are
 * copied from the 091_x4-800 Game Data; the other inputs don't touch this figure.
 */
describe("engines' Boost Thrust matches the Encyclopedia (#114)", () => {
  const travel = { thrust: 1, charge: 1, attack: 0 };
  test.each([
    ["C-ROC Engine", "engine_croc", 800, 2.7, 2160],
    ["Gozanti Engine", "engine_gozanti_01", 1350, 2.7, 3645],
    ["Daedal Engine", "engine_mc75", 8000, 2, 16000],
  ])("%s (%s): Thrust %d kN × boost@thrust %s = Max Boost Thrust %d kN", (_name, id, forward, boostThrust, encyclopedia) => {
    const item = engine(id, forward, { thrust: boostThrust, acceleration: 1, duration: 1, recharge: 1 }, travel);
    const comparison = compareEquipment(gameData([ship()], [item]), loadout("fx_ship"), item, null);
    const thrusts = comparison.figures.filter((f) => f.label === "Thrust" || f.label === "Boost Thrust");
    expect(thrusts.map((f) => [f.label, f.unit, f.shown])).toEqual([
      ["Thrust", "kN", forward],
      ["Boost Thrust", "kN", encyclopedia],
    ]);
  });
});

// Strafe Speed and Strafe Acceleration are both the strafe thrust over one of
// the Ship's own figures, so one Strafe Thrust compares them both.
test("thrusters show their strafe thrust, then their yaw, pitch and roll torque", () => {
  const nimble = thruster("nimble", { strafe: 400, pitch: 3, yaw: 3, roll: 2.5 });
  const steady = thruster("steady", { strafe: 8000, pitch: 60, yaw: 60, roll: 45 });
  const comparison = compareEquipment(gameData([ship()], [nimble, steady]), loadout("fx_ship"), steady, nimble);
  expect(comparison.figures).toEqual([
    { label: "Strafe Thrust", unit: "kN", shown: 8000, difference: 7600, verdict: "better" },
    { label: "Yaw Torque", unit: "", shown: 60, difference: 57, verdict: "better" },
    { label: "Pitch Torque", unit: "", shown: 60, difference: 57, verdict: "better" },
    { label: "Roll Torque", unit: "", shown: 45, difference: 42.5, verdict: "better" },
  ]);
});
