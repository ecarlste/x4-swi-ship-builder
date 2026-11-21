/**
 * Resolving Loadouts against the bundled Game Data (the tiny fixture under
 * Vitest: SWI "999", X4 "9.99").
 */
import { describe, expect, test } from "vitest";
import { gameData } from "../gameData.ts";
import type { Loadout } from "./loadout.ts";
import { describeRepair } from "./repairs.ts";
import { resolveLoadout } from "./resolve.ts";

const current = { swi: "999", x4: "9.99" };
const older = { swi: "091", x4: "8.00" };

const loadout = (over: Partial<Loadout> = {}): Loadout => ({ format: 1, gameData: current, ship: "fx_courier", ...over });

describe("resolveLoadout", () => {
  test("a Ship that isn't in the Game Data makes the Loadout Unavailable", () => {
    expect(resolveLoadout(gameData, loadout({ ship: "fx_gone" }))).toEqual({ status: "unavailable", ship: "fx_gone" });
  });
});

describe("resolveLoadout: what still fits", () => {
  const fitting = loadout({
    gameData: older,
    slots: { con_weapon_01: "fx_launcher_s", con_shield_01: "fx_shield_s" },
    thruster: "fx_thruster_s",
    software: ["fx_flightassist"],
    consumables: { fx_dart: 6, fx_flare: 5 },
  });

  test("a version change on its own is reported as nothing", () => {
    expect(resolveLoadout(gameData, fitting)).toEqual({
      status: "ok",
      loadout: { ...fitting, gameData: current },
      repairs: [],
      versions: { from: older, to: current },
    });
  });

  test("a Loadout made against the same Game Data comes back as it was", () => {
    const same = { ...fitting, gameData: current };
    expect(resolveLoadout(gameData, same)).toEqual({
      status: "ok",
      loadout: same,
      repairs: [],
      versions: { from: current, to: current },
    });
  });
});

/** The repaired Loadout and the repairs, for a Loadout whose Ship is known. */
function resolved(input: Loadout, data = gameData) {
  const result = resolveLoadout(data, input);
  if (result.status !== "ok") throw new Error("expected the Ship to be known");
  return result;
}

describe("resolveLoadout: Slots", () => {
  test("Equipment in a Slot the Ship no longer has is dropped", () => {
    const { loadout: repaired, repairs } = resolved(
      loadout({ slots: { con_weapon_01: "fx_pulse_s", con_weapon_09: "fx_pulse_s" } }),
    );
    expect(repaired.slots).toEqual({ con_weapon_01: "fx_pulse_s" });
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "slot", slot: "con_weapon_09" },
        equipment: "fx_pulse_s",
        name: "Pulse Blaster",
        reason: "unknown-slot",
      },
    ]);
  });

  test("Equipment that isn't in the Game Data is dropped, under its raw id", () => {
    const { loadout: repaired, repairs } = resolved(loadout({ slots: { con_weapon_01: "fx_gone" } }));
    expect(repaired).not.toHaveProperty("slots");
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "slot", slot: "con_weapon_01" },
        equipment: "fx_gone",
        name: "fx_gone",
        reason: "unknown-equipment",
      },
    ]);
  });

  test("Equipment the Slot no longer takes is dropped", () => {
    const { loadout: repaired, repairs } = resolved(loadout({ slots: { con_shield_01: "fx_shield_m" } }));
    expect(repaired).not.toHaveProperty("slots");
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "slot", slot: "con_shield_01" },
        equipment: "fx_shield_m",
        name: "Bubble Shield M",
        reason: "doesnt-fit",
      },
    ]);
  });
});

