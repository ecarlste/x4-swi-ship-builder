/**
 * Hand-made Game Data and Loadouts for Loadout and stats engine tests. Names are made up; numbers are
 * copied from the in-game reference cases (#12, #22) as plain values.
 */
import type { Equipment, FitList, GameData, Ship, Slot, SlotGroup } from "../../gameData.ts";
import { LOADOUT_FORMAT, type Loadout } from "../loadout.ts";

const tradeable = (id: string) => ({
  id,
  name: id,
  nameId: `{1,${id}}`,
  price: { min: 0, average: 0, max: 0 },
  licence: null,
  sellers: ["fx_guild"],
});

export function ship(overrides: Partial<Ship> & { slots?: Slot[]; slotGroups?: SlotGroup[] } = {}): Ship {
  return {
    ...tradeable("fx_ship"),
    size: "m",
    type: "fighter",
    purpose: "fight",
    stats: {
      hull: 1000,
      mass: 10,
      radarRange: 20000,
      drag: { forward: 5, reverse: 10, horizontal: 4, vertical: 4, pitch: 1.5, yaw: 1.5, roll: 1.2 },
      accFactors: { forward: 1, reverse: 1, horizontal: 1, vertical: 1 },
      maxRotationSpeed: null,
    },
    capacities: { missiles: 0, drones: 0, deployables: 0, countermeasures: 0, crew: 0, cargo: 0 },
    cargoTypes: [],
    slots: [],
    slotGroups: [],
    thrusters: "fl_any",
    software: { fitList: "fl_any", mandatory: [] },
    drones: "fl_any",
    deployables: "fl_any",
    countermeasures: "fl_any",
    ...overrides,
  };
}

export const shieldSlot = (id: string): Slot => ({ id, kind: "shield", size: "s", mandatory: false, fitList: "fl_any" });

export const shieldGroup = (id: string, count: number): SlotGroup => ({
  id,
  kinds: { shield: { count, fitList: "fl_any" } },
});

export function shield(id: string, capacity: number, rechargeRate: number, rechargeDelay: number): Equipment {
  return { kind: "shield", ...tradeable(id), size: "s", capacity, rechargeRate, rechargeDelay };
}

export const weaponSlot = (id: string): Slot => ({ id, kind: "weapon", size: "s", mandatory: false, fitList: "fl_any" });

export const turretSlot = (id: string): Slot => ({ id, kind: "turret", size: "m", mandatory: false, fitList: "fl_any" });

export const turretGroup = (id: string, count: number): SlotGroup => ({
  id,
  kinds: { turret: { count, fitList: "fl_any" } },
});

type Gun = Extract<Equipment, { kind: "weapon" | "turret" }>;

/** A weapon or turret from its bullet's raw inputs; no magazine, heat or missiles unless given. */
export function gun(
  kind: "weapon" | "turret",
  id: string,
  inputs: Pick<Gun, "damage" | "fireRate"> & Partial<Pick<Gun, "barrelAmount" | "magazine" | "heat">>,
): Gun {
  return {
    kind,
    ...tradeable(id),
    size: "s",
    barrelAmount: 1,
    magazine: null,
    heat: null,
    missiles: null,
    missileStorage: 0,
    ...inputs,
  };
}

/** A missile launcher that fires the missiles of the fit list `missiles`, with its own missile storage. */
export function launcher(kind: "weapon" | "turret", id: string, missiles: string, missileStorage = 0): Gun {
  return { ...gun(kind, id, { damage: { value: 0, noShield: 0, hull: 0 }, fireRate: 1 }), missiles, missileStorage };
}

export function missile(
  id: string,
  explosionDamage: number,
  hullDamage: number,
  reloadTime: number,
  barrelAmount = 1,
): Equipment {
  return { kind: "missile", ...tradeable(id), explosionDamage, hullDamage, barrelAmount, reloadTime };
}

/** The Software Family name fixture software carries. */
const FAMILY_NAME = "Fixture Software";

/** A piece of Equipment of a kind with no stats of its own, at a price. */
export function priced(
  kind: "software" | "drone" | "deployable" | "countermeasure",
  id: string,
  price: { min: number; average: number; max: number },
): Equipment {
  return kind === "software" ? { kind, ...tradeable(id), price, predecessor: null, familyName: FAMILY_NAME } : { kind, ...tradeable(id), price };
}

/** Software that replaces `predecessor` in its Software Family, at a price. */
export function software(
  id: string,
  predecessor: string | null = null,
  price = { min: 0, average: 0, max: 0 },
): Equipment {
  return { kind: "software", ...tradeable(id), price, predecessor, familyName: FAMILY_NAME };
}

export function gameData(ships: Ship[], equipment: Equipment[] = [], fitLists: FitList[] = []): GameData {
  return {
    manifest: {
      swi: { version: "091", label: "0.9.1 HF", date: "2026-01-01" },
      x4: { version: "8.00" },
      dlcs: [],
      extractedAt: "2026-01-01T00:00:00Z",
      pipelineCommit: "test",
      contentHash: "test",
    },
    ships,
    equipment,
    fitLists: [{ id: "fl_any", equipment: equipment.map((e) => e.id) }, ...fitLists],
    factions: [{ id: "fx_guild", name: "Fixture Guild" }],
    licences: [],
    crewPrice: { min: 5000, average: 7500, max: 10000 },
  };
}

export function loadout(shipId: string, parts: Omit<Loadout, "format" | "gameData" | "ship"> = {}): Loadout {
  return { format: LOADOUT_FORMAT, gameData: { swi: "091", x4: "8.00" }, ship: shipId, ...parts };
}

// ---------------------------------------------------------------- flight

export const engineSlot = (id: string): Slot => ({ id, kind: "engine", size: "s", mandatory: false, fitList: "fl_any" });

export function engine(
  id: string,
  forward: number,
  boost: { thrust: number; acceleration: number; duration: number; recharge: number },
  travel: { thrust: number; charge: number; attack: number },
): Equipment {
  return { kind: "engine", ...tradeable(id), size: "s", thrust: { forward, reverse: forward }, boost, travel };
}

export function thruster(id: string, thrust: { strafe: number; pitch: number; yaw: number; roll: number }): Equipment {
  return { kind: "thruster", ...tradeable(id), size: "s", thrust };
}
