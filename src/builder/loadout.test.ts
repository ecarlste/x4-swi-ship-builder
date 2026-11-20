import { describe, expect, test } from "vitest";
import { engineSlot, loadout, ship } from "../stats/testing/fixtures.ts";
import { crewCount, setCrew, setEngine, shipEngines } from "./loadout.ts";

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

describe("setEngine", () => {
  test("fits one engine to the whole Ship, and null removes it", () => {
    const fitted = setEngine(loadout("fx_ship"), "engine_fusial");
    expect(fitted).toEqual(loadout("fx_ship", { engine: "engine_fusial" }));
    expect(setEngine(fitted, null)).toEqual(loadout("fx_ship"));
  });
});

describe("setCrew", () => {
  test("sets one Crew count and keeps the other", () => {
    const service = setCrew(loadout("fx_ship"), "service", 3);
    expect(service).toEqual(loadout("fx_ship", { crew: { service: 3 } }));
    expect(setCrew(service, "marines", 2)).toEqual(loadout("fx_ship", { crew: { service: 3, marines: 2 } }));
  });

  test("a count of 0 removes it, and both at 0 give back an Empty Loadout", () => {
    const both = loadout("fx_ship", { crew: { service: 3, marines: 2 } });
    const marinesOnly = setCrew(both, "service", 0);
    expect(marinesOnly).toEqual(loadout("fx_ship", { crew: { marines: 2 } }));
    expect(setCrew(marinesOnly, "marines", 0)).toEqual(loadout("fx_ship"));
  });
});

describe("crewCount", () => {
  test("counts service crew and marines together, and no Crew as 0 (the Captain isn't Crew)", () => {
    expect(crewCount(loadout("fx_ship", { crew: { service: 3, marines: 2 } }))).toBe(5);
    expect(crewCount(loadout("fx_ship", { crew: { marines: 2 } }))).toBe(2);
    expect(crewCount(loadout("fx_ship"))).toBe(0);
  });
});
