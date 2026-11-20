import { describe, expect, test } from "vitest";
import { compareFigure, shownPrice, shownValue } from "./figure.ts";

describe("a figure's shown value", () => {
  test("is rounded down to its decimals, as the game prints it", () => {
    expect(shownValue(1234.99, 0)).toBe(1234);
    expect(shownValue(2.38, 1)).toBe(2.3);
    expect(shownValue(7, 2)).toBe(7);
  });

  test("float noise never drops it a step: 0.29 at two decimals stays 0.29", () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(shownValue(0.29, 2)).toBe(0.29);
    expect(shownValue(1.13, 2)).toBe(1.13);
  });

  test("a price is shown in whole credits, rounded to the nearest", () => {
    expect(shownPrice(1234.5)).toBe(1235);
    expect(shownPrice(1234.4)).toBe(1234);
  });
});

describe("a figure's difference and verdict", () => {
  test("a higher figure is better, by the difference at its decimals", () => {
    expect(compareFigure(5000, 3000, { decimals: 0 })).toEqual({ difference: 2000, verdict: "better" });
    expect(compareFigure(3000, 5000, { decimals: 0 })).toEqual({ difference: -2000, verdict: "worse" });
  });

  test("float noise never shows as a difference", () => {
    // 2.3 - 2.1 is 0.19999999999999973 in floating point.
    expect(compareFigure(2.3, 2.1, { decimals: 1 })).toEqual({ difference: 0.2, verdict: "better" });
    expect(compareFigure(0.3, 0.1 + 0.2, { decimals: 2 })).toEqual({ difference: 0, verdict: "same" });
  });

  test("an equal figure is the same, with a difference of plain 0, never −0", () => {
    const { difference, verdict } = compareFigure(-0.0001, 0, { decimals: 0 });
    expect(difference).toBe(0);
    expect(Object.is(difference, -0)).toBe(false);
    expect(verdict).toBe("same");
  });

  test("where lower is better, as for Price, a higher figure is worse", () => {
    expect(compareFigure(30000, 12000, { decimals: 0, lowerIsBetter: true })).toEqual({
      difference: 18000,
      verdict: "worse",
    });
    expect(compareFigure(12000, 30000, { decimals: 0, lowerIsBetter: true })).toEqual({
      difference: -18000,
      verdict: "better",
    });
    expect(compareFigure(12000, 12000, { decimals: 0, lowerIsBetter: true }).verdict).toBe("same");
  });
});
