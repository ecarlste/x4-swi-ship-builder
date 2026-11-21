/**
 * Resolving a Loadout against the bundled Game Data (spec #25, decided in #9
 * and #24), for Loadouts made against older Game Data.
 *
 * A Ship that isn't in the Game Data makes the Loadout Unavailable. Unknown
 * Equipment, Slots or Slot Groups, and Equipment that no longer fits, are
 * dropped; a count above the new capacity is clamped. Crew over the Ship's
 * crew capacity is cut to fit, service crew first (ADR 0004). Ids are matched as
 * they are: there are no rename tables. A version change on its own isn't a
 * Repair.
 */
import type { GameData } from "../../shared/game-data/validateSnapshot.ts";
import { indexGameData } from "../gameDataIndex.ts";
import {
  CREW_CUT_ORDER,
  CREW_ROLE_NAMES,
  consumableOptions,
  crewCount,
  setConsumable,
  setCrew,
  setEngine,
  setGroup,
  setSlot,
  setSoftware,
  setThruster,
  shipEngines,
  type CrewRole,
  type Loadout,
  type SlotGroupKind,
} from "./loadout.ts";

/** The Game Data versions a Loadout was made against, or the bundled ones. */
export type GameDataVersions = Loadout["gameData"];

/** Where in a Loadout a Repair was made. */
export type RepairPlace =
  | { kind: "slot"; slot: string }
  | { kind: "group"; group: string; groupKind: SlotGroupKind }
  | { kind: "engine" }
  | { kind: "thruster" }
  | { kind: "software" }
  | { kind: "consumable" };

/** Why an entry was dropped. */
export type DropReason = "unknown-equipment" | "unknown-slot" | "unknown-slot-group" | "doesnt-fit";

/**
 * A Repair: one drop or clamp of Equipment, or one Crew role cut to fit the Ship's crew
 * capacity. `name` is the Equipment's name, or its raw id when it isn't in the
 * Game Data.
 */
export type LoadoutRepair =
  | { type: "dropped"; place: RepairPlace; equipment: string; name: string; reason: DropReason }
  | { type: "clamped"; place: RepairPlace; equipment: string; name: string; from: number; to: number }
  | { type: "crew-cut"; role: CrewRole; from: number; to: number };

export type Resolution =
  | { status: "unavailable"; ship: string }
  | {
      status: "ok";
      /** The repaired Loadout, stamped with the bundled Game Data's versions. */
      loadout: Loadout;
      /** Every drop and clamp; empty when everything still fits. */
      repairs: LoadoutRepair[];
      versions: { from: GameDataVersions; to: GameDataVersions };
    };

function placeText(place: RepairPlace): string {
  switch (place.kind) {
    case "slot":
      return `in ${place.slot}`;
    case "group":
      return `in ${place.group} ${place.groupKind}s`;
    case "engine":
      return "as engine";
    case "thruster":
      return "as thruster";
    case "software":
      return "in software";
    case "consumable":
      return "in consumables";
  }
}

const DROP_TEXT: Record<DropReason, string> = {
  "unknown-equipment": "it's no longer in the Game Data",
  "unknown-slot": "the Ship no longer has this Slot",
  "unknown-slot-group": "the Ship no longer has this Slot Group",
  "doesnt-fit": "it no longer fits",
};

/** One line saying what a Repair did, for notices and tooltips. */
export function describeRepair(repair: LoadoutRepair): string {
  switch (repair.type) {
    case "dropped":
      return `${repair.name} ${placeText(repair.place)}: dropped, ${DROP_TEXT[repair.reason]}`;
    case "clamped":
      return `${repair.name} ${placeText(repair.place)}: count cut from ${repair.from} to ${repair.to}`;
    case "crew-cut":
      return `${CREW_ROLE_NAMES[repair.role]} in crew: count cut from ${repair.from} to ${repair.to}`;
  }
}

