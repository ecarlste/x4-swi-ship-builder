import type { Equipment, GameData } from "../gameData.ts";
import type { Loadout } from "./loadout.ts";
import { compareEquipment } from "../stats/stats.ts";
import { licenceText } from "./licence.ts";

const format = (n: number, decimals = 0) =>
  n.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** "+300", "−100" (a true minus sign) or "±0". */
function signed(n: number, decimals = 0): string {
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "−"}${format(Math.abs(n), decimals)}`;
}

const decimalsOf = (n: number) => (Number.isInteger(n) ? 0 : 1);

/**
 * The comparison of a hovered dropdown option with the fitted item (#10, #23):
 * its figures and price, each with its difference, then its Sellers and their
 * Licences. Slot Group items count as one unit.
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
  const licence = licenceText(gameData.licences.find((l) => l.id === option.licence));
  const lines = [
    ...comparison.figures.map((f) => {
      const decimals = Math.max(decimalsOf(f.shown), decimalsOf(f.difference));
      return {
        label: f.label,
        value: `${format(f.shown, decimals)}${f.unit ? ` ${f.unit}` : ""}`,
        difference: signed(f.difference, decimals),
        verdict: f.verdict,
      };
    }),
    {
      label: "Price",
      value: `${format(comparison.price.shown)} Cr`,
      difference: signed(comparison.price.difference),
      verdict: comparison.price.verdict,
    },
  ];

  return (
    <>
      <div className="comparison-name">{option.name}</div>
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
            {gameData.factions.find((f) => f.id === id)?.name ?? id}: {licence}
          </li>
        ))}
      </ul>
    </>
  );
}
