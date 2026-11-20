import { useId } from "react";
import { compareFigure, shownPrice, type LoadoutStats, type StatRow, type Verdict } from "../stats/stats.ts";
import { formatCredits, formatNumber, formatSigned } from "./format.ts";

/** The value as the game prints it: already rounded down, with its decimals and thousands separators. */
const formatted = (row: StatRow) => formatNumber(row.shown, row.decimals);

/** A change as "+1,000" or "−1,000" (a true minus sign) with the row's decimals; empty when there is none. */
const signed = (change: number, decimals: number) => (change === 0 ? "" : formatSigned(change, decimals));

/** The change's class: green when better, red when worse, none when the same. */
const judged = (verdict: Verdict) => (verdict === "same" ? "" : verdict);

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
 * estimate (ADR 0003, ADR 0004).
 *
 * Given `was`, the stats of the Loadout as it was opened or last saved, each
 * row also gets an unlabelled change column (green better, red worse). A
 * higher Price is worse.
 */
export function StatsPanel({ stats, was = null }: { stats: LoadoutStats; was?: LoadoutStats | null }) {
  const headingId = useId();
  const priceId = useId();
  const groups = [...new Set(stats.rows.map((r) => r.group))];
  const wasShown = new Map(was?.rows.map((r) => [r.id, r.shown]));
  const priceChange = was
    ? compareFigure(shownPrice(stats.price.average), shownPrice(was.price.average), { decimals: 0, lowerIsBetter: true })
    : null;

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
                  {was && <ChangeCell shown={r.shown} was={wasShown.get(r.id) ?? r.shown} decimals={r.decimals} />}
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
          {priceChange && priceChange.difference !== 0 && (
            <>
              {" "}
              <span className={`stat-change ${judged(priceChange.verdict)}`}>{signed(priceChange.difference, 0)} Cr</span>
            </>
          )}
        </p>
        <p className="stats-price-note">Estimate</p>
      </section>
    </>
  );
}

function ChangeCell({ shown, was, decimals }: { shown: number; was: number; decimals: number }) {
  const { difference, verdict } = compareFigure(shown, was, { decimals });
  return <td className={`stat-change ${judged(verdict)}`.trim()}>{signed(difference, decimals)}</td>;
}
