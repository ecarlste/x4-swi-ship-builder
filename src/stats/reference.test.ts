/**
 * In-game reference Loadouts (#39): each screenshot's exact Loadout, checked on
 * the ship configuration screen of X4 8.00 + SWI 0.9.1 HF. Raw inputs are
 * copied from that install's Game Data as plain values; expected values are
 * what the screen showed. Only the rows checked for each Ship are asserted. Later
 * checks (#50, #63) add their own describe blocks, citing their issue.
 *
 * The S Ships' Loadouts are the screenshots' in full. On the M, L and XL Ships
 * #39 checked only flight, radar and capacities, so their Loadouts leave out
 * the shields and turrets on screen, which none of those rows depend on (and
 * whose Slot Group placement the screenshots don't show), except the Venator's
 * torpedo launcher turrets, which could have added to Missiles.
 */
import { describe, expect, test } from "vitest";
import { loadoutStats, type LoadoutStats } from "./stats.ts";
import { engine, engineSlot, gameData, gun, launcher, loadout, missile, shield, ship, thruster, weaponSlot } from "./testing/fixtures.ts";
import type { Equipment, Ship } from "../gameData.ts";

/** The shown value of each named row. */
function shown(stats: LoadoutStats, ids: string[]): Record<string, number> {
  return Object.fromEntries(
    ids.map((id) => {
      const found = stats.rows.find((r) => r.id === id);
      if (!found) throw new Error(`no ${id} row`);
      return [id, found.shown];
    }),
  );
}

/** Asserts the screen's numbers for these rows. */
function expectScreen(stats: LoadoutStats, screen: Record<string, number>) {
  expect(shown(stats, Object.keys(screen))).toEqual(screen);
}

// ---------------------------------------------------------------- Game Data

/** `n` engine Slots, `con_engine_01` onwards. */
const engineSlots = (n: number) => Array.from({ length: n }, (_, i) => engineSlot(`con_engine_0${i + 1}`));

/** A Slot Group with `count` engine Slots. */
const engineGroup = (id: string, count: number) => ({ id, kinds: { engine: { count, fitList: "fl_any" } } });

const sShip = (id: string, overrides: Partial<Ship>) => ship({ id, size: "s", cargoTypes: ["container"], ...overrides });

const tieFighter = sShip("tie_fighter", {
  slots: engineSlots(2),
  stats: {
    hull: 3500,
    mass: 5,
    radarRange: 20000,
    drag: { forward: 2.5, reverse: 17, horizontal: 8, vertical: 8, pitch: 3.386, yaw: 3.386, roll: 3.386 },
    accFactors: { forward: 0.8, reverse: 1, horizontal: 3, vertical: 3 },
    maxRotationSpeed: null,
  },
  capacities: { missiles: 0, drones: 0, deployables: 5, countermeasures: 8, crew: 1, cargo: 250 },
});

const n1Stats = (forwardDrag: number) => ({
  mass: 4.3,
  drag: { forward: forwardDrag, reverse: 17, horizontal: 8, vertical: 8, pitch: 3.1, yaw: 3.1, roll: 3.1 },
  accFactors: { forward: 1, reverse: 1, horizontal: 1.7, vertical: 1.7 },
  maxRotationSpeed: null,
});

const n1 = sShip("n1", {
  slots: engineSlots(2),
  stats: { hull: 4500, radarRange: 35000, ...n1Stats(2.609) },
  capacities: { missiles: 4, drones: 0, deployables: 6, countermeasures: 8, crew: 1, cargo: 300 },
});

const n1Modified = sShip("ship_mando_s_n1", {
  slots: engineSlots(1),
  stats: { hull: 4650, radarRange: 45000, ...n1Stats(1.3) },
  capacities: { missiles: 6, drones: 0, deployables: 6, countermeasures: 8, crew: 2, cargo: 300 },
});

const evenAccFactors = { forward: 1, reverse: 1, horizontal: 1, vertical: 1 };

