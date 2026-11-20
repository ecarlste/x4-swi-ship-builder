import { describe, expect, test } from "vitest";
import { compareEquipment } from "./stats.ts";
import { engine, gameData, gun, launcher, loadout, missile, shield, ship, thruster } from "./testing/fixtures.ts";
import type { Equipment } from "../gameData.ts";

const at = <E extends Equipment>(item: E, average: number): E => ({ ...item, price: { min: average, average, max: average } });

// Pulse: 400 burst; fires 5 s, cools 6 s → 181.81 sustained.
const pulse = gun("weapon", "pulse", {
  damage: { value: 100, noShield: 0 },
  fireRate: 4,
  heat: { perShot: 50, overheat: 1000, coolDelay: 1, coolRate: 200 },
});
// Zephyr: 300 burst; fires 10 s, cools 6 s → 187.5 sustained.
const zephyr = gun("weapon", "zephyr", {
  damage: { value: 300, noShield: 0 },
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

test("a launcher's output is that of the missile the Loadout carries for it", () => {
  const tube = launcher("weapon", "tube", "fl_torpedoes");
  const torpedo = missile("torpedo", 9000, 1000, 12);
  const data = gameData([ship()], [tube, torpedo], [{ id: "fl_torpedoes", equipment: ["torpedo"] }]);

  const loaded = compareEquipment(data, loadout("fx_ship", { consumables: { torpedo: 4 } }), tube, null);
  expect(loaded.figures.map((f) => f.shown)).toEqual([833, 833]);
  const unloaded = compareEquipment(data, loadout("fx_ship"), tube, null);
  expect(unloaded.figures.map((f) => f.shown)).toEqual([0, 0]);
});

test("shields show capacity and recharge rate", () => {
  const small = shield("small", 1000, 100, 2);
  const medium = shield("medium", 5000, 300, 4);
  const comparison = compareEquipment(gameData([ship()], [small, medium]), loadout("fx_ship"), small, medium);
  expect(comparison.figures).toEqual([
    { label: "Shield Capacity", unit: "MJ", shown: 1000, difference: -4000, verdict: "worse" },
    { label: "Recharge Rate", unit: "MW", shown: 100, difference: -200, verdict: "worse" },
  ]);
});

test("engines show forward thrust and travel thrust", () => {
  const sprint = engine("sprint", 1500, { thrust: 4, acceleration: 2, duration: 10, recharge: 20 }, { thrust: 10, charge: 5, attack: 0 });
  const comparison = compareEquipment(gameData([ship()], [sprint]), loadout("fx_ship"), sprint, null);
  expect(comparison.figures).toEqual([
    { label: "Thrust", unit: "N", shown: 1500, difference: 1500, verdict: "better" },
    { label: "Travel Thrust", unit: "N", shown: 15000, difference: 15000, verdict: "better" },
  ]);
});

test("thrusters show their yaw, pitch and roll torque", () => {
  const nimble = thruster("nimble", { strafe: 400, pitch: 3, yaw: 3, roll: 2.5 });
  const steady = thruster("steady", { strafe: 8000, pitch: 60, yaw: 60, roll: 45 });
  const comparison = compareEquipment(gameData([ship()], [nimble, steady]), loadout("fx_ship"), steady, nimble);
  expect(comparison.figures).toEqual([
    { label: "Yaw Torque", unit: "", shown: 60, difference: 57, verdict: "better" },
    { label: "Pitch Torque", unit: "", shown: 60, difference: 57, verdict: "better" },
    { label: "Roll Torque", unit: "", shown: 45, difference: 42.5, verdict: "better" },
  ]);
});
