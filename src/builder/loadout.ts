/**
 * The Loadout being built, in the sparse shape the Loadout codec will
 * serialize (spec #25, decided in #9): keyed by game ids, with empty entries
 * left out, so an Empty Loadout is `{ format, gameData, ship }`.
 */
import type { GameData, Ship } from "../gameData.ts";

export const LOADOUT_FORMAT = 1;

export type SlotGroupKind = "turret" | "shield" | "engine";

export interface Loadout {
  format: typeof LOADOUT_FORMAT;
  gameData: { swi: string; x4: string };
  /** The Ship's ware id. */
  ship: string;
  /** Connection name → Equipment ware id. */
  slots?: Record<string, string>;
  /** Group name → kind → the Equipment fitted and how many of the group's Slots it fills. */
  groups?: Record<string, Partial<Record<SlotGroupKind, { equipment: string; count: number }>>>;
  /** The thruster's ware id. */
  thruster?: string;
  /** Software ware ids. */
  software?: string[];
  /** Consumable ware id → count. */
  consumables?: Record<string, number>;
}

/** A freshly picked Ship, with nothing fitted. */
export function emptyLoadout(gameData: GameData, ship: Ship): Loadout {
  return {
    format: LOADOUT_FORMAT,
    gameData: { swi: gameData.manifest.swi.version, x4: gameData.manifest.x4.version },
    ship: ship.id,
  };
}

/** Drops an optional key when its value is empty, keeping the Loadout sparse. */
function withEntry<K extends "slots" | "groups" | "thruster" | "software" | "consumables">(
  loadout: Loadout,
  key: K,
  value: Loadout[K] | undefined,
): Loadout {
  const { [key]: _old, ...rest } = loadout;
  const empty =
    value === undefined ||
    (Array.isArray(value) ? value.length === 0 : typeof value === "object" && Object.keys(value).length === 0);
  return (empty ? rest : { ...rest, [key]: value }) as unknown as Loadout;
}

function withoutKey<T>(record: Record<string, T> | undefined, key: string): Record<string, T> {
  const { [key]: _old, ...rest } = record ?? {};
  return rest;
}

/** Fits Equipment to a Slot, or empties it with null. */
export function setSlot(loadout: Loadout, slotId: string, equipment: string | null): Loadout {
  const slots = withoutKey(loadout.slots, slotId);
  if (equipment) slots[slotId] = equipment;
  return withEntry(loadout, "slots", slots);
}