const gozanti = ship({
  id: "gozanti_civ_01",
  size: "m",
  slots: engineSlots(2),
  stats: {
    hull: 105000,
    mass: 45.394,
    radarRange: 40000,
    drag: { forward: 11.49, reverse: 77, horizontal: 15, vertical: 15, pitch: 22.739, yaw: 22.739, roll: 22.739 },
    accFactors: evenAccFactors,
    maxRotationSpeed: null,
  },
  capacities: { missiles: 0, drones: 0, deployables: 15, countermeasures: 16, crew: 17, cargo: 9300 },
});

const mWeaponSlot = (id: string) => ({ ...weaponSlot(id), size: "m" as const });

// Only the two weapon Slots #63 fitted.
const gozantiMiner = ship({ id: "gozanti_civ_miner", size: "m", slots: [mWeaponSlot("con_weapon_01"), mWeaponSlot("con_weapon_02")] });

const cruiser546 = ship({
  id: "imp_cruiser_546",
  size: "l",
  slotGroups: [engineGroup("engine", 3)],
  stats: {
    hull: 517000,
    mass: 265,
    radarRange: 40000,
    drag: { forward: 96.77, reverse: 387, horizontal: 140.475, vertical: 140.475, pitch: 290, yaw: 290, roll: 290 },
    accFactors: evenAccFactors,
    maxRotationSpeed: null,
  },
  capacities: { missiles: 0, drones: 14, deployables: 40, countermeasures: 25, crew: 125, cargo: 10000 },
});

const settie = ship({
  id: "cis_repair",
  size: "m",
  slots: engineSlots(2),
  stats: {
    hull: 94000,
    mass: 102.438,
    radarRange: 40000,
    drag: { forward: 10.96, reverse: 73.25, horizontal: 15, vertical: 15, pitch: 27.097, yaw: 27.097, roll: 27.097 },
    accFactors: evenAccFactors,
    maxRotationSpeed: null,
  },
  capacities: { missiles: 0, drones: 0, deployables: 20, countermeasures: 16, crew: 27, cargo: 13500 },
});

const venator = ship({
  id: "venator_01",
  size: "xl",
  slotGroups: [engineGroup("enginegroup", 4)],
  stats: {
    hull: 1540000,
    mass: 750.043,
    radarRange: 50000,
    drag: {
      forward: 296.809,
      reverse: 1185.234,
      horizontal: 311.403,
      vertical: 411.403,
      pitch: 1000.809,
      yaw: 1000.809,
      roll: 1000.809,
    },
    accFactors: evenAccFactors,
    maxRotationSpeed: null,
  },
  capacities: { missiles: 76, drones: 30, deployables: 60, countermeasures: 30, crew: 268, cargo: 34000 },
});

// Engines split across two Slot Groups in Game Data, which the game shows as one, "L1" (#50).
const aa9 = ship({
  id: "aa9_liquid",
  size: "l",
  slotGroups: [engineGroup("enginegroup", 1), engineGroup("enginegroup  ", 2)],
  stats: {
    hull: 290000,
    mass: 205.27,
    radarRange: 40000,
    drag: { forward: 75.738, reverse: 302.216, horizontal: 126.666, vertical: 126.666, pitch: 140.897, yaw: 140.897, roll: 140.897 },
    accFactors: evenAccFactors,
    maxRotationSpeed: null,
  },
});

const providence = ship({
  id: "ship_providence_carrier_01",
  size: "xl",
  slotGroups: [engineGroup("enginegroup", 1), engineGroup("enginegroup ", 2)],
  stats: {
    hull: 1705000,
    mass: 549.202,
    radarRange: 50000,
    drag: { forward: 110.84, reverse: 440.362, horizontal: 259.503, vertical: 259.503, pitch: 1100.84, yaw: 1100.84, roll: 1100.84 },
    accFactors: evenAccFactors,
    maxRotationSpeed: null,
  },
});

