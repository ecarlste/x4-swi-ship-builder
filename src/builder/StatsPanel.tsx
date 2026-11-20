import { useId } from "react";
import type { LoadoutStats, StatRow } from "../stats/stats.ts";

const number = (value: number) => Math.round(value).toLocaleString("en-US");

/** The value as the game prints it: already rounded down, with its decimals and thousands separators. */
const formatted = (row: StatRow) =>
  row.shown.toLocaleString("en-US", { minimumFractionDigits: row.decimals, maximumFractionDigits: row.decimals });

/** Rows the game indents under the row above them. */
const SUB_ROWS = new Set([
  "ShieldRate",
  "ShieldDelay",
  "GroupedShieldRate",
  "GroupedShieldDelay",
  "ForwardAcceleration",
  "BoostAcceleration",
  "BoostMaxDuration",
  "BoostRechargeRate",
  "TravelAcceleration",
  "TravelChargeTime",
  "HorizontalStrafeAcceleration",
]);

/** The game's mouse-over texts. */
const TOOLTIPS: Record<string, string> = {
  GroupedShieldValue: "The average shield of the engine and turret groups.",
};

/**
 * The game's stat rows, grouped as the configuration screen groups them,
 * then the Loadout's total price with its min–max range.
 */
export function StatsPanel({ stats }: { stats: LoadoutStats }) {
  const priceId = useId();
  const groups = [...new Set(stats.rows.map((r) => r.group))];

  return (
    <>
      <table className="stats-table" aria-label="Ship statistics">
        {groups.map((group) => (
          <tbody key={group}>
            {stats.rows
              .filter((r) => r.group === group)
              .map((r) => (
                <tr key={r.id} title={TOOLTIPS[r.id]}>
                  <th scope="row" className={SUB_ROWS.has(r.id) ? "stat-sub" : undefined}>
                    {r.label}
                    {r.unit && ` (${r.unit})`}
                  </th>
                  <td>{formatted(r)}</td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>
      <section className="stats-price" aria-labelledby={priceId}>
        <h2 id={priceId}>Price</h2>
        <p>
          <span className="stats-price-average">{number(stats.price.average)} Cr</span>{" "}
          <span className="stats-price-range">
            {number(stats.price.min)} – {number(stats.price.max)} Cr
          </span>
        </p>
      </section>
    </>
  );
}
