import { useId } from "react";
import type { LoadoutStats, StatRow } from "../stats/stats.ts";
import { formatCredits, formatNumber, formatSigned } from "./format.ts";

/** The value as the game prints it: already rounded down, with its decimals and thousands separators. */
const formatted = (row: StatRow) => formatNumber(row.shown, row.decimals);

/** A change as "+1,000" or "−1,000" (a true minus sign) with the row's decimals; empty when there is none. */
const signed = (change: number, decimals: number) => (change === 0 ? "" : formatSigned(change, decimals));

const direction = (change: number) => (change > 0 ? "up" : change < 0 ? "down" : "");

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
  TurretSustainedDPS: "all turrets' damage averaged over six directions",
  GroupedTurretSustainedDPS: "all turrets' damage averaged over six directions",
};

/**
 * The game's stat rows, grouped as the configuration screen groups them,
 * then the Loadout's total price with its min–max range, labelled as an
 * estimate that leaves out crew (ADR 0003).
 *
 * Given `was`, the stats of the Loadout as it was opened or last saved, each
 * row also gets an unlabelled change column (green up, red down).
 */
export function StatsPanel({ stats, was = null }: { stats: LoadoutStats; was?: LoadoutStats | null }) {
  const headingId = useId();
  const priceId = useId();
  const groups = [...new Set(stats.rows.map((r) => r.group))];
  const wasShown = new Map(was?.rows.map((r) => [r.id, r.shown]));
  const priceChange = was ? Math.round(stats.price.average) - Math.round(was.price.average) : 0;

  return (
    <>
      <h2 id={headingId} className="stats-heading">
        Stats
      </h2>
      <table className="stats-table" aria-labelledby={headingId}>
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
                  {was && <ChangeCell change={r.shown - (wasShown.get(r.id) ?? r.shown)} decimals={r.decimals} />}
                </tr>
              ))}
          </tbody>
        ))}
      </table>
      <section className="stats-price" aria-labelledby={priceId}>
        <h2 id={priceId}>Price</h2>
        <p>
          <span className="stats-price-average">{formatCredits(stats.price.average)}</span>{" "}
          <span className="stats-price-range">
            {formatNumber(stats.price.min, 0)} – {formatCredits(stats.price.max)}
          </span>
          {priceChange !== 0 && (
            <>
              {" "}
              <span className={`stat-change ${direction(priceChange)}`}>{signed(priceChange, 0)} Cr</span>
            </>
          )}
        </p>
        <p className="stats-price-note">Estimate · excludes crew</p>
      </section>
    </>
  );
}

function ChangeCell({ change, decimals }: { change: number; decimals: number }) {
  // Both values are already rounded down; rounding the difference drops float noise.
  const rounded = Number(change.toFixed(decimals));
  return <td className={`stat-change ${direction(rounded)}`.trim()}>{signed(rounded, decimals)}</td>;
}
