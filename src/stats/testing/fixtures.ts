/**
 * Hand-made Game Data for stats engine tests. Names are made up; numbers are
 * copied from the in-game reference cases (#12, #22) as plain values.
 */
import type { Equipment, GameData, Ship, Slot, SlotGroup } from "../../gameData.ts";
import { LOADOUT_FORMAT, type Loadout } from "../../builder/loadout.ts";

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

/** A piece of Equipment of a kind with no stats of its own, at a price. */
export function priced(
  kind: "software" | "drone" | "deployable" | "countermeasure",
  id: string,
  price: { min: number; average: number; max: number },
): Equipment {
  return { kind, ...tradeable(id), price };
}

export function gameData(ships: Ship[], equipment: Equipment[] = []): GameData {
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
    fitLists: [{ id: "fl_any", equipment: equipment.map((e) => e.id) }],
    factions: [{ id: "fx_guild", name: "Fixture Guild" }],
    licences: [],
  };
}

export function loadout(shipId: string, parts: Omit<Loadout, "format" | "gameData" | "ship"> = {}): Loadout {
  return { format: LOADOUT_FORMAT, gameData: { swi: "091", x4: "8.00" }, ship: shipId, ...parts };
}
