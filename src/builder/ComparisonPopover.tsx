import type { Equipment, GameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import type { Loadout } from "./loadout.ts";
import { compareEquipment, type Figure } from "../stats/stats.ts";
import { licenceText } from "./licence.ts";
import { formatCredits, formatNumber, formatSigned } from "./format.ts";

/** "+300", "−100" (a true minus sign) or "±0". */
const signed = (n: number, decimals = 0) => (n === 0 ? "±0" : formatSigned(n, decimals));

const decimalsOf = (n: number) => (Number.isInteger(n) ? 0 : 1);

/** A figure's value with its unit, and its difference, at the decimals either needs. */
function cells(f: Figure) {
  const decimals = Math.max(decimalsOf(f.shown), decimalsOf(f.difference));
  return {
    value: `${formatNumber(f.shown, decimals)}${f.unit ? ` ${f.unit}` : ""}`,
    difference: signed(f.difference, decimals),
    verdict: f.verdict,
  };
}

/**
 * The comparison of a hovered dropdown option with the fitted item (#10, #23):
 * its figures and price, each with its difference, then its Sellers and their
 * Licences. A launcher's figures are one row per missile it can fire, best
 * first, then "No missile", with the row the stats panel uses marked "loaded"
 * (#65, ADR 0002). Slot Group items count as one unit.
 */
export function ComparisonPopover({
  gameData,
  loadout,
  option,
  fitted,
}: {
  gameData: GameData;
  loadout: Loadout;
  option: Equipment;
  /** The fitted item, or null for an empty Slot. */
  fitted: Equipment | null;
}) {
  const comparison = compareEquipment(gameData, loadout, option, fitted);
  const { factions, licences } = indexGameData(gameData);
  const licence = licenceText(option.licence === null ? undefined : licences.get(option.licence));
  const lines = [
    ...comparison.figures.map((f) => ({ label: f.label, ...cells(f) })),
    {
      label: "Price",
      value: formatCredits(comparison.price.shown),
      difference: signed(comparison.price.difference),
      verdict: comparison.price.verdict,
    },
  ];

  return (
    <>
      <div className="comparison-name">{option.name}</div>
      {comparison.missiles && (
        <table className="comparison-figures" aria-label="Missiles">
          <thead>
            <tr>
              <th scope="col" className="dim">
                Missile
              </th>
              <th scope="col" colSpan={2} className="num">
                Burst
              </th>
              <th scope="col" colSpan={2} className="num">
                Sustained
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.missiles.map((row) => (
              <tr key={row.missile?.id ?? ""}>
                <th scope="row">
                  {row.missile?.name ?? "No missile"}
                  {row.loaded && <span className="dim"> ◂ loaded</span>}
                </th>
                {row.figures.map(cells).flatMap((c, i) => [
                  <td key={`${i}-value`} className="num">
                    {c.value}
                  </td>,
                  <td key={`${i}-difference`} className="num">
                    <span className={`difference ${c.verdict}`}>{c.difference}</span>
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="comparison-figures">
        <tbody>
          {lines.map((line) => (
            <tr key={line.label}>
              <th scope="row">{line.label}</th>
              <td className="num">{line.value}</td>
              <td className="num">
                <span className={`difference ${line.verdict}`}>{line.difference}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dim">Sellers</div>
      <ul className="comparison-sellers">
        {option.sellers.map((id) => (
          <li key={id}>
            {factions.get(id)?.name ?? id}: {licence}
          </li>
        ))}
      </ul>
    </>
  );
}
