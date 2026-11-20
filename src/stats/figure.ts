/**
 * A figure as the Stats panel and the comparison popover show it: its shown
 * value, its difference from another figure, and whether that difference is
 * better, worse or the same (#98). Both use this, so one figure never rounds
 * or judges differently in the two places.
 */

export type Verdict = "better" | "worse" | "same";

export interface FigureComparison {
  /** The shown value minus the other, at the figure's decimals, so float noise never shows. */
  difference: number;
  verdict: Verdict;
}

/** Significant digits kept before rounding, to drop float noise such as 0.29 * 100 = 28.999999999999996. */
const PRECISION = 12;

/** The value rounded down to `decimals`, as the game prints its stats. */
export function shownValue(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.floor(Number((value * scale).toPrecision(PRECISION))) / scale;
}

/** A price in whole credits, rounded to the nearest. */
export const shownPrice = (average: number): number => Math.round(average);

/**
 * `shown` against `other`, both already shown values. Higher is better
 * unless `lowerIsBetter`, as for Price.
 */
export function compareFigure(
  shown: number,
  other: number,
  { decimals, lowerIsBetter = false }: { decimals: number; lowerIsBetter?: boolean },
): FigureComparison {
  const scale = 10 ** decimals;
  // `+ 0` turns a −0 into 0.
  const difference = Math.round((shown - other) * scale) / scale + 0;
  const gain = lowerIsBetter ? -difference : difference;
  return { difference, verdict: gain > 0 ? "better" : gain < 0 ? "worse" : "same" };
}
