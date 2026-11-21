import type { GameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";

/**
 * "Corsair Clans: Fixture Arms Licence (+10)": the Seller, and the Licence it
 * asks for, under that Seller's own name for it. Just the name when the
 * reputation isn't known.
 */
export function sellerLicenceText(gameData: GameData, item: { licence: string | null }, sellerId: string): string {
  const { factions, licence: licenceOf } = indexGameData(gameData);
  const seller = factions.get(sellerId)?.name ?? sellerId;
  if (item.licence === null) return `${seller}: no Licence needed`;
  const licence = licenceOf(item.licence, sellerId);
  if (!licence) return `${seller}: ${item.licence}`;
  if (licence.reputation === null) return `${seller}: ${licence.name}`;
  const sign = licence.reputation >= 0 ? "+" : "";
  return `${seller}: ${licence.name} (${sign}${licence.reputation})`;
}