describe("resolveLoadout: the engine", () => {
  test("an engine that still fits is kept, and a change in the Ship's engine count isn't reported", () => {
    // The Hauler's engine Slot Group grows from 2 Slots to 3 in this Game Data.
    const moreEngines = {
      ...gameData,
      ships: gameData.ships.map((s) =>
        s.id === "fx_hauler"
          ? { ...s, slotGroups: s.slotGroups.map((g) => (g.kinds.engine ? { ...g, kinds: { ...g.kinds, engine: { ...g.kinds.engine, count: 3 } } } : g)) }
          : s,
      ),
    };
    const result = resolveLoadout(moreEngines, loadout({ ship: "fx_hauler", gameData: older, engine: "fx_engine_l" }));
    if (result.status !== "ok") throw new Error("expected the Ship to be known");
    expect(result.loadout.engine).toBe("fx_engine_l");
    expect(result.repairs).toEqual([]);
  });

  test("an engine in an engine Slot's entry under slots is dropped: engines are fitted to the whole Ship", () => {
    const { loadout: repaired, repairs } = resolved(loadout({ slots: { con_engine_01: "fx_engine_s" } }));
    expect(repaired).not.toHaveProperty("slots");
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "slot", slot: "con_engine_01" },
        equipment: "fx_engine_s",
        name: expect.any(String),
        reason: "unknown-slot",
      },
    ]);
  });

  test("an engine the Ship's engines no longer take is dropped", () => {
    const { loadout: repaired, repairs } = resolved(loadout({ engine: "fx_engine_l" }));
    expect(repaired).not.toHaveProperty("engine");
    expect(repairs).toEqual([
      { type: "dropped", place: { kind: "engine" }, equipment: "fx_engine_l", name: "Haul Engine L", reason: "doesnt-fit" },
    ]);
    expect(describeRepair(repairs[0])).toBe("Haul Engine L as engine: dropped, it no longer fits");
  });

  test("an engine that isn't in the Game Data is dropped, under its raw id", () => {
    const { repairs } = resolved(loadout({ engine: "fx_gone" }));
    expect(repairs).toEqual([
      { type: "dropped", place: { kind: "engine" }, equipment: "fx_gone", name: "fx_gone", reason: "unknown-equipment" },
    ]);
  });
});

describe("resolveLoadout: Slot Groups", () => {
  const hauler = (groups: Loadout["groups"]) => loadout({ ship: "fx_hauler", groups });

  test("Equipment in a Slot Group the Ship no longer has, or a kind the group no longer takes, is dropped", () => {
    const { loadout: repaired, repairs } = resolved(
      hauler({
        group_front: { turret: { equipment: "fx_turret_m", count: 2 } },
        group_back: { turret: { equipment: "fx_turret_m", count: 2 } },
        enginegroup: { turret: { equipment: "fx_turret_m", count: 1 } },
      }),
    );
    expect(repaired.groups).toEqual({
      group_front: { turret: { equipment: "fx_turret_m", count: 2 } },
    });
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "group", group: "group_back", groupKind: "turret" },
        equipment: "fx_turret_m",
        name: "Flak Turret",
        reason: "unknown-slot-group",
      },
      {
        type: "dropped",
        place: { kind: "group", group: "enginegroup", groupKind: "turret" },
        equipment: "fx_turret_m",
        name: "Flak Turret",
        reason: "unknown-slot-group",
      },
    ]);
  });

  test("Equipment that isn't in the Game Data, or that the group no longer takes, is dropped", () => {
    const { loadout: repaired, repairs } = resolved(
      hauler({ group_front: { turret: { equipment: "fx_gone", count: 1 }, shield: { equipment: "fx_shield_s", count: 1 } } }),
    );
    expect(repaired).not.toHaveProperty("groups");
    expect(repairs.map((r) => r.type === "dropped" && r.reason)).toEqual(["unknown-equipment", "doesnt-fit"]);
  });

  test("a count above the group's new number of Slots is clamped to it", () => {
    const { loadout: repaired, repairs } = resolved(
      hauler({ group_front: { turret: { equipment: "fx_turret_m", count: 6 }, shield: { equipment: "fx_shield_m", count: 2 } } }),
    );
    expect(repaired.groups).toEqual({
      group_front: { turret: { equipment: "fx_turret_m", count: 4 }, shield: { equipment: "fx_shield_m", count: 2 } },
    });
    expect(repairs).toEqual([
      {
        type: "clamped",
        place: { kind: "group", group: "group_front", groupKind: "turret" },
        equipment: "fx_turret_m",
        name: "Flak Turret",
        from: 6,
        to: 4,
      },
    ]);
  });
});

