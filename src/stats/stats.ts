/**
 * The stats engine: Game Data plus a Loadout in, the ship configuration
 * screen's stat rows out. It is the only place stat maths lives (spec #25).
 *
 * Rows, labels, units and decimals mirror `config.stats` in the game's
 * `menu_ship_configuration.lua`; values are rounded down to the row's
 * decimals, as the screen does.
 */
import type { Equipment, GameData } from "../gameData.ts";
import type { Loadout } from "../builder/loadout.ts";
import { missingMandatory, type MissingUpgrade } from "./mandatory.ts";

export type { MissingUpgrade } from "./mandatory.ts";

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

/** Rounds down to `decimals` places, like the game's `Helper.floor`. */
function floorTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.floor(value * scale) / scale;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length);

export function loadoutStats(gameData: GameData, loadout: Loadout): LoadoutStats {
  const ship = gameData.ships.find((s) => s.id === loadout.ship);
  if (!ship) throw new Error(`Unknown Ship ${loadout.ship}`);
  const equipment = new Map(gameData.equipment.map((e) => [e.id, e]));
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
  // generators. Empty groups are left out of the average (#22).
  const groupShields = Object.values(loadout.groups ?? {}).flatMap((kinds) => {
    const entry = kinds.shield;
    const item = entry && ofKind(entry.equipment, "shield");
    return item && entry.count > 0
      ? [{ capacity: item.capacity * entry.count, rate: item.rechargeRate * entry.count, delay: item.rechargeDelay }]
      : [];
  });
  add("GroupedShieldValue", "Avg. Group Shield", "MJ", 0, "combat", mean(groupShields.map((g) => g.capacity)));
  add("GroupedShieldRate", "Recharge Rate", "MW", 0, "combat", mean(groupShields.map((g) => g.rate)));
  add("GroupedShieldDelay", "Recharge Delay", "s", 2, "combat", mean(groupShields.map((g) => g.delay)));
  add("RadarRange", "Radar Range", "km", 0, "combat", ship.stats.radarRange / 1000);

  // The game splits storage into container, solid, liquid and condensate
  // rows; Game Data holds one cargo capacity, so it is one row here.
  add("CargoCapacity", "Cargo", "m³", 0, "storage", ship.capacities.cargo);

  // Flight (#12). Engines in Slots count once, engines in Slot Groups once per count.
  const engines = [
    ...Object.values(loadout.slots ?? {}).flatMap((id) => {
      const item = ofKind(id, "engine");
      return item ? [{ item, count: 1 }] : [];
    }),
    ...Object.values(loadout.groups ?? {}).flatMap((kinds) => {
      const item = kinds.engine && ofKind(kinds.engine.equipment, "engine");
      return item && kinds.engine ? [{ item, count: kinds.engine.count }] : [];
    }),
  ];
  const { drag, mass, accFactors, maxRotationSpeed } = ship.stats;
  type Engine = Extract<Equipment, { kind: "engine" }>;
  /** Σ engine forward thrust, each engine's thrust scaled by `factor`. */
  const thrust = (factor: (e: Engine) => number = () => 1) =>
    sum(engines.map(({ item, count }) => item.thrust.forward * factor(item) * count));
  /** An engine property averaged over the fitted engines (they are normally all alike), or 0 with none. */
  const perEngine = (pick: (e: Engine) => number) =>
    mean(engines.flatMap(({ item, count }) => Array<number>(count).fill(pick(item))));
  const acceleration = (thrust() / mass) * accFactors.forward;
  const travelSpeed = thrust((e) => e.travel.thrust) / drag.forward;
  const travelAttack = perEngine((e) => e.travel.attack);
  const boostRecharge = perEngine((e) => e.boost.recharge);
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
  add("BoostMaxDuration", "Boost Capacity", "s", 1, "flight", perEngine((e) => e.boost.duration));
  // `boost@recharge` is the seconds for a full recharge.
  add("BoostRechargeRate", "Boost Recharge Rate", "%/s", 1, "flight", boostRecharge > 0 ? 100 / boostRecharge : 0);
  add("TravelSpeed", "Travel Speed", "m/s", 0, "flight", travelSpeed);
  // Checked in game only for `travel@attack="0"` (acceleration unchanged). Otherwise taken as
  // the seconds to reach travel speed, which is unconfirmed.
  add(
    "TravelAcceleration",
    "Travel Acceleration",
    "m/s²",
    0,
    "flight",
    travelAttack > 0 ? travelSpeed / travelAttack : acceleration,
  );
  add("TravelChargeTime", "Travel Charge Time", "s", 1, "flight", perEngine((e) => e.travel.charge));

  const thrusterItem = loadout.thruster ? ofKind(loadout.thruster, "thruster") : undefined;
  const strafe = thrusterItem?.thrust.strafe ?? 0;
  add("HorizontalStrafeSpeed", "Strafe Speed", "m/s", 1, "flight", strafe / drag.horizontal);
  add("HorizontalStrafeAcceleration", "Strafe Acceleration", "m/s²", 1, "flight", (strafe / mass) * accFactors.horizontal);
  for (const [id, label, axis] of [
    ["YawSpeed", "Yaw", "yaw"],
    ["PitchSpeed", "Pitch", "pitch"],
    ["RollSpeed", "Roll", "roll"],
  ] as const) {
    const speed = Math.min((thrusterItem?.thrust[axis] ?? 0) / drag[axis], maxRotationSpeed ?? Infinity);
    add(id, label, "°/s", 1, "flight", turningInDegrees(speed));
  }

  add("CrewCapacity", "Crew", "", 0, "crew", ship.capacities.crew + 1);
  add("UnitCapacity", "Units", "", 0, "crew", ship.capacities.drones);
  add("MissileCapacity", "Missiles", "", 0, "crew", ship.capacities.missiles);
  add("DeployableCapacity", "Deployables", "", 0, "crew", ship.capacities.deployables);
  add("CountermeasureCapacity", "Countermeasures", "", 0, "crew", ship.capacities.countermeasures);

  return {
    rows,
    price: price(ship.price, loadout, equipment),
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

/** Ship + Equipment + consumables + software, each at its min, average and max. */
function price(shipPrice: Price, loadout: Loadout, equipment: Map<string, Equipment>): Price {
  const bought: [string, number][] = [
    ...Object.values(loadout.slots ?? {}).map((id): [string, number] => [id, 1]),
    ...Object.values(loadout.groups ?? {}).flatMap((kinds) =>
      Object.values(kinds).map((e): [string, number] => [e.equipment, e.count]),
    ),
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
