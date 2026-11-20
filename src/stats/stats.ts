/**
 * The stats engine: Game Data plus a Loadout in, the ship configuration
 * screen's stat rows out. It is the only place stat maths lives (spec #25).
 *
 * Rows, labels, units and decimals mirror `config.stats` in the game's
 * `menu_ship_configuration.lua`; values are rounded down to the row's
 * decimals, as the screen does.
 */
import type { CargoType, Equipment, GameData } from "../gameData.ts";
import { shipEngines, type Loadout } from "../builder/loadout.ts";
import { indexGameData, type GameDataIndex } from "../gameDataIndex.ts";
import { missingMandatory, type MissingUpgrade } from "./mandatory.ts";
import { gunOutput, launcherMissile } from "./firepower.ts";

export type { MissingUpgrade } from "./mandatory.ts";
/** Per-Equipment figures for a weapon or turret, e.g. for the comparison popover. */
export { gunOutput, type GunOutput } from "./firepower.ts";
export { compareEquipment, type Comparison, type Figure, type MissileRow, type Verdict } from "./comparison.ts";

/** One stat row of the configuration screen. */
export interface StatRow {
  /** The game's `UILoadoutStatistics5` field, e.g. "ShieldRate". */
  id: string;
  label: string;
  unit: string;
  /** The raw value. */
  value: number;
  /** The value rounded down to `decimals`, as the game shows it. */
  shown: number;
  decimals: number;
  group: string;
}

export interface Price {
  min: number;
  average: number;
  max: number;
}

export interface LoadoutStats {
  rows: StatRow[];
  /** The Loadout's total price: the average is the headline, min–max the range. */
  price: Price;
  /** The mandatory upgrades the Loadout lacks, in Loadout table order. */
  missing: MissingUpgrade[];
}

/** The game's storage rows, in its order, by cargo type. */
const STORAGE_ROWS: [CargoType, string, string][] = [
  ["container", "ContainerCapacity", "Container Storage"],
  ["solid", "SolidCapacity", "Solid Storage"],
  ["liquid", "LiquidCapacity", "Liquid Storage"],
  ["condensate", "CondensateCapacity", "Condensate Storage"],
];

/** Rounds down to `decimals` places, like the game's `Helper.floor`. */
function floorTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.floor(value * scale) / scale;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length);

