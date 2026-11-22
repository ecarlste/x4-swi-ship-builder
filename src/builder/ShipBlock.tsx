import { useId } from "react";
import type { GameData, Ship } from "../gameData.ts";
import { sellerLicenceText } from "./licence.ts";
import { PANEL_HEADING } from "./styles.ts";

/**
 * The top of the Stats panel: one line per Seller of the Ship, with the
 * Licence the player must hold with that Faction to buy it, under that
 * Faction's own name for it.
 */
export function ShipBlock({ gameData, ship }: { gameData: GameData; ship: Ship }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={PANEL_HEADING}>
        Ship
      </h2>
      <ul className="mt-1 text-sm">
        {ship.sellers.map((id) => (
          <li key={id}>{sellerLicenceText(gameData, ship, id)}</li>
        ))}
      </ul>
    </section>
  );
}
