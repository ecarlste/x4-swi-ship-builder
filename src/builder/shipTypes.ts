/**
 * Display names for the game's Ship Type ids (the macro's `<ship type>`).
 * Only types a buildable Ship can have are listed; drones, laser towers and
 * the like never reach the builder.
 */
const SHIP_TYPE_LABELS: Record<string, string> = {
  scout: "Scout",
  fighter: "Fighter",
  heavyfighter: "Heavy Fighter",
  interceptor: "Interceptor",
  bomber: "Bomber",
  corvette: "Corvette",
  gunboat: "Gunboat",
  frigate: "Frigate",
  destroyer: "Destroyer",
  battleship: "Battleship",
  carrier: "Carrier",
  resupplier: "Resupplier",
  courier: "Courier",
  freighter: "Freighter",
  transporter: "Transporter",
  miner: "Miner",
  largeminer: "Large Miner",
  scavenger: "Scavenger",
  builder: "Builder",
  tug: "Tug",
  police: "Police",
};

/**
 * The display name of a Ship Type. A type missing from the table falls back
 * to its id with a capital first letter, so new SWI types still show up;
 * add them to the table when they do.
 */
export function shipTypeLabel(type: string): string {
  return SHIP_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
