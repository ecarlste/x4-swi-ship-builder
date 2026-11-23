/**
 * Resolving a Loadout against the bundled Game Data (spec #25, decided in #9
 * and #24), for Loadouts made against older Game Data.
 *
 * A Ship that isn't in the Game Data makes the Loadout Unavailable. Unknown
 * Equipment, Slots or Slot Groups, and Equipment that no longer fits, are
 * dropped; a count above the new capacity is clamped. Crew over the Ship's
 * crew capacity is cut to fit, service crew first (ADR 0004). Of two pieces
 * of software in one Software Family, the newer is kept, and a mandatory
 * Software Family with none fitted gets its cheapest ware (ADR 0006). Ids are matched as
 * they are: there are no rename tables. A version change on its own isn't a
 * Repair.
 *
 * None of these rules live here: the stored Loadout is replayed through the
 * Ship's edits in `rules.ts`, and their Repairs are collected.
 */
import type { GameData } from "../../shared/game-data/validateSnapshot.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { bareLoadout, CREW_CUT_ORDER, type Loadout, type SlotGroupKind } from "./loadout.ts";
import type { LoadoutRepair } from "./repairs.ts";
import { loadoutRules, type Edit } from "./rules.ts";

/** The Game Data versions a Loadout was made against, or the bundled ones. */
export type GameDataVersions = Loadout["gameData"];

export type Resolution =
  | { status: "unavailable"; ship: string }
  | {
      status: "ok";
      /** The repaired Loadout, stamped with the bundled Game Data's versions. */
      loadout: Loadout;
      /** Every addition, drop and clamp; empty when everything still fits. */
      repairs: LoadoutRepair[];
      versions: { from: GameDataVersions; to: GameDataVersions };
    };

/** Checks a Loadout against the Game Data, returning the repaired Loadout and every Repair. */
export function resolveLoadout(gameData: GameData, loadout: Loadout): Resolution {
  const { ships, softwareChain } = indexGameData(gameData);
  const ship = ships.get(loadout.ship);
  if (!ship) return { status: "unavailable", ship: loadout.ship };

  const rules = loadoutRules(gameData, ship);
  // The bare Loadout is stamped with the bundled Game Data's versions, and no edit changes them.
  let repaired = bareLoadout(gameData, ship);
  const repairs: LoadoutRepair[] = [];
  const replay = (edit: Edit) => {
    repaired = edit.loadout;
    repairs.push(...edit.repairs);
  };

  // Launchers come before consumables, so the missiles carried depend on the launchers still fitted.
  for (const [slotId, id] of Object.entries(loadout.slots ?? {})) replay(rules.setSlot(repaired, slotId, id));
  for (const [groupId, kinds] of Object.entries(loadout.groups ?? {})) {
    for (const [kind, entry] of Object.entries(kinds) as [SlotGroupKind, { equipment: string; count: number }][]) {
      replay(rules.setGroupEquipment(repaired, groupId, kind, entry.equipment));
      replay(rules.setGroupCount(repaired, groupId, kind, entry.count));
    }
  }
  if (loadout.engine) replay(rules.setEngine(repaired, loadout.engine));
  if (loadout.thruster) replay(rules.setThruster(repaired, loadout.thruster));
  // Older software goes in first, so of two in one Software Family the newer one is kept.
  const software = [...(loadout.software ?? [])].sort((a, b) => softwareChain(a).length - softwareChain(b).length);
  for (const id of software) replay(rules.setSoftware(repaired, id, true));
  // That order is only the replay's: what is kept stays in the order it was stored.
  const kept = new Set(repaired.software);
  if (kept.size > 0) repaired = { ...repaired, software: [...new Set(loadout.software)].filter((id) => kept.has(id)) };
  // A mandatory Software Family with nothing fitted gets its cheapest ware (ADR 0006).
  replay(rules.withMandatorySoftware(repaired));
  // Consumables of one kind share its capacity in the order they were stored.
  for (const [id, count] of Object.entries(loadout.consumables ?? {})) replay(rules.setConsumable(repaired, id, count));
  // Marines go in first, so any cut to fit the crew capacity lands on service crew first (ADR 0004).
  for (const role of [...CREW_CUT_ORDER].reverse()) {
    const count = loadout.crew?.[role];
    if (count !== undefined) replay(rules.setCrew(repaired, role, count));
  }

  return { status: "ok", loadout: repaired, repairs, versions: { from: loadout.gameData, to: repaired.gameData } };
}
