import { useId } from "react";
import type { Faction, Licence, Ship } from "../gameData.ts";
import { licenceText } from "./licence.ts";

/**
 * The top of the Stats panel: one line per Seller of the Ship, with the
 * Licence the player must hold with that Faction to buy it.
 */
export function ShipBlock({
  ship,
  factions,
  licences,
}: {
  ship: Ship;
  factions: Faction[];
  licences: Licence[];
}) {
  const headingId = useId();
  const licence = licenceText(licences.find((l) => l.id === ship.licence));

  return (
    <section className="ship-block" aria-labelledby={headingId}>
      <h2 id={headingId}>Ship</h2>
      <ul>
        {ship.sellers.map((id) => (
          <li key={id}>
            {factions.find((f) => f.id === id)?.name ?? id}: {licence}
          </li>
        ))}
      </ul>
    </section>
  );
}