const equipment: Equipment[] = [
  // Engines: id, forward thrust, boost, travel.
  engine("engine_tie", 400, { thrust: 2.2, acceleration: 1.25, duration: 12, recharge: 80 }, { thrust: 8, charge: 1, attack: 10 }),
  engine("engine_n1", 450, { thrust: 2.5, acceleration: 1.25, duration: 20, recharge: 60 }, { thrust: 20, charge: 4, attack: 0 }),
  engine("engine_mando_s_n1", 520, { thrust: 6, acceleration: 4, duration: 15, recharge: 80 }, { thrust: 20, charge: 4, attack: 0 }),
  // SWI's macro has no boost@acceleration or boost@recharge: extraction gives 1 and the engine class default, 30 s.
  engine("engine_gozanti_01", 1350, { thrust: 2.7, acceleration: 1, duration: 20, recharge: 30 }, { thrust: 20.6, charge: 7, attack: 0 }),
  engine("engine_546", 5000, { thrust: 3, acceleration: 1.5, duration: 60, recharge: 60 }, { thrust: 66, charge: 19, attack: 0 }),
  engine("engine_m_boav", 1450, { thrust: 3, acceleration: 1.2, duration: 20, recharge: 50 }, { thrust: 17.5, charge: 10, attack: 0 }),
  engine("engine_l_essum", 4400, { thrust: 2, acceleration: 1.5, duration: 100, recharge: 92 }, { thrust: 54, charge: 16, attack: 0 }),
  engine("engine_venator_xl", 10000, { thrust: 3, acceleration: 1.62, duration: 30, recharge: 100 }, { thrust: 78, charge: 35, attack: 0 }),
  thruster("thruster_gen_s_allround_01_mk3", { strafe: 540, pitch: 200, yaw: 200, roll: 250 }),
  thruster("thruster_gen_m_combat_01_mk3", { strafe: 1200, pitch: 384.2, yaw: 384.2, roll: 608.3 }),
  thruster("thruster_gen_l_allround_01_mk3", { strafe: 1836, pitch: 1000, yaw: 1100, roll: 950 }),
  thruster("thruster_gen_xl_allround_01_mk3", { strafe: 3240, pitch: 2000, yaw: 2000, roll: 1500 }),
  shield("shield_s_auxtie", 900, 30, 10),
  shield("shield_s_r2astrohead", 450, 25, 0),
  shield("shield_s_tabsx", 2749, 70, 8),
  gun("weapon", "weapon_ls7_s_laser", {
    damage: { value: 150, noShield: 100 },
    fireRate: 3,
    heat: { perShot: 150, overheat: 10000, coolDelay: 1.25, coolRate: 3500 },
  }),
  gun("weapon", "weapon_kx10_s_laser", {
    damage: { value: 440, noShield: 289 },
    fireRate: 1.5,
    heat: { perShot: 450, overheat: 11000, coolDelay: 0.63, coolRate: 3000 },
  }),
  // The Seismic Mining Drill's bullet has <reload time="4"/> and no reload@rate: extraction gives 1 shot a second (#66).
  gun("weapon", "weapon_mining_drill", { damage: { value: 6, noShield: 0 }, fireRate: 1 }),
  // The Light Rocket Launcher has <storage capacity="6"/>; the Heavy Proton Torpedo Launcher has none.
  launcher("weapon", "weapon_light_rocket_launcher", "fl_rockets", 6),
  missile("missile_rocket_light", 1500, 1000, 2, 3),
  launcher("turret", "turret_m_torptube", "fl_torpedoes"),
  missile("missile_proton_heavy", 24000, 24000, 23),
];

const data = gameData([tieFighter, n1, n1Modified, gozanti, gozantiMiner, cruiser546, settie, venator, aa9, providence], equipment, [
  { id: "fl_rockets", equipment: ["missile_rocket_light"] },
  { id: "fl_torpedoes", equipment: ["missile_proton_heavy"] },
]);

// ---------------------------------------------------------------- the screen's rows

const FLIGHT = [
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
] as const;
const CAPACITIES = ["CrewCapacity", "UnitCapacity", "MissileCapacity", "DeployableCapacity", "CountermeasureCapacity"] as const;
const COMBAT = ["HullValue", "ShieldValue", "ShieldRate", "ShieldDelay", "RadarRange", "BurstDPS", "SustainedDPS", "TurretSustainedDPS"] as const;

