import { describe, expect, test } from "vitest";
import { loadoutStats } from "./stats.ts";
import { gameData, loadout, ship } from "./testing/fixtures.ts";

describe("stat rows where lower is better", () => {
  test("are the recharge delay and travel charge time rows, and no others", () => {
    const stats = loadoutStats(gameData([ship()]), loadout("fx_ship"));
    expect(stats.rows.filter((r) => r.lowerIsBetter).map((r) => r.id)).toEqual(["ShieldDelay", "TravelChargeTime"]);
  });
});