export function loadoutStats(gameData: GameData, loadout: Loadout): LoadoutStats {
  const index = indexGameData(gameData);
  const ship = index.ships.get(loadout.ship);
  if (!ship) throw new Error(`Unknown Ship ${loadout.ship}`);
  const { equipment } = index;
  const ofKind = <K extends Equipment["kind"]>(id: string, kind: K) => {
    const item = equipment.get(id);
    return item?.kind === kind ? (item as Extract<Equipment, { kind: K }>) : undefined;
  };

  const shields = Object.values(loadout.slots ?? {}).flatMap((id) => ofKind(id, "shield") ?? []);

  const rows: StatRow[] = [];
  const add = (id: string, label: string, unit: string, decimals: number, group: string, value: number) =>
    rows.push({ id, label, unit, value, shown: floorTo(value, decimals), decimals, group });

  add("HullValue", "Hull", "MJ", 0, "combat", ship.stats.hull);
  add("ShieldValue", "Shield", "MJ", 0, "combat", sum(shields.map((s) => s.capacity)));
  add("ShieldRate", "Recharge Rate", "MW", 0, "combat", sum(shields.map((s) => s.rechargeRate)));
  add("ShieldDelay", "Recharge Delay", "s", 2, "combat", mean(shields.map((s) => s.rechargeDelay)));

  // Each Slot Group with a shield fitted counts once: the sum of its own
  // generators. Empty groups are left out of the average (#22, #63).
  const groupShields = Object.values(loadout.groups ?? {}).flatMap((kinds) => {
    const entry = kinds.shield;
    const item = entry && ofKind(entry.equipment, "shield");
    return item && entry.count > 0
      ? [{ capacity: item.capacity * entry.count, rate: item.rechargeRate * entry.count, delay: item.rechargeDelay }]
      : [];
  });
  // Only L/XL Ships have shield Slot Groups, so only they get these rows (story 31).
  const capShip = ship.size === "l" || ship.size === "xl";
  if (capShip) {
    add("GroupedShieldValue", "Avg. Group Shield", "MJ", 0, "combat", mean(groupShields.map((g) => g.capacity)));
    add("GroupedShieldRate", "Recharge Rate", "MW", 0, "combat", mean(groupShields.map((g) => g.rate)));
    add("GroupedShieldDelay", "Recharge Delay", "s", 2, "combat", mean(groupShields.map((g) => g.delay)));
  }
  add("RadarRange", "Radar Range", "km", 0, "combat", ship.stats.radarRange / 1000);

  /** Every fitted weapon and turret: weapons only fit Slots; Slot Group turrets count once per count. */
  const fittedGuns = [
    ...Object.values(loadout.slots ?? {}).map((id): [string, number] => [id, 1]),
    ...Object.values(loadout.groups ?? {}).flatMap((kinds): [string, number][] =>
      kinds.turret ? [[kinds.turret.equipment, kinds.turret.count]] : [],
    ),
  ].flatMap(([id, count]) => {
    const item = ofKind(id, "weapon") ?? ofKind(id, "turret");
    return item ? [{ item, count }] : [];
  });
  const output = (gun: Extract<Equipment, { kind: "weapon" | "turret" }>) =>
    gunOutput(gun, launcherMissile(gun, loadout.consumables ?? {}, index));
  const forward = fittedGuns.flatMap(({ item }) => (item.kind === "weapon" ? [output(item)] : []));
  add("BurstDPS", "Burst Weapon Output", "MW", 0, "combat", sum(forward.map((o) => o.burst)));
  add("SustainedDPS", "Sustained Weapon Output", "MW", 0, "combat", sum(forward.map((o) => o.sustained)));

  // Avg. Turret Output: every turret's output, Slot Group turrets included,
  // over a flat six directions (#12). Its rate of fire already counts
  // magazine reloads; heat isn't applied, as confirmed in game. L/XL Ships
  // show it as the game's grouped field, with the same formula. Both rows are
  // confirmed in game: the Corsair's C1 and C2, the Heraklon's H1 and H2 (#63, #67).
  const turrets = fittedGuns.flatMap(({ item, count }) => (item.kind === "turret" ? [output(item).burst * count] : []));
  const turretId = capShip ? "GroupedTurretSustainedDPS" : "TurretSustainedDPS";
  add(turretId, "Avg. Turret Output", "MW", 0, "combat", sum(turrets) / 6);

  // The game's storage rows, for the cargo types the Ship takes. Game Data
  // holds the Ship's total capacity; each type's row shows it, which is right
  // when every storage takes the same types, as #63 saw; extraction warns otherwise.
  // unconfirmed (#71): no Ship in Game Data has storages of mixed types or takes condensate.
  for (const [type, id, label] of STORAGE_ROWS) {
    if (ship.cargoTypes.includes(type)) add(id, label, "m³", 0, "storage", ship.capacities.cargo);
  }

  // Flight (#12, #39). One engine type fills all of the Ship's engines (#50, ADR 0001).
  const fittedEngine = loadout.engine ? ofKind(loadout.engine, "engine") : undefined;
  const engineCount = fittedEngine ? (shipEngines(ship)?.count ?? 0) : 0;
  const { drag, mass, accFactors, maxRotationSpeed } = ship.stats;
  type Engine = Extract<Equipment, { kind: "engine" }>;
  /** Σ engine forward thrust: the engine's thrust, scaled by `factor`, times the engine count. */
  const thrust = (factor: (e: Engine) => number = () => 1) =>
    fittedEngine ? fittedEngine.thrust.forward * factor(fittedEngine) * engineCount : 0;
  /** A property of the fitted engine, or 0 with none. */
  const ofEngine = (pick: (e: Engine) => number) => (fittedEngine && engineCount > 0 ? pick(fittedEngine) : 0);
  const acceleration = (thrust() / mass) * accFactors.forward;
  const travelSpeed = thrust((e) => e.travel.thrust) / drag.forward;
  const travelAttack = ofEngine((e) => e.travel.attack);
  const boostRecharge = ofEngine((e) => e.boost.recharge);
  add("ForwardSpeed", "Speed", "m/s", 0, "flight", thrust() / drag.forward);
  add("ForwardAcceleration", "Acceleration", "m/s²", 0, "flight", acceleration);
  add("BoostSpeed", "Boost Speed", "m/s", 0, "flight", thrust((e) => e.boost.thrust) / drag.forward);
  add(
    "BoostAcceleration",
    "Boost Acceleration",
    "m/s²",
    0,
    "flight",
    (thrust((e) => e.boost.acceleration) / mass) * accFactors.forward,
  );
  add("BoostMaxDuration", "Boost Capacity", "s", 1, "flight", ofEngine((e) => e.boost.duration));
  // `boost@recharge` is the seconds for a full recharge.
  add("BoostRechargeRate", "Boost Recharge Rate", "%/s", 1, "flight", boostRecharge > 0 ? 100 / boostRecharge : 0);
  add("TravelSpeed", "Travel Speed", "m/s", 0, "flight", travelSpeed);
  // `travel@attack="0"` leaves acceleration unchanged (#12); otherwise it is the
  // seconds to reach travel speed (#39: the TIE Fighter's 2,560 / 10 = 256).
  add(
    "TravelAcceleration",
    "Travel Acceleration",
    "m/s²",
    0,
    "flight",
    travelAttack > 0 ? travelSpeed / travelAttack : acceleration,
  );
  add("TravelChargeTime", "Travel Charge Time", "s", 1, "flight", ofEngine((e) => e.travel.charge));

  const thrusterItem = loadout.thruster ? ofKind(loadout.thruster, "thruster") : undefined;
  const strafe = thrusterItem?.thrust.strafe ?? 0;
  add("HorizontalStrafeSpeed", "Strafe Speed", "m/s", 1, "flight", strafe / drag.horizontal);
  add("HorizontalStrafeAcceleration", "Strafe Acceleration", "m/s²", 1, "flight", (strafe / mass) * accFactors.horizontal);
  for (const [id, label, axis] of [
    ["YawSpeed", "Yaw", "yaw"],
    ["PitchSpeed", "Pitch", "pitch"],
    ["RollSpeed", "Roll", "roll"],
  ] as const) {
    // unconfirmed (#71): no Ship in Game Data sets the `rotationspeed@max` cap.
    const speed = Math.min((thrusterItem?.thrust[axis] ?? 0) / drag[axis], maxRotationSpeed ?? Infinity);
    add(id, label, "°/s", 1, "flight", turningInDegrees(speed));
  }

  add("CrewCapacity", "Crew", "", 0, "crew", ship.capacities.crew + 1);
  add("UnitCapacity", "Units", "", 0, "crew", ship.capacities.drones);
  // A launcher's own storage adds to the Ship's (#39: the Light Rocket Launcher's 6).
  // unconfirmed (#71): times the count for a Slot Group launcher. No launcher with
  // storage fits a Slot Group in Game Data.
  const launcherStorage = sum(fittedGuns.map(({ item, count }) => item.missileStorage * count));
  add("MissileCapacity", "Missiles", "", 0, "crew", ship.capacities.missiles + launcherStorage);
  add("DeployableCapacity", "Deployables", "", 0, "crew", ship.capacities.deployables);
  add("CountermeasureCapacity", "Countermeasures", "", 0, "crew", ship.capacities.countermeasures);

  return {
    rows,
    price: price(ship.price, loadout, engineCount, index),
    missing: missingMandatory(gameData, ship, loadout),
  };
}