/** The rows `ids`, shown as `values`, in order. */
function rows(ids: readonly string[], values: number[]): Record<string, number> {
  if (values.length !== ids.length) throw new Error(`${ids.length} rows, ${values.length} values`);
  return Object.fromEntries(ids.map((id, i) => [id, values[i]!]));
}

/** All 28 rows of an S Ship's screen, in the screen's order. */
const sScreen = (combat: number[], container: number, flight: number[], capacities: number[]) => ({
  ...rows(COMBAT, combat),
  ContainerCapacity: container,
  ...rows(FLIGHT, flight),
  ...rows(CAPACITIES, capacities),
});

/** The flight, radar and capacity rows #39 checked on the M, L and XL Ships. */
const flightScreen = (radar: number, flight: number[], capacities: number[]) => ({
  RadarRange: radar,
  ...rows(FLIGHT, flight),
  ...rows(CAPACITIES, capacities),
});

// ---------------------------------------------------------------- Loadouts

/** Slots `con_<kind>_01`, `_02`, ... fitted with `ids`. */
const slots = (kind: string, ids: string[]) => Object.fromEntries(ids.map((id, i) => [`con_${kind}_0${i + 1}`, id]));

describe("in game on X4 8.00 + SWI 0.9.1 HF (#39)", () => {
  const tie = (flares: number) =>
    loadout("tie_fighter", {
      engine: "engine_tie",
      slots: {
        con_shield_01: "shield_s_auxtie",
        ...slots("weapon", ["weapon_ls7_s_laser", "weapon_ls7_s_laser"]),
      },
      thruster: "thruster_gen_s_allround_01_mk3",
      consumables: { countermeasure_flares_01: flares },
    });
  const tieScreen = sScreen(
    [3500, 900, 30, 10, 20, 1500, 1266, 0],
    250,
    [320, 128, 704, 160, 12, 1.2, 2560, 256, 1, 67.5, 324, 59, 59, 73.8],
    [2, 0, 0, 5, 8],
  );

  test("TIE Fighter, 2× SFS P-s4, 8 flares: every row", () => {
    expectScreen(loadoutStats(data, tie(8)), tieScreen);
  });

  test("TIE Fighter with 3 of 8 flares: Countermeasures is the capacity, 8", () => {
    expectScreen(loadoutStats(data, tie(3)), tieScreen);
  });

  test("N-1 Starfighter, 2× J-type + Light Rocket Launcher, 10 rockets: Missiles 10 (4 + launcher's 6), output 5,937 / 5,480", () => {
    const stats = loadoutStats(
      data,
      loadout("n1", {
        engine: "engine_n1",
        slots: {
          ...slots("shield", ["shield_s_r2astrohead", "shield_s_tabsx"]),
          ...slots("weapon", ["weapon_kx10_s_laser", "weapon_kx10_s_laser", "weapon_light_rocket_launcher"]),
        },
        thruster: "thruster_gen_s_allround_01_mk3",
        consumables: { missile_rocket_light: 10, countermeasure_flares_01: 8 },
      }),
    );
    expectScreen(
      stats,
      sScreen(
        [4500, 3199, 95, 4, 35, 5937, 5480, 0],
        300,
        [344, 209, 862, 261, 20, 1.6, 6899, 209, 4, 67.5, 213.4, 64.5, 64.5, 80.6],
        [2, 0, 10, 6, 8],
      ),
    );
  });

  const n1ModifiedLoadout = (rockets: number) =>
    loadout("ship_mando_s_n1", {
      engine: "engine_mando_s_n1",
      slots: {
        con_shield_01: "shield_s_tabsx",
        ...slots("weapon", ["weapon_kx10_s_laser", "weapon_kx10_s_laser", "weapon_light_rocket_launcher"]),
      },
      thruster: "thruster_gen_s_allround_01_mk3",
      consumables: { missile_rocket_light: rockets, countermeasure_flares_01: 8 },
    });
  const n1ModifiedScreen = sScreen(
    [4650, 2749, 70, 8, 45, 5937, 5480, 0],
    300,
    [400, 120, 2400, 483, 15, 1.2, 8000, 120, 4, 67.5, 213.4, 64.5, 64.5, 80.6],
    [3, 0, 12, 6, 8],
  );

  test("N-1 Modified, 12 rockets: Boost Acceleration 483 uses boost@acceleration 4, not boost@thrust 6", () => {
    expectScreen(loadoutStats(data, n1ModifiedLoadout(12)), n1ModifiedScreen);
  });

  test("N-1 Modified with 3 of 12 rockets: Missiles and output don't depend on how many are loaded", () => {
    expectScreen(loadoutStats(data, n1ModifiedLoadout(3)), n1ModifiedScreen);
  });

  test("Gozanti-class Transport, 2× Gozanti Engine (no boost@acceleration or boost@recharge): Boost Accel 59, Recharge 3.3", () => {
    const stats = loadoutStats(
      data,
      loadout("gozanti_civ_01", {
        engine: "engine_gozanti_01",
        thruster: "thruster_gen_m_combat_01_mk3",
        consumables: { countermeasure_flares_01: 16 },
      }),
    );
    expectScreen(
      stats,
      flightScreen(40, [234, 59, 634, 59, 20, 3.3, 4840, 59, 7, 80, 26.4, 16.8, 16.8, 26.7], [18, 0, 0, 15, 16]),
    );
  });

  test("Class 546 Cruiser, 3× 546 Engine in a Slot Group, 2 of 14 drones: Units is the capacity, 14", () => {
    const stats = loadoutStats(
      data,
      loadout("imp_cruiser_546", {
        engine: "engine_546",
        thruster: "thruster_gen_l_allround_01_mk3",
        consumables: { ship_gen_xs_repairdrone_01_a: 2, countermeasure_flares_01: 25 },
      }),
    );
    expectScreen(
      stats,
      flightScreen(40, [155, 56, 465, 84, 60, 1.6, 10230, 56, 19, 13, 6.9, 3.7, 3.4, 3.2], [126, 14, 0, 40, 25]),
    );
  });

  test("Settie-class Transport, 2× SS Boav Ion Drive", () => {
    const stats = loadoutStats(
      data,
      loadout("cis_repair", {
        engine: "engine_m_boav",
        thruster: "thruster_gen_m_combat_01_mk3",
        consumables: { countermeasure_flares_01: 16 },
      }),
    );
    expectScreen(
      stats,
      flightScreen(40, [264, 28, 793, 33, 20, 2, 4630, 28, 10, 80, 11.7, 14.1, 14.1, 22.4], [28, 0, 0, 20, 16]),
    );
  });

  test("Venator-class Star Destroyer, 4× Venator-I, 2 torpedo launcher turrets: Missiles 76, the Ship's own", () => {
    const stats = loadoutStats(
      data,
      loadout("venator_01", {
        engine: "engine_venator_xl",
        groups: {
          torpedo: { turret: { equipment: "turret_m_torptube", count: 2 } },
        },
        thruster: "thruster_gen_xl_allround_01_mk3",
        consumables: { missile_proton_heavy: 76, ship_gen_xs_repairdrone_01_a: 6, countermeasure_flares_01: 30 },
      }),
    );
    expectScreen(
      stats,
      flightScreen(50, [134, 53, 404, 86, 30, 1, 10511, 53, 35, 10.4, 4.3, 1.9, 1.9, 1.4], [269, 30, 76, 60, 30]),
    );
  });
});

