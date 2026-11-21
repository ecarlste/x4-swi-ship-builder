/**
 * Game Data looked up by id. The index is built once per Game Data object and
 * kept for as long as that object lives, so every caller can ask for it
 * freely instead of building its own maps.
 */
import type { Equipment, Faction, GameData, Licence, Ship } from "./gameData.ts";

export interface GameDataIndex {
  ships: ReadonlyMap<string, Ship>;
  equipment: ReadonlyMap<string, Equipment>;
  /** Fit list id → the Equipment ids it lists. */
  fitLists: ReadonlyMap<string, readonly string[]>;
  factions: ReadonlyMap<string, Faction>;
  licences: ReadonlyMap<string, Licence>;
  /** Whether the fit list lists this Equipment id; false for an unknown fit list. */
  fits(fitListId: string, equipmentId: string): boolean;
  /** The Equipment a fit list lists, in its order; empty for an unknown fit list. */
  fitListEquipment(fitListId: string): Equipment[];
  /**
   * A piece of software and every one it replaces, newest first: its chain
   * in its Software Family. The last id is the family's first ware, the same
   * for every ware of the family. Just the id for anything else.
   */
  softwareChain(equipmentId: string): readonly string[];
}

const indexes = new WeakMap<GameData, GameDataIndex>();

/** The index of this Game Data, built on first use. */
export function indexGameData(gameData: GameData): GameDataIndex {
  let index = indexes.get(gameData);
  if (!index) {
    index = buildIndex(gameData);
    indexes.set(gameData, index);
  }
  return index;
}

function buildIndex(gameData: GameData): GameDataIndex {
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
  const equipment = byId(gameData.equipment);
  const fitLists = new Map(gameData.fitLists.map((f) => [f.id, f.equipment]));
  const fitListSets = new Map(gameData.fitLists.map((f) => [f.id, new Set(f.equipment)]));
  return {
    ships: byId(gameData.ships),
    equipment,
    fitLists,
    factions: byId(gameData.factions),
    licences: byId(gameData.licences),
    fits: (fitListId, equipmentId) => fitListSets.get(fitListId)?.has(equipmentId) ?? false,
    fitListEquipment: (fitListId) => (fitLists.get(fitListId) ?? []).flatMap((id) => equipment.get(id) ?? []),
    softwareChain: (equipmentId) => {
      const chain = [equipmentId];
      // The integrity pass refuses cycles; stopping at a repeat keeps this safe regardless.
      for (let at = equipment.get(equipmentId); at?.kind === "software" && at.predecessor !== null; ) {
        if (chain.includes(at.predecessor)) break;
        chain.push(at.predecessor);
        at = equipment.get(at.predecessor);
      }
      return chain;
    },
  };
}
