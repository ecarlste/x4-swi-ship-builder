import type { Equipment, GameData } from "../gameData.ts";
import type { Loadout } from "../loadout/loadout.ts";
import { compareEquipment, type Figure } from "../stats/stats.ts";
import { sellerLicenceText } from "./licence.ts";
import { formatCredits, formatNumber, formatSigned } from "./format.ts";
import { verdictClass } from "./styles.ts";

/** "+300", "−100" (a true minus sign) or "±0". */
const signed = (n: number, decimals = 0) => (n === 0 ? "±0" : formatSigned(n, decimals));

/** The decimals `n` needs, up to 2. */
function decimalsOf(n: number) {
  const hundredths = Math.round(Math.abs(n) * 100);
  return hundredths % 100 === 0 ? 0 : hundredths % 10 === 0 ? 1 : 2;
}

/** A figure's value with its unit, and its difference, at the decimals either needs. */
function formatFigure(f: Figure) {
  const decimals = Math.max(decimalsOf(f.shown), decimalsOf(f.difference));
  return {
    value: `${formatNumber(f.shown, decimals)}${f.unit ? ` ${f.unit}` : ""}`,
    difference: signed(f.difference, decimals),
    verdict: f.verdict,
  };
}

/** A figures table cell: tight rows, a gap before the next column. */
const cell = (align: string) => `py-px pr-2 font-normal tabular-nums ${align}`;

/**
 * The comparison of a highlighted dropdown option with the fitted item (#10, #23):
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
  const lines = [
    ...comparison.figures.map((f) => ({ label: f.label, ...formatFigure(f) })),
    {
      label: "Price",
      value: formatCredits(comparison.price.shown),
      difference: signed(comparison.price.difference),
      verdict: comparison.price.verdict,
    },
  ];

  return (
    <>
      <div className="mb-1 font-medium">{option.name}</div>
      {comparison.missiles && (
        <table className="mb-2 border-collapse" aria-label="Missiles">
          <thead>
            <tr>
              <th scope="col" className={cell("text-left text-muted-foreground")}>
                Missile
              </th>
              <th scope="col" colSpan={2} className={cell("text-right")}>
                Burst
              </th>
              <th scope="col" colSpan={2} className={cell("text-right")}>
                Sustained
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.missiles.map((row) => (
              <tr key={row.missile?.id ?? ""}>
                <th scope="row" className={cell("text-left")}>
                  {row.missile?.name ?? "No missile"}
                  {row.loaded && <span className="text-muted-foreground"> ◂ loaded</span>}
                </th>
                {row.figures.map(formatFigure).flatMap((c, i) => [
                  <td key={`${i}-value`} className={cell("text-right")}>
                    {c.value}
                  </td>,
                  <td key={`${i}-difference`} className={cell("text-right")}>
                    <span className={verdictClass(c.verdict)}>{c.difference}</span>
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="mb-2 border-collapse">
        <tbody>
          {lines.map((line) => (
            <tr key={line.label}>
              <th scope="row" className={cell("text-left")}>
                {line.label}
              </th>
              <td className={cell("text-right")}>{line.value}</td>
              <td className={cell("text-right")}>
                <span className={verdictClass(line.verdict)}>{line.difference}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted-foreground">Sellers</div>
      <ul className="mt-0.5 list-disc pl-5">
        {option.sellers.map((id) => (
          <li key={id}>{sellerLicenceText(gameData, option, id)}</li>
        ))}
      </ul>
    </>
  );
}