describe("one engine type across engine Slot Groups, in game on X4 8.00 + SWI 0.9.1 HF (#50)", () => {
  /** The engine rows, without strafe and turning, which need a thruster. */
  const engineRows = [
    "ForwardSpeed",
    "ForwardAcceleration",
    "BoostSpeed",
    "BoostAcceleration",
    "BoostMaxDuration",
    "BoostRechargeRate",
    "TravelSpeed",
    "TravelAcceleration",
    "TravelChargeTime",
  ];

  test("AA-9 Gas Miner, 3× MM Essum across two Slot Groups (1 + 2)", () => {
    const stats = loadoutStats(data, loadout("aa9_liquid", { engine: "engine_l_essum" }));
    expectScreen(stats, rows(engineRows, [174, 64, 348, 96, 100, 1, 9411, 64, 16]));
  });

  test("Providence-class carrier/destroyer, 3× MM Essum across two Slot Groups (1 + 2)", () => {
    const stats = loadoutStats(data, loadout("ship_providence_carrier_01", { engine: "engine_l_essum" }));
    expectScreen(stats, rows(engineRows, [119, 24, 238, 36, 100, 1, 6430, 24, 16]));
  });
});

/**
 * Launchers, in game on X4 8.00 + SWI 0.9.1 HF (#63). The game fires one fixed
 * missile per launcher whatever is loaded, even with none: the last compatible
 * missile by ware id. The builder fires the best loaded one instead (ADR 0002,
 * #65). Each Loadout here loads the missile the game showed, so the two rules
 * agree and the screen's value checks the formula. Only the weapon rows are
 * asserted; the Loadouts leave out engines, shields and thrusters, which they
 * don't depend on. Each launcher has its full fit list from Game Data.
 */
