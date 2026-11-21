import { useId } from "react";
import type { GameData, Ship } from "../gameData.ts";
import { sellerLicenceText } from "./licence.ts";

/**
 * The top of the Stats panel: one line per Seller of the Ship, with the
 * Licence the player must hold with that Faction to buy it, under that
 * Faction's own name for it.
 */
export function ShipBlock({ gameData, ship }: { gameData: GameData; ship: Ship }) {
  const headingId = useId();

  return (
    <section className="ship-block" aria-labelledby={headingId}>
      <h2 id={headingId}>Ship</h2>
      <ul>
        {ship.sellers.map((id) => (
          <li key={id}>{sellerLicenceText(gameData, ship, id)}</li>
        ))}
      </ul>
    </section>
  );
}
