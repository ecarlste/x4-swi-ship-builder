import type { EquipmentKind, SnapshotData } from "./schema.ts";
import { slotGroupKindSchema } from "./schema.ts";
import { engineParts } from "./engines.ts";

/**
 * The reference-integrity pass: every id a snapshot refers to must resolve.
 * Runs only on data that already passed the schema. Returns one message per
 * problem, prefixed with the file it is in.
 */
export function checkIntegrity(data: SnapshotData): string[] {
  const errors: string[] = [];

  const tables = [
    ["ships", data.ships],
    ["equipment", data.equipment],
    ["fit-lists", data["fit-lists"]],
    ["factions", data.factions],
  ] as const;
  for (const [file, rows] of tables) {
    for (const dup of duplicates(rows.map((r) => r.id))) {
      errors.push(`${file}: duplicate id "${dup}"`);
    }
  }

  // The game's colour markup (\033#AARRGGBB#, \033X) must be stripped at extraction (#111).
  for (const [file, rows] of tables) {
    for (const row of rows) {
      if ("name" in row && row.name.includes("\\033")) {
        errors.push(`${file}: ${row.id} name "${row.name}" still has the game's colour markup`);
      }
    }
  }

  const fitLists = new Map(data["fit-lists"].map((f) => [f.id, f]));
  const equipment = new Map(data.equipment.map((e) => [e.id, e]));
  const factions = new Set(data.factions.map((f) => f.id));
  // A licence is defined per Faction, so a (licence, Faction) pair is its key.
  const licenceKey = (id: string, faction: string) => `${id} of ${faction}`;
  for (const dup of duplicates(data.licences.map((l) => licenceKey(l.id, l.faction)))) {
    errors.push(`licences: duplicate licence "${dup}"`);
  }
  for (const licence of data.licences) {
    if (!factions.has(licence.faction)) {
      errors.push(`licences: ${licence.id} refers to unknown faction "${licence.faction}"`);
    }
  }
  const licences = new Set(data.licences.map((l) => licenceKey(l.id, l.faction)));

  const checkSellersAndLicence = (
    file: string,
    item: { id: string; sellers: string[]; licence: string | null },
  ) => {
    for (const seller of item.sellers) {
      if (!factions.has(seller)) {
        errors.push(`${file}: ${item.id} seller refers to unknown faction "${seller}"`);
      }
    }
    if (item.licence === null) return;
    for (const seller of item.sellers) {
      if (!licences.has(licenceKey(item.licence, seller))) {
        errors.push(`${file}: ${item.id} licence refers to unknown licence "${licenceKey(item.licence, seller)}"`);
      }
    }
  };

  /**
   * Checks that `fitListId` exists and holds only Equipment of `kind`.
   * Unknown Equipment in the list is reported once, by the fit-lists check.
   */
  const checkFitList = (source: string, where: string, fitListId: string, kind: EquipmentKind) => {
    const list = fitLists.get(fitListId);
    if (!list) {
      errors.push(`${source} ${where} refers to unknown fit list "${fitListId}"`);
      return;
    }
    for (const itemId of list.equipment) {
      const item = equipment.get(itemId);
      if (item && item.kind !== kind) {
        errors.push(
          `${source} ${where} takes ${kind} but fit list "${fitListId}" has ${item.kind} "${itemId}"`,
        );
      }
    }
  };

  for (const ship of data.ships) {
    const source = `ships: ${ship.id}`;

    for (const dup of duplicates(ship.slots.map((s) => s.id))) {
      errors.push(`${source} has duplicate Slot id "${dup}"`);
    }
    for (const dup of duplicates(ship.slotGroups.map((g) => g.id))) {
      errors.push(`${source} has duplicate Slot Group id "${dup}"`);
    }
    // The game merges Slot Groups whose names differ only by spaces, so extraction must have too (#52).
    for (const trimmed of duplicates(ship.slotGroups.map((g) => g.id.trim()))) {
      const ids = [...new Set(ship.slotGroups.map((g) => g.id).filter((id) => id.trim() === trimmed))].sort();
      if (ids.length > 1) {
        const list = ids.map((id) => `"${id}"`).join(", ");
        errors.push(`${source} has Slot Group ids ${list} that are one Slot Group in game, as they differ only by spaces`);
      }
    }

    for (const slot of ship.slots) checkFitList(source, `slot ${slot.id}`, slot.fitList, slot.kind);
    for (const group of ship.slotGroups) {
      for (const kind of slotGroupKindSchema.options) {
        const entry = group.kinds[kind];
        if (entry) checkFitList(source, `slot group ${group.id} ${kind}`, entry.fitList, kind);
      }
    }
    // In game, all of a Ship's engines take one engine type (ADR 0001), so they must share a fit list.
    const engineFitLists = new Set(engineParts(ship).map((p) => p.fitList));
    if (engineFitLists.size > 1) {
      const lists = [...engineFitLists].sort().map((f) => `"${f}"`).join(", ");
      errors.push(`${source} engines are on more than one fit list (${lists}), but take one engine type`);
    }
    checkFitList(source, "thrusters", ship.thrusters, "thruster");
    checkFitList(source, "software", ship.software.fitList, "software");
    checkFitList(source, "drones", ship.drones, "drone");
    checkFitList(source, "deployables", ship.deployables, "deployable");
    checkFitList(source, "countermeasures", ship.countermeasures, "countermeasure");

    const softwareOptions = fitLists.get(ship.software.fitList);
    if (softwareOptions) {
      for (const itemId of ship.software.mandatory) {
        if (!softwareOptions.equipment.includes(itemId)) {
          errors.push(
            `${source} mandatory software "${itemId}" is not in fit list "${ship.software.fitList}"`,
          );
        }
      }
    }

    checkSellersAndLicence("ships", ship);
  }

  for (const item of data.equipment) {
    if ((item.kind === "weapon" || item.kind === "turret") && item.missiles !== null) {
      checkFitList(`equipment: ${item.id}`, "missiles", item.missiles, "missile");
    }
    checkSellersAndLicence("equipment", item);
  }

  // A Software Family is a chain of predecessors: each one must be software, and the chain must end.
  for (const item of data.equipment) {
    if (item.kind !== "software" || item.predecessor === null) continue;
    const predecessor = equipment.get(item.predecessor);
    if (!predecessor) {
      errors.push(`equipment: ${item.id} predecessor refers to unknown equipment "${item.predecessor}"`);
      continue;
    }
    if (predecessor.kind !== "software") {
      errors.push(`equipment: ${item.id} predecessor "${item.predecessor}" is ${predecessor.kind}, not software`);
      continue;
    }
    // Each link is checked on its own ware, so the walk only looks for a way back.
    const seen = new Set([item.id]);
    for (let at = equipment.get(item.predecessor); at?.kind === "software"; ) {
      if (seen.has(at.id)) {
        errors.push(`equipment: ${item.id} predecessors go round in a cycle`);
        break;
      }
      seen.add(at.id);
      at = at.predecessor === null ? undefined : equipment.get(at.predecessor);
    }
  }

  // Every Software Family has the game's name, the same on each of its wares, so its group is never unlabelled.
  for (const item of data.equipment) {
    if (item.kind !== "software") continue;
    if (item.familyName.trim() === "") {
      errors.push(`equipment: ${item.id} Software Family has no name`);
      continue;
    }
    const predecessor = item.predecessor === null ? undefined : equipment.get(item.predecessor);
    if (predecessor?.kind === "software" && predecessor.familyName.trim() !== "" && predecessor.familyName !== item.familyName) {
      errors.push(
        `equipment: ${item.id} Software Family is named "${item.familyName}", ` +
          `but ${predecessor.id} names it "${predecessor.familyName}"`,
      );
    }
  }

  for (const list of data["fit-lists"]) {
    for (const itemId of list.equipment) {
      if (!equipment.has(itemId)) {
        errors.push(`fit-lists: ${list.id} refers to unknown equipment "${itemId}"`);
      }
    }
  }

  return errors;
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups];
}
