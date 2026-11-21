/**
 * The Loadout's rules, bound to one Ship: every fit and capacity rule lives in
 * these edits, so a Loadout built only through them always fits its Ship.
 *
 * Each edit takes a Loadout and gives back `{ loadout, repairs }`: a count over
 * a limit is clamped and reported as a clamp; Equipment that isn't on the fit
 * list, or a Slot or Slot Group the Ship doesn't have, is refused and reported
 * as a drop, leaving the place as it was. Edits never throw. The Loadout
 * stays plain, immutable data.
 *
 * The queries say what each place can take and its limit, which for a place
 * that shares a capacity is what the others leave.
 */
import type { Equipment, GameData, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import {
  CREW_ROLE_NAMES,
  crewCount,
  shipEngines,
  type ConsumableKind,
  type CrewRole,
  type Loadout,
  type SlotGroupKind,
} from "./loadout.ts";
import type { DropReason, EquipmentPlace, LoadoutRepair, Place } from "./repairs.ts";

/** What an edit gives back: the edited Loadout and every Repair it made. */
export interface Edit {
  loadout: Loadout;
  repairs: LoadoutRepair[];
}

/** One kind of consumable the Ship can carry: its capacity and the items it can take. */
export interface ConsumableOptions {
  kind: ConsumableKind;
  capacity: number;
  items: Equipment[];
}

type Keyed = "slots" | "groups" | "engine" | "thruster" | "software" | "consumables" | "crew";

/** Drops an optional key when its value is empty, keeping the Loadout sparse. */
function withEntry<K extends Keyed>(loadout: Loadout, key: K, value: Loadout[K] | undefined): Loadout {
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

/** Sets one kind of a Slot Group's entry, or removes it with null. */
function withGroup(
  loadout: Loadout,
  groupId: string,
  kind: SlotGroupKind,
  entry: { equipment: string; count: number } | null,
): Loadout {
  const kinds = { ...loadout.groups?.[groupId] };
  delete kinds[kind];
  if (entry) kinds[kind] = entry;
  const groups = withoutKey(loadout.groups, groupId);
  if (Object.keys(kinds).length > 0) groups[groupId] = kinds;
  return withEntry(loadout, "groups", groups);
}

/** An edit that needed no Repair. */
const noRepairs = (loadout: Loadout): Edit => ({ loadout, repairs: [] });

/** A count as a whole number: a fraction is cut to the whole number below it, and anything not finite is 0. */
const wholeCount = (count: number) => (Number.isFinite(count) ? Math.floor(count) : 0);

/** The Loadout's rules for one Ship. The Ship is indexed once, here. */
export function loadoutRules(gameData: GameData, ship: Ship) {
  const { equipment, fits, fitListEquipment } = indexGameData(gameData);
  const nameOf = (id: string) => equipment.get(id)?.name ?? id;
  // Engine Slots aren't filled one at a time: the engine is fitted to the whole Ship (ADR 0001).
  const slots = new Map(ship.slots.filter((s) => s.kind !== "engine").map((s) => [s.id, s]));

  const engines = shipEngines(ship);
  const groups = new Map(ship.slotGroups.map((g) => [g.id, g]));
  const groupPart = (groupId: string, kind: SlotGroupKind) => groups.get(groupId)?.kinds[kind];

  const dropped = (loadout: Loadout, place: EquipmentPlace, id: string, reason: DropReason): Edit => ({
    loadout,
    repairs: [{ type: "dropped", place, equipment: id, name: nameOf(id), reason }],
  });

  /** Why Equipment can't go on this fit list (undefined for a place the Ship doesn't have), or null if it fits. */
  const refusal = (id: string, fitList: string | undefined, unknownPlace: DropReason): DropReason | null => {
    if (fitList === undefined) return unknownPlace;
    if (!equipment.has(id)) return "unknown-equipment";
    if (!fits(fitList, id)) return "doesnt-fit";
    return null;
  };

  const sortedItems = (fitListIds: Iterable<string>) =>
    [...new Set([...fitListIds].flatMap((id) => fitListEquipment(id)))].sort((a, b) => a.name.localeCompare(b.name));

  /**
   * The consumables this Loadout can carry, by kind. Missiles are those a
   * fitted launcher (in a Slot or a Slot Group) can fire; the rest come from
   * the Ship's fit lists. Kinds the Ship has no capacity for are left out.
   */
  const consumables = (loadout: Loadout): ConsumableOptions[] => {
    const fittedIds = [
      ...Object.values(loadout.slots ?? {}),
      ...Object.values(loadout.groups ?? {}).flatMap((kinds) => Object.values(kinds).map((e) => e.equipment)),
    ];
    const missileLists = fittedIds.flatMap((id) => {
      const item = equipment.get(id);
      return (item?.kind === "weapon" || item?.kind === "turret") && item.missiles ? [item.missiles] : [];
    });
    const all: ConsumableOptions[] = [
      { kind: "missile", capacity: ship.capacities.missiles, items: sortedItems(missileLists) },
      { kind: "drone", capacity: ship.capacities.drones, items: sortedItems([ship.drones]) },
      { kind: "deployable", capacity: ship.capacities.deployables, items: sortedItems([ship.deployables]) },
      { kind: "countermeasure", capacity: ship.capacities.countermeasures, items: sortedItems([ship.countermeasures]) },
    ];
    return all.filter((o) => o.capacity > 0 && o.items.length > 0);
  };

  /** After a launcher is fitted or removed: drops the consumables the Ship can no longer carry, such as missiles no fitted launcher fires. */
  const withoutUncarried = (loadout: Loadout): Edit => {
    const carried = new Set(consumables(loadout).flatMap((o) => o.items.map((e) => e.id)));
    const repairs: LoadoutRepair[] = [];
    const kept: Record<string, number> = {};
    for (const [id, count] of Object.entries(loadout.consumables ?? {})) {
      if (carried.has(id)) kept[id] = count;
      else repairs.push({ type: "dropped", place: { kind: "consumable" }, equipment: id, name: nameOf(id), reason: "doesnt-fit" });
    }
    return { loadout: withEntry(loadout, "consumables", kept), repairs };
  };

  /** How many of a consumable fit beside the others of its kind; 0 for one the Ship can't carry. */
  const consumableLimit = (loadout: Loadout, id: string) => {
    const options = consumables(loadout).find((o) => o.items.some((e) => e.id === id));
    if (!options) return 0;
    const others = options.items.reduce((sum, e) => sum + (e.id === id ? 0 : (loadout.consumables?.[e.id] ?? 0)), 0);
    return Math.max(0, options.capacity - others);
  };

  /** How many of a Crew role fit beside the other role in the Ship's crew capacity (ADR 0004). */
  const crewLimit = (loadout: Loadout, role: CrewRole) =>
    Math.max(0, ship.capacities.crew - (crewCount(loadout) - (loadout.crew?.[role] ?? 0)));

  return {
    consumables,

    /**
     * The most a place can take, which for a place sharing a capacity is what
     * the others leave. A consumable's limit is per item, so it takes the
     * item's id.
     */
    limit(loadout: Loadout, place: Place, id?: string): number {
      switch (place.kind) {
        case "slot":
          return slots.has(place.slot) ? 1 : 0;
        case "group":
          return groupPart(place.group, place.groupKind)?.count ?? 0;
        case "engine":
          return engines?.count ?? 0;
        case "thruster":
        case "software":
          return 1;
        case "consumable":
          return id === undefined ? 0 : consumableLimit(loadout, id);
        case "crew":
          return crewLimit(loadout, place.role);
      }
    },

    /**
     * The Equipment a place can take, in its fit list's order; consumables
     * are those the Loadout can carry now, and the Crew takes none.
     */
    options(loadout: Loadout, place: Place): Equipment[] {
      const listed = (fitList: string | undefined) => (fitList === undefined ? [] : fitListEquipment(fitList));
      switch (place.kind) {
        case "slot":
          return listed(slots.get(place.slot)?.fitList);
        case "group":
          return listed(groupPart(place.group, place.groupKind)?.fitList);
        case "engine":
          return listed(engines?.fitList);
        case "thruster":
          return listed(ship.thrusters);
        case "software":
          return listed(ship.software.fitList);
        case "consumable":
          return consumables(loadout).flatMap((o) => o.items);
        case "crew":
          return [];
      }
    },

    /**
     * Sets one Crew count, clamped to what the other role leaves of the
     * Ship's crew capacity; 0 removes it, and with both at 0 the Loadout has
     * no Crew (ADR 0004).
     */
    setCrew(loadout: Loadout, role: CrewRole, typed: number): Edit {
      const count = wholeCount(typed);
      const to = Math.max(0, Math.min(count, crewLimit(loadout, role)));
      const { [role]: _old, ...crew } = loadout.crew ?? {};
      const edited = withEntry(loadout, "crew", to > 0 ? { ...crew, [role]: to } : crew);
      if (to >= count) return noRepairs(edited);
      return { loadout: edited, repairs: [{ type: "clamped", place: { kind: "crew", role }, name: CREW_ROLE_NAMES[role], from: count, to }] };
    },

    /** Sets a consumable's count, clamped to what its kind's capacity leaves; 0 removes it. */
    setConsumable(loadout: Loadout, id: string, typed: number): Edit {
      const count = wholeCount(typed);
      const rest = withoutKey(loadout.consumables, id);
      if (count <= 0) return noRepairs(withEntry(loadout, "consumables", rest));
      const place: EquipmentPlace = { kind: "consumable" };
      if (!equipment.has(id)) return dropped(loadout, place, id, "unknown-equipment");
      const limit = consumableLimit(loadout, id);
      if (limit === 0) return dropped(loadout, place, id, "doesnt-fit");
      const to = Math.min(count, limit);
      const edited = withEntry(loadout, "consumables", { ...rest, [id]: to });
      if (to === count) return noRepairs(edited);
      return { loadout: edited, repairs: [{ type: "clamped", place, equipment: id, name: nameOf(id), from: count, to }] };
    },

    /** Fits Equipment to a Slot, or empties it with null. */
    setSlot(loadout: Loadout, slotId: string, id: string | null): Edit {
      const place: EquipmentPlace = { kind: "slot", slot: slotId };
      if (id !== null) {
        const reason = refusal(id, slots.get(slotId)?.fitList, "unknown-slot");
        if (reason) return dropped(loadout, place, id, reason);
      }
      const next = withoutKey(loadout.slots, slotId);
      if (id !== null) next[slotId] = id;
      return withoutUncarried(withEntry(loadout, "slots", next));
    },

    /** Fits one engine to all of the Ship's engines (ADR 0001), or removes them with null. */
    setEngine(loadout: Loadout, id: string | null): Edit {
      if (id !== null) {
        const reason = refusal(id, engines?.fitList, "doesnt-fit");
        if (reason) return dropped(loadout, { kind: "engine" }, id, reason);
      }
      return noRepairs(withEntry(loadout, "engine", id ?? undefined));
    },

    /** Fits the thruster, or removes it with null. */
    setThruster(loadout: Loadout, id: string | null): Edit {
      if (id !== null) {
        const reason = refusal(id, ship.thrusters, "doesnt-fit");
        if (reason) return dropped(loadout, { kind: "thruster" }, id, reason);
      }
      return noRepairs(withEntry(loadout, "thruster", id ?? undefined));
    },

    /** Adds or removes one piece of software. */
    setSoftware(loadout: Loadout, id: string, fitted: boolean): Edit {
      if (fitted) {
        const reason = refusal(id, ship.software.fitList, "doesnt-fit");
        if (reason) return dropped(loadout, { kind: "software" }, id, reason);
      }
      const software = (loadout.software ?? []).filter((s) => s !== id);
      if (fitted) software.push(id);
      return noRepairs(withEntry(loadout, "software", software));
    },

    /**
     * Picks the Equipment for one kind of a Slot Group, or empties it with
     * null. An empty kind is filled to all of the group's Slots; swapping the
     * Equipment keeps the count.
     */
    setGroupEquipment(loadout: Loadout, groupId: string, kind: SlotGroupKind, id: string | null): Edit {
      if (id === null) return withoutUncarried(withGroup(loadout, groupId, kind, null));
      const place: EquipmentPlace = { kind: "group", group: groupId, groupKind: kind };
      const part = groupPart(groupId, kind);
      const reason = refusal(id, part?.fitList, "unknown-slot-group");
      if (reason) return dropped(loadout, place, id, reason);
      const count = loadout.groups?.[groupId]?.[kind]?.count ?? part!.count;
      return withoutUncarried(withGroup(loadout, groupId, kind, { equipment: id, count }));
    },

    /**
     * Sets how many of a Slot Group's Slots its fitted Equipment of one kind
     * fills, clamped to the group's size; 0 empties it. With nothing fitted it
     * changes nothing. A count is taken as a whole number, as in every edit.
     */
    setGroupCount(loadout: Loadout, groupId: string, kind: SlotGroupKind, typed: number): Edit {
      const count = wholeCount(typed);
      const entry = loadout.groups?.[groupId]?.[kind];
      const part = groupPart(groupId, kind);
      if (!entry) return noRepairs(loadout);
      if (!part) return dropped(loadout, { kind: "group", group: groupId, groupKind: kind }, entry.equipment, "unknown-slot-group");
      if (count <= 0) return withoutUncarried(withGroup(loadout, groupId, kind, null));
      const to = Math.min(count, part.count);
      const edited = withGroup(loadout, groupId, kind, { equipment: entry.equipment, count: to });
      if (to === count) return noRepairs(edited);
      const place: EquipmentPlace = { kind: "group", group: groupId, groupKind: kind };
      return {
        loadout: edited,
        repairs: [{ type: "clamped", place, equipment: entry.equipment, name: nameOf(entry.equipment), from: count, to }],
      };
    },
  };
}

export type LoadoutRules = ReturnType<typeof loadoutRules>;
