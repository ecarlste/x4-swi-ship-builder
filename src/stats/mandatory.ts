import type { GameData, Ship } from "../gameData.ts";
import type { Loadout } from "../builder/loadout.ts";

/** A mandatory upgrade the Loadout lacks: which row it is, and how to name it. */
export interface MissingUpgrade {
  /** Identifies the table row: `slot:<id>`, `group:<id>:engine`, `thruster` or `software:<id>`. */
  row: string;
  label: string;
}

const SLOT_KIND_LABEL = { weapon: "Weapon", turret: "Turret", shield: "Shield", engine: "Engine" } as const;

/**
 * The mandatory upgrades this Loadout is missing, in table order: engine
 * Slots and Slots tagged `mandatory`, engine Slot Groups not filled to their
 * size, the thruster, and the Ship's `default="1"` software. Nothing is
 * blocked by these; the builder only points them out.
 */
export function missingMandatory(gameData: GameData, ship: Ship, loadout: Loadout): MissingUpgrade[] {
  const softwareName = (id: string) => gameData.equipment.find((e) => e.id === id)?.name ?? id;
  const missing: MissingUpgrade[] = [];
  for (const slot of ship.slots) {
    if ((slot.mandatory || slot.kind === "engine") && !loadout.slots?.[slot.id]) {
      missing.push({ row: `slot:${slot.id}`, label: `${SLOT_KIND_LABEL[slot.kind]} ${slot.id}` });
    }
  }
  for (const group of ship.slotGroups) {
    const engines = group.kinds.engine;
    if (engines && (loadout.groups?.[group.id]?.engine?.count ?? 0) < engines.count) {
      missing.push({ row: `group:${group.id}:engine`, label: `Engines ${group.id}` });
    }
  }
  if (!loadout.thruster) missing.push({ row: "thruster", label: "Thruster" });
  for (const id of ship.software.mandatory) {
    if (!loadout.software?.includes(id)) missing.push({ row: `software:${id}`, label: softwareName(id) });
  }
  return missing;
}
