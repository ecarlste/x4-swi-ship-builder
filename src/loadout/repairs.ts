/**
 * Places in a Loadout and the Repairs made there: the additions, drops and
 * clamps that make a Loadout fit its Ship and the Game Data.
 */
import type { CrewRole, SlotGroupKind } from "./loadout.ts";

/**
 * A Place in a Loadout: where an edit goes, what a query is about, where a
 * Repair was made, and what a line of the Loadout is for. Software and
 * consumables name their Equipment, so one Place is one line.
 */
export type Place =
  | { kind: "slot"; slot: string }
  | { kind: "group"; group: string; groupKind: SlotGroupKind }
  | { kind: "engine" }
  | { kind: "thruster" }
  | { kind: "software"; equipment: string }
  | { kind: "consumable"; equipment: string }
  | { kind: "crew"; role: CrewRole };

/** A place Equipment is fitted to: every place but the Crew. */
export type EquipmentPlace = Exclude<Place, { kind: "crew" }>;

/** Why an entry was dropped. */
export type DropReason =
  | "unknown-equipment"
  | "unknown-slot"
  | "unknown-slot-group"
  | "doesnt-fit"
  /** Software swapped out for another of its Software Family. */
  | "replaced-in-family";

/**
 * A Repair: one drop of Equipment, one count clamped to fit, or one piece of
 * mandatory software added to a Software Family that had none (ADR 0006).
 * `name` is the Equipment's name, or its raw id when it isn't in the Game
 * Data, or the Crew role's name; a clamp of Crew has no `equipment`. An
 * addition names the Software Family it was added to in `family`.
 */
export type LoadoutRepair =
  | { type: "added"; place: Extract<Place, { kind: "software" }>; equipment: string; name: string; family: string }
  | { type: "dropped"; place: EquipmentPlace; equipment: string; name: string; reason: DropReason }
  | { type: "clamped"; place: EquipmentPlace; equipment: string; name: string; from: number; to: number }
  | { type: "clamped"; place: Extract<Place, { kind: "crew" }>; name: string; from: number; to: number };

function placeText(place: Place): string {
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
    case "crew":
      return "in crew";
  }
}

const DROP_TEXT: Record<DropReason, string> = {
  "unknown-equipment": "it's no longer in the Game Data",
  "unknown-slot": "the Ship no longer has this Slot",
  "unknown-slot-group": "the Ship no longer has this Slot Group",
  "doesnt-fit": "it no longer fits",
  "replaced-in-family": "a Ship fits one of each Software Family",
};

/** One line saying what a Repair did, for notices and tooltips. */
export function describeRepair(repair: LoadoutRepair): string {
  switch (repair.type) {
    case "added":
      return `${repair.name} ${placeText(repair.place)}: added, the Ship must fit ${repair.family}`;
    case "dropped":
      return `${repair.name} ${placeText(repair.place)}: dropped, ${DROP_TEXT[repair.reason]}`;
    case "clamped":
      return `${repair.name} ${placeText(repair.place)}: count cut from ${repair.from} to ${repair.to}`;
  }
}
