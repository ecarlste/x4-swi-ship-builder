/**
 * The app's only entry point to Game Data.
 *
 * The snapshot is bundled at build time from the folder GAME_DATA_DIR points
 * at (see vite.config.ts) and is checked against the shared schema and
 * reference-integrity pass before the app uses it.
 */
import equipment from "@snapshot/equipment.json";
import factions from "@snapshot/factions.json";
import fitLists from "@snapshot/fit-lists.json";
import licences from "@snapshot/licences.json";
import manifest from "@snapshot/manifest.json";
import ships from "@snapshot/ships.json";
import { validateSnapshot, type GameData } from "../shared/game-data/validateSnapshot.ts";

export type { GameData } from "../shared/game-data/validateSnapshot.ts";
export type * from "../shared/game-data/schema.ts";

function load(): GameData {
  const result = validateSnapshot({
    manifest,
    ships,
    equipment,
    "fit-lists": fitLists,
    factions,
    licences,
  });
  if (!result.ok) {
    throw new Error(`The bundled Game Data is invalid:\n${result.errors.join("\n")}`);
  }
  return result.gameData;
}

export const gameData: GameData = load();
