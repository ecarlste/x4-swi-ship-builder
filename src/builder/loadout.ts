/**
 * Edits to the Loadout being built, in the sparse shape the Loadout codec
 * serializes (spec #25, decided in #9): keyed by game ids, with empty entries
 * left out, so an Empty Loadout is `{ format, gameData, ship }`.
 */
import type { Equipment, GameData, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { engineParts } from "../../shared/game-data/engines.ts";
import { LOADOUT_FORMAT, type Loadout, type SlotGroupKind } from "../codec/loadout.ts";

export { LOADOUT_FORMAT, type Loadout, type SlotGroupKind } from "../codec/loadout.ts";

/** A freshly picked Ship, with nothing fitted. */
export function emptyLoadout(gameData: GameData, ship: Ship): Loadout {
  return {
    format: LOADOUT_FORMAT,
    gameData: { swi: gameData.manifest.swi.version, x4: gameData.manifest.x4.version },
    ship: ship.id,
  };
}

/** Drops an optional key when its value is empty, keeping the Loadout sparse. */
function withEntry<K extends "slots" | "groups" | "engine" | "thruster" | "software" | "consumables" | "crew">(
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

/** Sets a consumable's count; 0 removes it. */
export function setConsumable(loadout: Loadout, equipment: string, count: number): Loadout {
  const consumables = withoutKey(loadout.consumables, equipment);
  if (count > 0) consumables[equipment] = count;
  return withEntry(loadout, "consumables", consumables);
}

/** One of the Crew's two counts. */
export type CrewRole = keyof NonNullable<Loadout["crew"]>;

/**
 * Sets one Crew count; 0 removes it, and with both at 0 the Loadout has no
 * Crew (ADR 0004). It doesn't check the Ship's crew capacity: the UI offers
 * only counts that fit.
 */
export function setCrew(loadout: Loadout, role: CrewRole, count: number): Loadout {
  const { [role]: _old, ...crew } = loadout.crew ?? {};
  return withEntry(loadout, "crew", count > 0 ? { ...crew, [role]: count } : crew);
}

export type ConsumableKind = "missile" | "drone" | "deployable" | "countermeasure";

/** One kind of consumable the Ship can carry: its capacity and the items it can take. */
export interface ConsumableOptions {
  kind: ConsumableKind;
  capacity: number;
  items: Equipment[];
}

/**
 * The consumables this Loadout can carry, by kind. Missiles are those a
 * fitted launcher (in a Slot or a Slot Group) can fire; the rest come from
 * the Ship's fit lists. Kinds the Ship has no capacity for are left out.
 */
export function consumableOptions(gameData: GameData, ship: Ship, loadout: Loadout): ConsumableOptions[] {
  const { equipment, fitLists } = indexGameData(gameData);
  const items = (fitListIds: Iterable<string>) =>
    [...new Set([...fitListIds].flatMap((id) => fitLists.get(id) ?? []))]
      .flatMap((id) => equipment.get(id) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name));

  const fittedIds = [
    ...Object.values(loadout.slots ?? {}),
    ...Object.values(loadout.groups ?? {}).flatMap((kinds) => Object.values(kinds).map((e) => e.equipment)),
  ];
  const missileLists = fittedIds.flatMap((id) => {
    const item = equipment.get(id);
    return (item?.kind === "weapon" || item?.kind === "turret") && item.missiles ? [item.missiles] : [];
  });

  const all: ConsumableOptions[] = [
    { kind: "missile", capacity: ship.capacities.missiles, items: items(missileLists) },
    { kind: "drone", capacity: ship.capacities.drones, items: items([ship.drones]) },
    { kind: "deployable", capacity: ship.capacities.deployables, items: items([ship.deployables]) },
    { kind: "countermeasure", capacity: ship.capacities.countermeasures, items: items([ship.countermeasures]) },
  ];
  return all.filter((o) => o.capacity > 0 && o.items.length > 0);
}

/**
 * Removes consumables the Loadout can no longer carry, such as missiles whose
 * launcher was just removed.
 */
export function withoutUncarriedConsumables(gameData: GameData, ship: Ship, loadout: Loadout): Loadout {
  const carried = new Set(consumableOptions(gameData, ship, loadout).flatMap((o) => o.items.map((e) => e.id)));
  const consumables = Object.fromEntries(
    Object.entries(loadout.consumables ?? {}).filter(([id]) => carried.has(id)),
  );
  return withEntry(loadout, "consumables", consumables);
}

/**
 * How many engines the Ship takes and the fit list they come from: its engine
 * Slots plus the sizes of all its engine Slot Groups, which in game take one
 * engine type between them (ADR 0001). Null for a Ship with no engines.
 * Game Data integrity guarantees they all share one fit list.
 */
export function shipEngines(ship: Ship): { count: number; fitList: string } | null {
  const [first, ...rest] = engineParts(ship);
  if (!first) return null;
  return { count: rest.reduce((sum, p) => sum + p.count, first.count), fitList: first.fitList };
}

/** Fits one engine to all of the Ship's engines, or removes them with null. */
export function setEngine(loadout: Loadout, equipment: string | null): Loadout {
  return withEntry(loadout, "engine", equipment ?? undefined);
}

/** Fits the thruster, or removes it with null. */
export function setThruster(loadout: Loadout, equipment: string | null): Loadout {
  return withEntry(loadout, "thruster", equipment ?? undefined);
}

/** Adds or removes one piece of software. */
export function setSoftware(loadout: Loadout, equipment: string, fitted: boolean): Loadout {
  const software = (loadout.software ?? []).filter((id) => id !== equipment);
  if (fitted) software.push(equipment);
  return withEntry(loadout, "software", software);
}

/**
 * Sets one kind of a Slot Group: the Equipment and how many of the group's
 * Slots it fills. Null, or a count of 0, empties it.
 */
export function setGroup(
  loadout: Loadout,
  groupId: string,
  kind: SlotGroupKind,
  entry: { equipment: string; count: number } | null,
): Loadout {
  const kinds = { ...loadout.groups?.[groupId] };
  delete kinds[kind];
  if (entry && entry.count > 0) kinds[kind] = entry;
  const groups = withoutKey(loadout.groups, groupId);
  if (Object.keys(kinds).length > 0) groups[groupId] = kinds;
  return withEntry(loadout, "groups", groups);
}
