/**
 * Resolving a Loadout against the bundled Game Data (spec #25, decided in #9
 * and #24), for Loadouts made against older Game Data.
 *
 * A Ship that isn't in the Game Data makes the Loadout Unavailable. Unknown
 * Equipment, Slots or Slot Groups, and Equipment that no longer fits, are
 * dropped; a count above the new capacity is clamped. Ids are matched as
 * they are: there are no rename tables. A version change on its own isn't a
 * change.
 */
import type { GameData } from "../../shared/game-data/validateSnapshot.ts";
import { indexGameData } from "../gameDataIndex.ts";
import {
  consumableOptions,
  setConsumable,
  setGroup,
  setSlot,
  setSoftware,
  setThruster,
} from "../builder/loadout.ts";
import type { Loadout, SlotGroupKind } from "./loadout.ts";

/** The Game Data versions a Loadout was made against, or the bundled ones. */
export type GameDataVersions = Loadout["gameData"];

/** Where in a Loadout a change was made. */
export type ChangePlace =
  | { kind: "slot"; slot: string }
  | { kind: "group"; group: string; groupKind: SlotGroupKind }
  | { kind: "thruster" }
  | { kind: "software" }
  | { kind: "consumable" };

/** Why an entry was dropped. */
export type DropReason = "unknown-equipment" | "unknown-slot" | "unknown-slot-group" | "no-longer-fits";

/** One drop or clamp. `name` is the Equipment's name, or its raw id when it isn't in the Game Data. */
export type LoadoutChange =
  | { type: "dropped"; place: ChangePlace; equipment: string; name: string; reason: DropReason }
  | { type: "clamped"; place: ChangePlace; equipment: string; name: string; from: number; to: number };

export type Resolution =
  | { status: "unavailable"; ship: string }
  | {
      status: "ok";
      /** The repaired Loadout, stamped with the bundled Game Data's versions. */
      loadout: Loadout;
      /** Every drop and clamp; empty when everything still fits. */
      changes: LoadoutChange[];
      versions: { from: GameDataVersions; to: GameDataVersions };
    };

function placeText(place: ChangePlace): string {
  switch (place.kind) {
    case "slot":
      return `in ${place.slot}`;
    case "group":
      return `in ${place.group} ${place.groupKind}s`;
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
  "no-longer-fits": "it no longer fits",
};

/** One line saying what a change did, for notices and tooltips. */
export function describeChange(change: LoadoutChange): string {
  const where = `${change.name} ${placeText(change.place)}`;
  return change.type === "dropped"
    ? `${where}: dropped, ${DROP_TEXT[change.reason]}`
    : `${where}: count cut from ${change.from} to ${change.to}`;
}

/** Checks a Loadout against the Game Data, returning the repaired Loadout and every change. */
export function resolveLoadout(gameData: GameData, loadout: Loadout): Resolution {
  const { ships, equipment, fits } = indexGameData(gameData);
  const ship = ships.get(loadout.ship);
  if (!ship) return { status: "unavailable", ship: loadout.ship };

  const to = { swi: gameData.manifest.swi.version, x4: gameData.manifest.x4.version };
  const nameOf = (id: string) => equipment.get(id)?.name ?? id;
  const changes: LoadoutChange[] = [];
  const drop = (place: ChangePlace, id: string, reason: DropReason) =>
    changes.push({ type: "dropped", place, equipment: id, name: nameOf(id), reason });
  /** Whether a known piece of Equipment fits the fit list, dropping it with a reason if not. */
  const keep = (place: ChangePlace, id: string, fitListId: string | undefined, unknownPlace: DropReason) => {
    if (fitListId === undefined) drop(place, id, unknownPlace);
    else if (!equipment.has(id)) drop(place, id, "unknown-equipment");
    else if (!fits(fitListId, id)) drop(place, id, "no-longer-fits");
    else return true;
    return false;
  };

  let repaired: Loadout = { format: loadout.format, gameData: to, ship: loadout.ship };

  for (const [slotId, id] of Object.entries(loadout.slots ?? {})) {
    const slot = ship.slots.find((s) => s.id === slotId);
    if (keep({ kind: "slot", slot: slotId }, id, slot?.fitList, "unknown-slot")) repaired = setSlot(repaired, slotId, id);
  }

  for (const [groupId, kinds] of Object.entries(loadout.groups ?? {})) {
    const group = ship.slotGroups.find((g) => g.id === groupId);
    for (const [kind, entry] of Object.entries(kinds) as [SlotGroupKind, { equipment: string; count: number }][]) {
      const place: ChangePlace = { kind: "group", group: groupId, groupKind: kind };
      const part = group?.kinds[kind];
      if (!keep(place, entry.equipment, part?.fitList, "unknown-slot-group")) continue;
      const count = Math.min(entry.count, part!.count);
      if (count < entry.count) {
        changes.push({ type: "clamped", place, equipment: entry.equipment, name: nameOf(entry.equipment), from: entry.count, to: count });
      }
      repaired = setGroup(repaired, groupId, kind, { equipment: entry.equipment, count });
    }
  }
  if (loadout.thruster && keep({ kind: "thruster" }, loadout.thruster, ship.thrusters, "no-longer-fits")) {
    repaired = setThruster(repaired, loadout.thruster);
  }

  for (const id of loadout.software ?? []) {
    if (keep({ kind: "software" }, id, ship.software.fitList, "no-longer-fits")) repaired = setSoftware(repaired, id, true);
  }

  // What the Ship can carry depends on the launchers that are still fitted.
  const carried = consumableOptions(gameData, ship, repaired);
  const left = new Map(carried.map((o) => [o.kind, o.capacity]));
  for (const [id, stored] of Object.entries(loadout.consumables ?? {})) {
    const place: ChangePlace = { kind: "consumable" };
    const options = carried.find((o) => o.items.some((e) => e.id === id));
    if (!equipment.has(id)) drop(place, id, "unknown-equipment");
    else if (!options || left.get(options.kind) === 0) drop(place, id, "no-longer-fits");
    else {
      const count = Math.min(stored, left.get(options.kind)!);
      left.set(options.kind, left.get(options.kind)! - count);
      if (count < stored) changes.push({ type: "clamped", place, equipment: id, name: nameOf(id), from: stored, to: count });
      repaired = setConsumable(repaired, id, count);
    }
  }

  return { status: "ok", loadout: repaired, changes, versions: { from: loadout.gameData, to } };
}