describe("resolveLoadout: thruster and software", () => {
  test("a thruster or software the Ship no longer takes, or that isn't in the Game Data, is dropped", () => {
    const { loadout: repaired, repairs } = resolved(
      loadout({ thruster: "fx_thruster_l", software: ["fx_flightassist", "fx_gone", "fx_shield_s"] }),
    );
    expect(repaired).not.toHaveProperty("thruster");
    expect(repaired.software).toEqual(["fx_flightassist"]);
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "thruster" },
        equipment: "fx_thruster_l",
        name: "Steady Thruster L",
        reason: "doesnt-fit",
      },
      { type: "dropped", place: { kind: "software" }, equipment: "fx_gone", name: "fx_gone", reason: "unknown-equipment" },
      {
        type: "dropped",
        place: { kind: "software" },
        equipment: "fx_shield_s",
        name: "Bubble Shield S",
        reason: "doesnt-fit",
      },
    ]);
  });
});

describe("resolveLoadout: consumables", () => {
  test("a consumable the Ship can no longer carry is dropped, including missiles whose launcher was dropped", () => {
    const { loadout: repaired, repairs } = resolved(
      loadout({
        slots: { con_weapon_01: "fx_launcher_s", con_weapon_02: "fx_tube_s" },
        consumables: { fx_dart: 2, fx_torpedo: 2, fx_cargo_drone: 1, fx_gone: 1 },
      }),
    );
    expect(repaired.consumables).toEqual({ fx_dart: 2, fx_torpedo: 2 });
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "consumable" },
        equipment: "fx_cargo_drone",
        name: "Porter Drone",
        reason: "doesnt-fit",
      },
      { type: "dropped", place: { kind: "consumable" }, equipment: "fx_gone", name: "fx_gone", reason: "unknown-equipment" },
    ]);

    const withoutLauncher = resolved(loadout({ slots: { con_weapon_09: "fx_launcher_s" }, consumables: { fx_dart: 2 } }));
    expect(withoutLauncher.loadout).not.toHaveProperty("consumables");
    expect(withoutLauncher.repairs.map((r) => ("equipment" in r ? r.equipment : r.name))).toEqual(["fx_launcher_s", "fx_dart"]);
  });

  test("counts above the Ship's capacity for a kind are clamped, in the order they were stored", () => {
    const { loadout: repaired, repairs } = resolved(
      loadout({
        slots: { con_weapon_01: "fx_launcher_s", con_weapon_02: "fx_tube_s" },
        consumables: { fx_dart: 8, fx_torpedo: 4, fx_flare: 7 },
      }),
    );
    expect(repaired.consumables).toEqual({ fx_dart: 8, fx_torpedo: 2, fx_flare: 5 });
    expect(repairs).toEqual([
      { type: "clamped", place: { kind: "consumable" }, equipment: "fx_torpedo", name: "Heavy Torpedo", from: 4, to: 2 },
      { type: "clamped", place: { kind: "consumable" }, equipment: "fx_flare", name: "Glare Flare", from: 7, to: 5 },
    ]);
  });

  test("a consumable with no capacity left for it is dropped", () => {
    const { loadout: repaired, repairs } = resolved(
      loadout({ slots: { con_weapon_01: "fx_launcher_s", con_weapon_02: "fx_tube_s" }, consumables: { fx_dart: 10, fx_torpedo: 3 } }),
    );
    expect(repaired.consumables).toEqual({ fx_dart: 10 });
    expect(repairs).toEqual([
      {
        type: "dropped",
        place: { kind: "consumable" },
        equipment: "fx_torpedo",
        name: "Heavy Torpedo",
        reason: "doesnt-fit",
      },
    ]);
  });
});

