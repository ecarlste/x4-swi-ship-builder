import { useId } from "react";
import type { Faction, Licence, Ship } from "../gameData.ts";

/** "Fixture Arms Licence (+10)", or just the name when the reputation isn't known. */
function licenceText(licence: Licence | undefined): string {
  if (!licence) return "no Licence needed";
  if (licence.reputation === null) return licence.name;
  const sign = licence.reputation >= 0 ? "+" : "";
  return `${licence.name} (${sign}${licence.reputation})`;
}

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
