import type { Equipment, GameData } from "../gameData.ts";
import type { Loadout } from "../loadout/loadout.ts";
import { compareEquipment, type Figure } from "../stats/stats.ts";
import { sellerLicenceText } from "./licence.ts";
import { formatCredits, formatNumber, formatSigned } from "./format.ts";
import { verdictClass } from "./styles.ts";
import { cn } from "cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
const cell = (className: string) => cn("h-auto py-px pr-2 pl-0 font-normal tabular-nums", className);

/** A figures table row: no rule between rows, and no hover, since nothing in it is clickable. */
const ROW = "border-0 hover:bg-transparent";

/**
 * The comparison of a highlighted Equipment option with the fitted item (#10, #23):
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
        <Table className="mb-2 w-auto" aria-label="Missiles">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className={ROW}>
              <TableHead scope="col" className={cell("text-left text-muted-foreground")}>
                Missile
              </TableHead>
              <TableHead scope="col" colSpan={2} className={cell("text-right")}>
                Burst
              </TableHead>
              <TableHead scope="col" colSpan={2} className={cell("text-right")}>
                Sustained
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.missiles.map((row) => (
              <TableRow className={ROW} key={row.missile?.id ?? ""}>
                <TableHead scope="row" className={cell("text-left")}>
                  {row.missile?.name ?? "No missile"}
                  {row.loaded && <span className="text-muted-foreground"> ◂ loaded</span>}
                </TableHead>
                {row.figures.map(formatFigure).flatMap((c, i) => [
                  <TableCell key={`${i}-value`} className={cell("text-right")}>
                    {c.value}
                  </TableCell>,
                  <TableCell key={`${i}-difference`} className={cell("text-right")}>
                    <span className={verdictClass(c.verdict)}>{c.difference}</span>
                  </TableCell>,
                ])}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Table className="mb-2 w-auto">
        <TableBody>
          {lines.map((line) => (
            <TableRow className={ROW} key={line.label}>
              <TableHead scope="row" className={cell("text-left")}>
                {line.label}
              </TableHead>
              <TableCell className={cell("text-right")}>{line.value}</TableCell>
              <TableCell className={cell("text-right")}>
                <span className={verdictClass(line.verdict)}>{line.difference}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="text-muted-foreground">Sellers</div>
      <ul className="mt-0.5 list-disc pl-5">
        {option.sellers.map((id) => (
          <li key={id}>{sellerLicenceText(gameData, option, id)}</li>
        ))}
      </ul>
    </>
  );
}