/**
 * Thrust / drag comes out in °/s, but the engine hands the UI a float32 in
 * rad/s, which the Lua turns back into °/s. The round trip is why the
 * X-wing's 40 shows as 39.9 (#12).
 */
function turningInDegrees(degreesPerSecond: number): number {
  return (Math.fround((degreesPerSecond * Math.PI) / 180) * 180) / Math.PI;
}

/**
 * Ship + Equipment (the engine once per engine) + consumables + software, each at its min, average and max.
 * The game's total is the sum of the same lines, confirmed in game by the #63 reference row.
 * Differs from the game on purpose (ADR 0003): each line is at Game Data's average with
 * min–max as the range, not the station's price, and crew is left out.
 */
function price(shipPrice: Price, loadout: Loadout, engineCount: number, { equipment }: GameDataIndex): Price {
  const bought: [string, number][] = [
    ...Object.values(loadout.slots ?? {}).map((id): [string, number] => [id, 1]),
    ...Object.values(loadout.groups ?? {}).flatMap((kinds) =>
      Object.values(kinds).map((e): [string, number] => [e.equipment, e.count]),
    ),
    ...(loadout.engine ? [[loadout.engine, engineCount] as [string, number]] : []),
    ...(loadout.thruster ? [[loadout.thruster, 1] as [string, number]] : []),
    ...(loadout.software ?? []).map((id): [string, number] => [id, 1]),
    ...Object.entries(loadout.consumables ?? {}),
  ];
  const total = { ...shipPrice };
  for (const [id, count] of bought) {
    const item = equipment.get(id);
    if (!item) continue;
    total.min += item.price.min * count;
    total.average += item.price.average * count;
    total.max += item.price.max * count;
  }
  return total;
}
