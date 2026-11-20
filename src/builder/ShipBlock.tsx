import { useId } from "react";
import type { GameData, Ship } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { licenceText } from "./licence.ts";

/**
 * The top of the Stats panel: one line per Seller of the Ship, with the
 * Licence the player must hold with that Faction to buy it.
 */
export function ShipBlock({ gameData, ship }: { gameData: GameData; ship: Ship }) {
  const headingId = useId();
  const { factions, licences } = indexGameData(gameData);
  const licence = licenceText(ship.licence === null ? undefined : licences.get(ship.licence));

  return (
    <section className="ship-block" aria-labelledby={headingId}>
      <h2 id={headingId}>Ship</h2>
      <ul>
        {ship.sellers.map((id) => (
          <li key={id}>
            {factions.get(id)?.name ?? id}: {licence}
          </li>
        ))}
      </ul>
    </section>
  );
}
