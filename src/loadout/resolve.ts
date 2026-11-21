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
import { CREW_CUT_ORDER, CREW_ROLE_NAMES, crewCount, shipEngines, type Loadout, type SlotGroupKind } from "./loadout.ts";
import type { DropReason, EquipmentPlace, LoadoutRepair } from "./repairs.ts";
import { loadoutRules } from "./rules.ts";

/** The Game Data versions a Loadout was made against, or the bundled ones. */
export type GameDataVersions = Loadout["gameData"];

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

/** Checks a Loadout against the Game Data, returning the repaired Loadout and every Repair. */
export function resolveLoadout(gameData: GameData, loadout: Loadout): Resolution {
  const { ships, equipment, fits } = indexGameData(gameData);
  const ship = ships.get(loadout.ship);
  if (!ship) return { status: "unavailable", ship: loadout.ship };

  const to = { swi: gameData.manifest.swi.version, x4: gameData.manifest.x4.version };
  const nameOf = (id: string) => equipment.get(id)?.name ?? id;
  const repairs: LoadoutRepair[] = [];
  const drop = (place: EquipmentPlace, id: string, reason: DropReason) =>
    repairs.push({ type: "dropped", place, equipment: id, name: nameOf(id), reason });
  /** Whether a known piece of Equipment fits the fit list, dropping it with a reason if not. */
  const keep = (place: EquipmentPlace, id: string, fitListId: string | undefined, unknownPlace: DropReason) => {
    if (fitListId === undefined) drop(place, id, unknownPlace);
    else if (!equipment.has(id)) drop(place, id, "unknown-equipment");
    else if (!fits(fitListId, id)) drop(place, id, "doesnt-fit");
    else return true;
    return false;
  };

  // The checks below make every edit fit, so the edits' own Repairs are always empty.
  const rules = loadoutRules(gameData, ship);
  let repaired: Loadout = { format: loadout.format, gameData: to, ship: loadout.ship };

  for (const [slotId, id] of Object.entries(loadout.slots ?? {})) {
    // Engine Slots aren't filled one at a time: the engine is fitted to the whole Ship (ADR 0001).
    const slot = ship.slots.find((s) => s.id === slotId && s.kind !== "engine");
    if (keep({ kind: "slot", slot: slotId }, id, slot?.fitList, "unknown-slot")) repaired = rules.setSlot(repaired, slotId, id).loadout;
  }

  for (const [groupId, kinds] of Object.entries(loadout.groups ?? {})) {
    const group = ship.slotGroups.find((g) => g.id === groupId);
    for (const [kind, entry] of Object.entries(kinds) as [SlotGroupKind, { equipment: string; count: number }][]) {
      const place: EquipmentPlace = { kind: "group", group: groupId, groupKind: kind };
      const part = group?.kinds[kind];
      if (!keep(place, entry.equipment, part?.fitList, "unknown-slot-group")) continue;
      const count = Math.min(entry.count, part!.count);
      if (count < entry.count) {
        repairs.push({ type: "clamped", place, equipment: entry.equipment, name: nameOf(entry.equipment), from: entry.count, to: count });
      }
      repaired = rules.setGroupEquipment(repaired, groupId, kind, entry.equipment).loadout;
      repaired = rules.setGroupCount(repaired, groupId, kind, count).loadout;
    }
  }
  // The engine count comes from the Ship, so only whether the engine still fits matters.
  if (loadout.engine && keep({ kind: "engine" }, loadout.engine, shipEngines(ship)?.fitList, "doesnt-fit")) {
    repaired = rules.setEngine(repaired, loadout.engine).loadout;
  }
  if (loadout.thruster && keep({ kind: "thruster" }, loadout.thruster, ship.thrusters, "doesnt-fit")) {
    repaired = rules.setThruster(repaired, loadout.thruster).loadout;
  }

  for (const id of loadout.software ?? []) {
    if (keep({ kind: "software" }, id, ship.software.fitList, "doesnt-fit")) repaired = rules.setSoftware(repaired, id, true).loadout;
  }

  // What the Ship can carry depends on the launchers that are still fitted.
  const carried = rules.consumables(repaired);
  const left = new Map(carried.map((o) => [o.kind, o.capacity]));
  for (const [id, stored] of Object.entries(loadout.consumables ?? {})) {
    const place: EquipmentPlace = { kind: "consumable" };
    const options = carried.find((o) => o.items.some((e) => e.id === id));
    if (!equipment.has(id)) drop(place, id, "unknown-equipment");
    else if (!options || left.get(options.kind) === 0) drop(place, id, "doesnt-fit");
    else {
      const count = Math.min(stored, left.get(options.kind)!);
      left.set(options.kind, left.get(options.kind)! - count);
      if (count < stored) repairs.push({ type: "clamped", place, equipment: id, name: nameOf(id), from: stored, to: count });
      repaired = rules.setConsumable(repaired, id, count).loadout;
    }
  }

  // Service crew and marines share the Ship's crew capacity (ADR 0004).
  let over = crewCount(loadout) - ship.capacities.crew;
  for (const role of CREW_CUT_ORDER) {
    const stored = loadout.crew?.[role] ?? 0;
    const cut = Math.max(0, Math.min(over, stored));
    over -= cut;
    if (cut > 0) {
      repairs.push({ type: "clamped", place: { kind: "crew", role }, name: CREW_ROLE_NAMES[role], from: stored, to: stored - cut });
    }
    repaired = rules.setCrew(repaired, role, stored - cut).loadout;
  }

  return { status: "ok", loadout: repaired, repairs, versions: { from: loadout.gameData, to } };
}