/** Checks a Loadout against the Game Data, returning the repaired Loadout and every Repair. */
export function resolveLoadout(gameData: GameData, loadout: Loadout): Resolution {
  const { ships, equipment, fits } = indexGameData(gameData);
  const ship = ships.get(loadout.ship);
  if (!ship) return { status: "unavailable", ship: loadout.ship };

  const to = { swi: gameData.manifest.swi.version, x4: gameData.manifest.x4.version };
  const nameOf = (id: string) => equipment.get(id)?.name ?? id;
  const repairs: LoadoutRepair[] = [];
  const drop = (place: RepairPlace, id: string, reason: DropReason) =>
    repairs.push({ type: "dropped", place, equipment: id, name: nameOf(id), reason });
  /** Whether a known piece of Equipment fits the fit list, dropping it with a reason if not. */
  const keep = (place: RepairPlace, id: string, fitListId: string | undefined, unknownPlace: DropReason) => {
    if (fitListId === undefined) drop(place, id, unknownPlace);
    else if (!equipment.has(id)) drop(place, id, "unknown-equipment");
    else if (!fits(fitListId, id)) drop(place, id, "doesnt-fit");
    else return true;
    return false;
  };

  let repaired: Loadout = { format: loadout.format, gameData: to, ship: loadout.ship };

  for (const [slotId, id] of Object.entries(loadout.slots ?? {})) {
    // Engine Slots aren't filled one at a time: the engine is fitted to the whole Ship (ADR 0001).
    const slot = ship.slots.find((s) => s.id === slotId && s.kind !== "engine");
    if (keep({ kind: "slot", slot: slotId }, id, slot?.fitList, "unknown-slot")) repaired = setSlot(repaired, slotId, id);
  }

  for (const [groupId, kinds] of Object.entries(loadout.groups ?? {})) {
    const group = ship.slotGroups.find((g) => g.id === groupId);
    for (const [kind, entry] of Object.entries(kinds) as [SlotGroupKind, { equipment: string; count: number }][]) {
      const place: RepairPlace = { kind: "group", group: groupId, groupKind: kind };
      const part = group?.kinds[kind];
      if (!keep(place, entry.equipment, part?.fitList, "unknown-slot-group")) continue;
      const count = Math.min(entry.count, part!.count);
      if (count < entry.count) {
        repairs.push({ type: "clamped", place, equipment: entry.equipment, name: nameOf(entry.equipment), from: entry.count, to: count });
      }
      repaired = setGroup(repaired, groupId, kind, { equipment: entry.equipment, count });
    }
  }
  // The engine count comes from the Ship, so only whether the engine still fits matters.
  if (loadout.engine && keep({ kind: "engine" }, loadout.engine, shipEngines(ship)?.fitList, "doesnt-fit")) {
    repaired = setEngine(repaired, loadout.engine);
  }
  if (loadout.thruster && keep({ kind: "thruster" }, loadout.thruster, ship.thrusters, "doesnt-fit")) {
    repaired = setThruster(repaired, loadout.thruster);
  }

  for (const id of loadout.software ?? []) {
    if (keep({ kind: "software" }, id, ship.software.fitList, "doesnt-fit")) repaired = setSoftware(repaired, id, true);
  }

  // What the Ship can carry depends on the launchers that are still fitted.
  const carried = consumableOptions(gameData, ship, repaired);
  const left = new Map(carried.map((o) => [o.kind, o.capacity]));
  for (const [id, stored] of Object.entries(loadout.consumables ?? {})) {
    const place: RepairPlace = { kind: "consumable" };
    const options = carried.find((o) => o.items.some((e) => e.id === id));
    if (!equipment.has(id)) drop(place, id, "unknown-equipment");
    else if (!options || left.get(options.kind) === 0) drop(place, id, "doesnt-fit");
    else {
      const count = Math.min(stored, left.get(options.kind)!);
      left.set(options.kind, left.get(options.kind)! - count);
      if (count < stored) repairs.push({ type: "clamped", place, equipment: id, name: nameOf(id), from: stored, to: count });
      repaired = setConsumable(repaired, id, count);
    }
  }

  // Service crew and marines share the Ship's crew capacity (ADR 0004).
  let over = crewCount(loadout) - ship.capacities.crew;
  for (const role of CREW_CUT_ORDER) {
    const stored = loadout.crew?.[role] ?? 0;
    const cut = Math.max(0, Math.min(over, stored));
    over -= cut;
    if (cut > 0) repairs.push({ type: "crew-cut", role, from: stored, to: stored - cut });
    repaired = setCrew(repaired, role, stored - cut);
  }

  return { status: "ok", loadout: repaired, repairs, versions: { from: loadout.gameData, to } };
}
