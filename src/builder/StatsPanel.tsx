import { useId, useState } from "react";
import { cn } from "cn";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { compareFigure, comparePrice, type LoadoutStats, type StatRow } from "../stats/stats.ts";
import { formatCredits, formatNumber, formatSigned } from "./format.ts";
import { PANEL_HEADING, verdictClass } from "./styles.ts";
import { TooltipMark } from "./TooltipMark.tsx";

/** The value as the game prints it: already rounded down, with its decimals and thousands separators. */
const formatted = (row: StatRow) => formatNumber(row.shown, row.decimals);

/** A change as "+1,000" or "−1,000" (a true minus sign) with the row's decimals; empty when there is none. */
const signed = (change: number, decimals: number) => (change === 0 ? "" : formatSigned(change, decimals));

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
 * row also gets an unlabelled change column (`success` better, `destructive` worse). A
 * longer delay or charge time, or a higher Price, is worse.
 */
export function StatsPanel({ stats, was = null }: { stats: LoadoutStats; was?: LoadoutStats | null }) {
  const headingId = useId();
  const priceId = useId();
  const groups = [...new Set(stats.rows.map((r) => r.group))];
  const wasShown = new Map(was?.rows.map((r) => [r.id, r.shown]));
  const priceChange = was ? comparePrice(stats.price.average, was.price.average) : null;

  return (
    <>
      <h2 id={headingId} className={cn(PANEL_HEADING, "mt-4")}>
        Stats
      </h2>
      <Table className="mt-1 tabular-nums" aria-labelledby={headingId}>
        {groups.map((group) => (
          <TableBody key={group} className="[&+tbody>tr:first-child>*]:pt-2.5">
            {stats.rows
              .filter((r) => r.group === group)
              .map((r) => (
                <StatTableRow key={r.id} row={r} was={was ? (wasShown.get(r.id) ?? r.shown) : null} />
              ))}
          </TableBody>
        ))}
      </Table>
      <section className="mt-4" aria-labelledby={priceId}>
        <h2 id={priceId} className={PANEL_HEADING}>
          Price
        </h2>
        <p className="mt-1 tabular-nums">
          <span className="text-lg font-semibold">{formatCredits(stats.price.average)}</span>{" "}
          <span className="text-xs text-muted-foreground">
            {formatNumber(stats.price.min, 0)} – {formatCredits(stats.price.max)}
          </span>
          {priceChange && priceChange.difference !== 0 && (
            <>
              {" "}
              <span className={cn("text-xs whitespace-nowrap", verdictClass(priceChange.verdict))}>
                {signed(priceChange.difference, 0)} Cr
              </span>
            </>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Estimate</p>
      </section>
    </>
  );
}

/** A stats table cell: as tight as the game's list. */
const CELL = "h-auto p-px";

/**
 * A stat row, with its change since `was` when given. A row the game explains on mouse-over has its
 * label as a mark whose Tooltip gives the explanation; the row keeps it as its title too, as v1 had
 * it, except while the Tooltip shows it.
 */
function StatTableRow({ row, was }: { row: StatRow; was: number | null }) {
  const [explaining, setExplaining] = useState(false);
  const explanation = TOOLTIPS[row.id];
  const label = `${row.label}${row.unit ? ` (${row.unit})` : ""}`;
  return (
    <TableRow title={explaining ? undefined : explanation} className="border-0 hover:bg-transparent">
      <TableHead scope="row" className={cn(CELL, "font-normal whitespace-normal", SUB_ROWS.has(row.id) && "pl-4")}>
        {explanation ? (
          <TooltipMark explanation={explanation} titled={false} onOpenChange={setExplaining}>
            {label}
          </TooltipMark>
        ) : (
          label
        )}
      </TableHead>
      <TableCell className={cn(CELL, "text-right")}>{formatted(row)}</TableCell>
      {was !== null && <ChangeCell row={row} was={was} />}
    </TableRow>
  );
}

function ChangeCell({ row, was }: { row: StatRow; was: number }) {
  const { difference, verdict } = compareFigure(row.shown, was, row);
  return (
    <TableCell className={cn(CELL, "pl-2 text-right text-xs", verdictClass(verdict))}>
      {signed(difference, row.decimals)}
    </TableCell>
  );
}