describe("launchers, with the missile the game showed loaded (#63, #65)", () => {
  const corsair = ship({ id: "gozanti_croc_raider", size: "m" });
  const xwing = sShip("t65b_xwing", {});
  const awing = sShip("rz1awing", {});
  const vulture = sShip("vulture_droid", {});
  const ywing = sShip("ywing_btla4", {});
  const heraklon = ship({ id: "heraklon_solid", size: "l", slotGroups: [{ id: "missile", kinds: { turret: { count: 1, fitList: "fl_any" } } }] });

  const launchers: Equipment[] = [
    launcher("weapon", "weapon_protonlauncher", "fl_krupx_medium"),
    launcher("weapon", "weapon_krupx_s_guided", "fl_krupx"),
    launcher("weapon", "weapon_hm6launcher", "fl_hm6"),
    launcher("weapon", "weapon_rackvulture", "fl_rack"),
    launcher("weapon", "weapon_flexlauncher", "fl_flex"),
    launcher("turret", "turret_m_conctubelight", "fl_conctube"),
    // Missiles: id, explosion damage, hull damage, reload.
    missile("missile_carbonite", 4500, 4000, 9),
    missile("missile_concussion_light", 5000, 1500, 4),
    missile("missile_concussion_medium", 13000, 3000, 10),
    missile("missile_discord", 1500, 3000, 10),
    missile("missile_ion_light", 2000, 0, 10),
    missile("missile_ion_medium", 3000, 0, 18),
    missile("missile_proton_light", 7000, 7000, 10),
    missile("missile_proton_medium", 12500, 12500, 18),
    // The Corsair's guns and turrets.
    gun("weapon", "weapon_kv22_m_laser", {
      damage: { value: 1428, noShield: 462 },
      fireRate: 1.2,
      magazine: { size: 2, reloadTime: 0.5 },
      heat: { perShot: 280, overheat: 10000, coolDelay: 1.13, coolRate: 3000 },
    }),
    gun("turret", "turret_m_ag2g", {
      damage: { value: 102, noShield: 34 },
      fireRate: 5,
      barrelAmount: 2,
      magazine: { size: 20, reloadTime: 3 },
    }),
    gun("turret", "turret_m_duallaser_orange", {
      damage: { value: 255, noShield: 189 },
      fireRate: 2,
      barrelAmount: 2,
      magazine: { size: 2, reloadTime: 3 },
    }),
    gun("turret", "turret_m_llaser_red", {
      damage: { value: 255, noShield: 126 },
      fireRate: 3,
      magazine: { size: 3, reloadTime: 2 },
    }),
  ];
  const launcherData = gameData([corsair, xwing, awing, vulture, ywing, heraklon], launchers, [
    { id: "fl_krupx_medium", equipment: ["missile_ion_medium", "missile_proton_medium"] },
    { id: "fl_krupx", equipment: ["missile_carbonite", "missile_concussion_light", "missile_ion_light", "missile_proton_light"] },
    { id: "fl_hm6", equipment: ["missile_carbonite", "missile_concussion_light"] },
    { id: "fl_rack", equipment: ["missile_concussion_light", "missile_discord"] },
    {
      id: "fl_flex",
      equipment: ["missile_carbonite", "missile_concussion_medium", "missile_ion_medium", "missile_proton_medium"],
    },
    { id: "fl_conctube", equipment: ["missile_concussion_light"] },
  ]);

  /** One launcher in `slot`, with `missile` loaded: the Burst / Sustained Weapon Output. */
  const oneLauncher = (shipId: string, slot: string, launcherId: string, missileId: string) =>
    loadoutStats(launcherData, loadout(shipId, { slots: { [slot]: launcherId }, consumables: { [missileId]: 4 } }));

  test("C3. Corsair, Krupx Medium + KV22, AG-2G R + OPD Dual O + 2× SL-1 R, 5 Proton: 3,133 / 2,953", () => {
    const stats = loadoutStats(
      launcherData,
      loadout("gozanti_croc_raider", {
        slots: {
          con_weapon_01: "weapon_protonlauncher",
          con_weapon_02: "weapon_kv22_m_laser",
          con_turret_01: "turret_m_ag2g",
          con_turret_02: "turret_m_duallaser_orange",
          con_m_turret_3: "turret_m_llaser_red",
          con_m_turret_4: "turret_m_llaser_red",
        },
        consumables: { missile_proton_medium: 5 },
      }),
    );
    expectScreen(stats, { BurstDPS: 3133, SustainedDPS: 2953 });
  });

  test("X1. X-wing T65B, Krupx Warhead Launcher, MG7-A Light Proton: 1,400", () => {
    const stats = oneLauncher("t65b_xwing", "con_weapon_05", "weapon_krupx_s_guided", "missile_proton_light");
    expectScreen(stats, { BurstDPS: 1400, SustainedDPS: 1400 });
  });

  test("A1. A-wing RZ1, HM-6 Launcher, ST2 Light Concussion: 1,625", () => {
    const stats = oneLauncher("rz1awing", "con_weapon_03", "weapon_hm6launcher", "missile_concussion_light");
    expectScreen(stats, { BurstDPS: 1625, SustainedDPS: 1625 });
  });

  test("V1. Vulture-class droid, Missile Rack, Discord: 450", () => {
    const stats = oneLauncher("vulture_droid", "con_primaryweapon_05", "weapon_rackvulture", "missile_discord");
    expectScreen(stats, { BurstDPS: 450, SustainedDPS: 450 });
  });

  test("Y1. Y-wing BTL-A4, Flex Tube Launcher, MG4-A Medium Proton: 1,388", () => {
    const stats = oneLauncher("ywing_btla4", "con_weapon_04", "weapon_flexlauncher", "missile_proton_medium");
    expectScreen(stats, { BurstDPS: 1388, SustainedDPS: 1388 });
  });

  test("H3. Heraklon Ore Miner, 1× Light Concussion Missile Launcher in `missile`, ST2 Light Concussion: Avg. Turret Output 270", () => {
    const stats = loadoutStats(
      launcherData,
      loadout("heraklon_solid", {
        groups: { missile: { turret: { equipment: "turret_m_conctubelight", count: 1 } } },
        consumables: { missile_concussion_light: 4 },
      }),
    );
    expectScreen(stats, { GroupedTurretSustainedDPS: 270 });
  });
});

describe("in game on X4 8.00 + SWI 0.9.1 HF (#63)", () => {
  test("Gozanti-class Miner, 2× Seismic Mining Drill (no reload@rate): Burst 12, Sustained 12, one shot a second", () => {
    const stats = loadoutStats(
      data,
      loadout("gozanti_civ_miner", { slots: { con_weapon_01: "weapon_mining_drill", con_weapon_02: "weapon_mining_drill" } }),
    );
    expectScreen(stats, { BurstDPS: 12, SustainedDPS: 12 });
  });
});
