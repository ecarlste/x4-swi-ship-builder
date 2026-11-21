import { describe, expect, test } from "vitest";
import { engineSlot, loadout, ship } from "./testing/fixtures.ts";
import { crewCount, shipEngines } from "./loadout.ts";

describe("shipEngines", () => {
  test("counts the Ship's engine Slots and the sizes of all its engine Slot Groups (AA-9 Gas Miner: 1 + 2 = 3)", () => {
    const aa9 = ship({
      slotGroups: [
        { id: "enginegroup", kinds: { shield: { count: 2, fitList: "fl_shield" }, engine: { count: 1, fitList: "fl_engine_l" } } },
        { id: "enginegroup  ", kinds: { engine: { count: 2, fitList: "fl_engine_l" } } },
        { id: "bottom", kinds: { turret: { count: 4, fitList: "fl_turret" } } },
      ],
    });
    expect(shipEngines(aa9)).toEqual({ count: 3, fitList: "fl_engine_l" });
  });

  test("counts engine Slots (TIE Fighter: 2)", () => {
    expect(shipEngines(ship({ slots: [engineSlot("con_engine_01"), engineSlot("con_engine_02")] }))).toEqual({
      count: 2,
      fitList: "fl_any",
    });
  });

  test("is null for a Ship with no engines", () => {
    expect(shipEngines(ship())).toBeNull();
  });
});

describe("crewCount", () => {
  test("counts service crew and marines together, and no Crew as 0 (the Captain isn't Crew)", () => {
    expect(crewCount(loadout("fx_ship", { crew: { service: 3, marines: 2 } }))).toBe(5);
    expect(crewCount(loadout("fx_ship", { crew: { marines: 2 } }))).toBe(2);
    expect(crewCount(loadout("fx_ship"))).toBe(0);
  });
});
