/**
 * Changes since loading (spec #25, decided in #10 and #96): the builder keeps
 * a copy of the Loadout it opened or last saved, and shows differences only
 * while the current Loadout differs from it.
 */
import type { GameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { loadoutLines } from "../loadout/lines.ts";
import type { Loadout } from "../loadout/loadout.ts";

/**
 * Whether two Loadouts are of the same Ship and hold the same Equipment and
 * counts at every Place. Places are compared over both Loadouts' lines, so
 * missiles that lost their launcher still count. The Game Data version stamp
 * doesn't.
 */
export function sameLoadout(gameData: GameData, a: Loadout, b: Loadout): boolean {
  const ship = indexGameData(gameData).ships.get(a.ship);
  if (!ship || a.ship !== b.ship) return false;
  const unchanged = (now: Loadout, loaded: Loadout) => loadoutLines(gameData, ship, now, loaded).every((l) => !("was" in l));
  return unchanged(a, b) && unchanged(b, a);
}

/** The Loaded Loadout to compare against, or null when there is none, it's of another Ship, or nothing has changed. */
export function changedSince(gameData: GameData, loaded: Loadout | null, loadout: Loadout | null): Loadout | null {
  if (!loaded || !loadout || loaded.ship !== loadout.ship) return null;
  return sameLoadout(gameData, loaded, loadout) ? null : loaded;
}