describe("resolveLoadout: Crew", () => {
  test("Crew within the Ship's crew capacity is untouched", () => {
    const crewed = loadout({ ship: "fx_hauler", crew: { service: 12, marines: 8 } });
    const { loadout: repaired, repairs } = resolved(crewed);
    expect(repaired).toEqual(crewed);
    expect(repairs).toEqual([]);
  });

  test("over capacity, service crew is cut first so the marines are kept", () => {
    // The Ironback Hauler holds 20.
    const { loadout: repaired, repairs } = resolved(loadout({ ship: "fx_hauler", crew: { service: 15, marines: 10 } }));
    expect(repaired.crew).toEqual({ service: 10, marines: 10 });
    expect(repairs).toEqual([
      { type: "clamped", place: { kind: "crew", role: "service" }, name: "Service crew", from: 15, to: 10 },
    ]);
  });

  test("when cutting all the service crew isn't enough, the marines are cut too", () => {
    // The Swiftwing Courier holds 1.
    const { loadout: repaired, repairs } = resolved(loadout({ crew: { service: 2, marines: 3 } }));
    expect(repaired.crew).toEqual({ marines: 1 });
    expect(repairs).toEqual([
      { type: "clamped", place: { kind: "crew", role: "marines" }, name: "Marines", from: 3, to: 1 },
      { type: "clamped", place: { kind: "crew", role: "service" }, name: "Service crew", from: 2, to: 0 },
    ]);
  });

  test("a Ship with no crew capacity loses all its Crew, each role cut to 0", () => {
    const { loadout: repaired, repairs } = resolved(loadout({ ship: "fx_needle", crew: { service: 1, marines: 2 } }));
    expect(repaired).not.toHaveProperty("crew");
    expect(repairs).toEqual([
      { type: "clamped", place: { kind: "crew", role: "marines" }, name: "Marines", from: 2, to: 0 },
      { type: "clamped", place: { kind: "crew", role: "service" }, name: "Service crew", from: 1, to: 0 },
    ]);
  });
});

describe("resolveLoadout: Crew is replayed marines first (ADR 0004)", () => {
  // The Swiftwing Courier, holding 3 in this Game Data.
  const roomier = {
    ...gameData,
    ships: gameData.ships.map((s) => (s.id === "fx_courier" ? { ...s, capacities: { ...s.capacities, crew: 3 } } : s)),
  };
  const replayed = (crew: Loadout["crew"]) => resolved(loadout({ crew }), roomier);

  test("service crew is cut to what the marines leave", () => {
    const { loadout: repaired, repairs } = replayed({ service: 4, marines: 2 });
    expect(repaired.crew).toEqual({ service: 1, marines: 2 });
    expect(repairs).toEqual([
      { type: "clamped", place: { kind: "crew", role: "service" }, name: "Service crew", from: 4, to: 1 },
    ]);
  });

  test("marines over capacity are cut to it, then the service crew to 0", () => {
    const { loadout: repaired, repairs } = replayed({ marines: 5, service: 2 });
    expect(repaired.crew).toEqual({ marines: 3 });
    expect(repairs).toEqual([
      { type: "clamped", place: { kind: "crew", role: "marines" }, name: "Marines", from: 5, to: 3 },
      { type: "clamped", place: { kind: "crew", role: "service" }, name: "Service crew", from: 2, to: 0 },
    ]);
  });
});

describe("describeRepair", () => {
  test("names the Equipment, where it was and what happened to it", () => {
    const { repairs } = resolved(
      loadout({
        ship: "fx_hauler",
        slots: { con_shield_09: "fx_shield_m" },
        groups: { group_front: { turret: { equipment: "fx_turret_m", count: 6 } }, group_back: { shield: { equipment: "fx_gone", count: 1 } } },
        thruster: "fx_thruster_s",
      }),
    );
    expect(repairs.map(describeRepair)).toEqual([
      "Bubble Shield M in con_shield_09: dropped, the Ship no longer has this Slot",
      "Flak Turret in group_front turrets: count cut from 6 to 4",
      "fx_gone in group_back shields: dropped, the Ship no longer has this Slot Group",
      "Nimble Thruster S as thruster: dropped, it no longer fits",
    ]);
  });

  test("names the Crew role and how far it was cut", () => {
    const { repairs } = resolved(loadout({ crew: { service: 2, marines: 4 } }));
    expect(repairs.map(describeRepair)).toEqual([
      "Marines in crew: count cut from 4 to 1",
      "Service crew in crew: count cut from 2 to 0",
    ]);
  });
});
