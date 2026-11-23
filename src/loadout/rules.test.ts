/**
 * The Loadout's fit and capacity rules, through the edits and queries of
 * `loadoutRules`, against hand-made Game Data.
 */
import { describe, expect, test } from "vitest";
import {
  engine,
  engineSlot,
  gameData,
  launcher,
  priced,
  loadout,
  missile,
  shield,
  shieldSlot,
  ship,
  software,
  thruster,
  turretGroup,
  weaponSlot,
} from "./testing/fixtures.ts";
import { describeRepair } from "./repairs.ts";
import { loadoutRules } from "./rules.ts";

const bubble = shield("fx_bubble", 100, 10, 1);
const wall = shield("fx_wall", 500, 20, 2);

describe("setSlot", () => {
  const courier = ship({ slots: [{ ...shieldSlot("con_shield_01"), fitList: "fl_small" }] });
  const rules = loadoutRules(gameData([courier], [bubble, wall], [{ id: "fl_small", equipment: ["fx_bubble"] }]), courier);

  test("fits Equipment on the Slot's fit list, and null empties the Slot", () => {
    const fitted = rules.setSlot(loadout("fx_ship"), "con_shield_01", "fx_bubble");
    expect(fitted).toEqual({ loadout: loadout("fx_ship", { slots: { con_shield_01: "fx_bubble" } }), repairs: [] });
    expect(rules.setSlot(fitted.loadout, "con_shield_01", null)).toEqual({ loadout: loadout("fx_ship"), repairs: [] });
  });

  test("refuses Equipment that isn't on the fit list, a Slot the Ship doesn't have, and unknown Equipment", () => {
    const start = loadout("fx_ship", { slots: { con_shield_01: "fx_bubble" } });
    const place = { kind: "slot", slot: "con_shield_01" } as const;
    expect(rules.setSlot(start, "con_shield_01", "fx_wall")).toEqual({
      loadout: start,
      repairs: [{ type: "dropped", place, equipment: "fx_wall", name: "fx_wall", reason: "doesnt-fit" }],
    });
    expect(rules.setSlot(start, "con_shield_09", "fx_bubble").repairs).toEqual([
      { type: "dropped", place: { kind: "slot", slot: "con_shield_09" }, equipment: "fx_bubble", name: "fx_bubble", reason: "unknown-slot" },
    ]);
    expect(rules.setSlot(start, "con_shield_01", "fx_gone")).toEqual({
      loadout: start,
      repairs: [{ type: "dropped", place, equipment: "fx_gone", name: "fx_gone", reason: "unknown-equipment" }],
    });
  });
});

/** A Ship with two weapon Slots and room for 10 missiles; both launchers fire Darts, only one fires Torpedoes. */
const darts = missile("fx_dart", 100, 0, 1);
const torpedo = missile("fx_torpedo", 1000, 0, 5);
const dartLauncher = launcher("weapon", "fx_dart_launcher", "fl_darts");
const tube = launcher("weapon", "fx_tube", "fl_tube");
const fitLists = [
  { id: "fl_darts", equipment: ["fx_dart"] },
  { id: "fl_tube", equipment: ["fx_dart", "fx_torpedo"] },
];
const gunboat = ship({
  slots: [weaponSlot("con_weapon_01"), weaponSlot("con_weapon_02")],
  capacities: { missiles: 10, drones: 0, deployables: 0, countermeasures: 0, crew: 0, cargo: 0 },
});
const missileRules = loadoutRules(gameData([gunboat], [darts, torpedo, dartLauncher, tube], fitLists), gunboat);

describe("missiles need a launcher", () => {
  const armed = loadout("fx_ship", {
    slots: { con_weapon_01: "fx_dart_launcher", con_weapon_02: "fx_tube" },
    consumables: { fx_dart: 4, fx_torpedo: 3 },
  });
  const tubeDropped = {
    type: "dropped",
    place: { kind: "consumable", equipment: "fx_torpedo" },
    equipment: "fx_torpedo",
    name: "fx_torpedo",
    reason: "doesnt-fit",
  };

  test("emptying a launcher's Slot drops the missiles no fitted launcher carries, and keeps the rest", () => {
    expect(missileRules.setSlot(armed, "con_weapon_02", null)).toEqual({
      loadout: loadout("fx_ship", { slots: { con_weapon_01: "fx_dart_launcher" }, consumables: { fx_dart: 4 } }),
      repairs: [tubeDropped],
    });
  });

  test("swapping a launcher for one that doesn't fire its missiles drops them too", () => {
    expect(missileRules.setSlot(armed, "con_weapon_02", "fx_dart_launcher").repairs).toEqual([tubeDropped]);
  });

  test("refitting a launcher starts its missiles from none", () => {
    const emptied = missileRules.setSlot(armed, "con_weapon_02", null).loadout;
    expect(missileRules.setSlot(emptied, "con_weapon_02", "fx_tube").loadout.consumables).toEqual({ fx_dart: 4 });
  });

  test("a missile is kept while another fitted launcher still carries it", () => {
    expect(missileRules.setSlot(armed, "con_weapon_01", null)).toEqual({
      loadout: loadout("fx_ship", { slots: { con_weapon_02: "fx_tube" }, consumables: { fx_dart: 4, fx_torpedo: 3 } }),
      repairs: [],
    });
  });
});

describe("a launcher's own missile storage (#158)", () => {
  // Fires Darts and holds 6 of its own, like the Light Rocket Launcher's `storage@capacity`.
  const pod = launcher("weapon", "fx_pod", "fl_darts", 6);
  const rules = loadoutRules(gameData([gunboat], [darts, torpedo, dartLauncher, tube, pod], fitLists), gunboat);
  const missiles = (l: ReturnType<typeof loadout>) => rules.consumables(l).find((o) => o.kind === "missile")?.capacity;
  const clamped = (id: string, from: number, to: number) => ({
    type: "clamped",
    place: { kind: "consumable", equipment: id },
    equipment: id,
    name: id,
    from,
    to,
  });

  test("adds to the Ship's missile capacity, once per launcher fitted", () => {
    const one = loadout("fx_ship", { slots: { con_weapon_01: "fx_pod" } });
    expect(missiles(one)).toBe(16);
    expect(rules.limit(one, { kind: "consumable", equipment: "fx_dart" })).toBe(16);
    expect(rules.setConsumable(one, "fx_dart", 20).loadout.consumables).toEqual({ fx_dart: 16 });
    expect(missiles(loadout("fx_ship", { slots: { con_weapon_01: "fx_pod", con_weapon_02: "fx_pod" } }))).toBe(22);
    expect(missiles(loadout("fx_ship", { slots: { con_weapon_01: "fx_pod", con_weapon_02: "fx_tube" } }))).toBe(16);
  });

  test("emptying its Slot cuts the missiles to what's left, the last stored first", () => {
    const armed = loadout("fx_ship", {
      slots: { con_weapon_01: "fx_pod", con_weapon_02: "fx_tube" },
      consumables: { fx_dart: 8, fx_torpedo: 6 },
    });
    const edit = rules.setSlot(armed, "con_weapon_01", null);
    expect(edit).toEqual({
      loadout: loadout("fx_ship", { slots: { con_weapon_02: "fx_tube" }, consumables: { fx_dart: 8, fx_torpedo: 2 } }),
      repairs: [clamped("fx_torpedo", 6, 2)],
    });
    expect(describeRepair(edit.repairs[0]!)).toBe("fx_torpedo in consumables: count cut from 6 to 2");
  });

  test("a missile cut to none is dropped", () => {
    const armed = loadout("fx_ship", {
      slots: { con_weapon_01: "fx_pod", con_weapon_02: "fx_tube" },
      consumables: { fx_dart: 12, fx_torpedo: 2 },
    });
    expect(rules.setSlot(armed, "con_weapon_01", "fx_dart_launcher")).toEqual({
      loadout: loadout("fx_ship", {
        slots: { con_weapon_01: "fx_dart_launcher", con_weapon_02: "fx_tube" },
        consumables: { fx_dart: 10 },
      }),
      repairs: [
        clamped("fx_dart", 12, 10),
        {
          type: "dropped",
          place: { kind: "consumable", equipment: "fx_torpedo" },
          equipment: "fx_torpedo",
          name: "fx_torpedo",
          reason: "doesnt-fit",
        },
      ],
    });
  });
});

describe("Slot Groups", () => {
  const flak = launcher("turret", "fx_flak", "fl_none");
  const heavy = launcher("turret", "fx_heavy", "fl_none");
  const missileTurret = launcher("turret", "fx_missile_turret", "fl_darts");
  const hauler = ship({
    slotGroups: [{ ...turretGroup("group_front", 4), kinds: { turret: { count: 4, fitList: "fl_turrets" } } }],
    capacities: { missiles: 10, drones: 0, deployables: 0, countermeasures: 0, crew: 0, cargo: 0 },
  });
  const rules = loadoutRules(
    gameData([hauler], [flak, heavy, missileTurret, darts], [
      { id: "fl_darts", equipment: ["fx_dart"] },
      { id: "fl_none", equipment: [] },
      { id: "fl_turrets", equipment: ["fx_flak", "fx_heavy", "fx_missile_turret"] },
    ]),
    hauler,
  );
  const front = (equipment: string, count: number) =>
    loadout("fx_ship", { groups: { group_front: { turret: { equipment, count } } } });
  const place = { kind: "group", group: "group_front", groupKind: "turret" } as const;

  test("picking Equipment for an empty kind fills all of the group's Slots", () => {
    expect(rules.setGroupEquipment(loadout("fx_ship"), "group_front", "turret", "fx_flak")).toEqual({
      loadout: front("fx_flak", 4),
      repairs: [],
    });
  });

  test("swapping the Equipment keeps the count, and null empties the kind", () => {
    expect(rules.setGroupEquipment(front("fx_flak", 2), "group_front", "turret", "fx_heavy").loadout).toEqual(front("fx_heavy", 2));
    expect(rules.setGroupEquipment(front("fx_flak", 2), "group_front", "turret", null).loadout).toEqual(loadout("fx_ship"));
  });

  test("the count narrows the group, is clamped to its size, and 0 empties it", () => {
    expect(rules.setGroupCount(front("fx_flak", 4), "group_front", "turret", 2)).toEqual({ loadout: front("fx_flak", 2), repairs: [] });
    expect(rules.setGroupCount(front("fx_flak", 2), "group_front", "turret", 9)).toEqual({
      loadout: front("fx_flak", 4),
      repairs: [{ type: "clamped", place, equipment: "fx_flak", name: "fx_flak", from: 9, to: 4 }],
    });
    expect(rules.setGroupCount(front("fx_flak", 2), "group_front", "turret", 0).loadout).toEqual(loadout("fx_ship"));
  });

  test("a count for a kind with nothing fitted changes nothing", () => {
    expect(rules.setGroupCount(loadout("fx_ship"), "group_front", "turret", 2)).toEqual({ loadout: loadout("fx_ship"), repairs: [] });
  });

  test("refuses a Slot Group or kind the Ship doesn't have, and Equipment not on the fit list", () => {
    const start = front("fx_flak", 2);
    expect(rules.setGroupEquipment(start, "group_back", "turret", "fx_flak")).toEqual({
      loadout: start,
      repairs: [
        { type: "dropped", place: { ...place, group: "group_back" }, equipment: "fx_flak", name: "fx_flak", reason: "unknown-slot-group" },
      ],
    });
    expect(rules.setGroupEquipment(start, "group_front", "shield", "fx_flak").repairs[0]).toMatchObject({ reason: "unknown-slot-group" });
    expect(rules.setGroupEquipment(start, "group_front", "turret", "fx_dart")).toEqual({
      loadout: start,
      repairs: [{ type: "dropped", place, equipment: "fx_dart", name: "fx_dart", reason: "doesnt-fit" }],
    });
  });

  test("each kind of a group is its own place: emptying one keeps the other", () => {
    const mixed = ship({ slotGroups: [{ id: "group_front", kinds: { turret: { count: 4, fitList: "fl_any" }, shield: { count: 2, fitList: "fl_any" } } }] });
    const mixedRules = loadoutRules(gameData([mixed], [flak, bubble]), mixed);
    const both = mixedRules.setGroupEquipment(front("fx_flak", 4), "group_front", "shield", "fx_bubble").loadout;
    expect(both.groups).toEqual({ group_front: { turret: { equipment: "fx_flak", count: 4 }, shield: { equipment: "fx_bubble", count: 2 } } });
    expect(mixedRules.setGroupCount(both, "group_front", "turret", 0).loadout).toEqual(
      loadout("fx_ship", { groups: { group_front: { shield: { equipment: "fx_bubble", count: 2 } } } }),
    );
  });

  test("a count for a Slot Group the Ship doesn't have is refused", () => {
    const stale = loadout("fx_ship", { groups: { group_back: { turret: { equipment: "fx_flak", count: 2 } } } });
    expect(rules.setGroupCount(stale, "group_back", "turret", 1)).toEqual({
      loadout: stale,
      repairs: [
        { type: "dropped", place: { ...place, group: "group_back" }, equipment: "fx_flak", name: "fx_flak", reason: "unknown-slot-group" },
      ],
    });
  });

  test("emptying the last missile launcher in a group drops its missiles", () => {
    const armed = { ...front("fx_missile_turret", 2), consumables: { fx_dart: 5 } };
    expect(rules.setGroupCount(armed, "group_front", "turret", 0)).toEqual({
      loadout: loadout("fx_ship"),
      repairs: [{ type: "dropped", place: { kind: "consumable", equipment: "fx_dart" }, equipment: "fx_dart", name: "fx_dart", reason: "doesnt-fit" }],
    });
    expect(rules.setGroupEquipment(armed, "group_front", "turret", "fx_flak").loadout).toEqual(front("fx_flak", 2));
  });
});

describe("the engine, thruster and software", () => {
  const fusion = engine("fx_fusion", 100, { thrust: 1, acceleration: 1, duration: 1, recharge: 1 }, { thrust: 1, charge: 1, attack: 1 });
  const nimble = thruster("fx_nimble", { strafe: 1, pitch: 1, yaw: 1, roll: 1 });
  const assist = priced("software", "fx_assist", { min: 1, average: 1, max: 1 });
  const scanner = priced("software", "fx_scanner", { min: 1, average: 1, max: 1 });
  const fighter = ship({
    slots: [{ ...engineSlot("con_engine_01"), fitList: "fl_engines" }],
    thrusters: "fl_thrusters",
    software: { fitList: "fl_software", mandatory: [] },
  });
  const rules = loadoutRules(
    gameData([fighter], [fusion, nimble, assist, scanner], [
      { id: "fl_engines", equipment: ["fx_fusion"] },
      { id: "fl_thrusters", equipment: ["fx_nimble"] },
      { id: "fl_software", equipment: ["fx_assist"] },
    ]),
    fighter,
  );
  const empty = loadout("fx_ship");
  const refused = (place: object, equipment: string) => ({
    loadout: empty,
    repairs: [{ type: "dropped", place, equipment, name: equipment, reason: "doesnt-fit" }],
  });

  test("each fits from its own fit list, and null or unticking removes it", () => {
    expect(rules.setEngine(empty, "fx_fusion")).toEqual({ loadout: loadout("fx_ship", { engine: "fx_fusion" }), repairs: [] });
    expect(rules.setEngine(loadout("fx_ship", { engine: "fx_fusion" }), null).loadout).toEqual(empty);
    expect(rules.setThruster(empty, "fx_nimble")).toEqual({ loadout: loadout("fx_ship", { thruster: "fx_nimble" }), repairs: [] });
    expect(rules.setThruster(loadout("fx_ship", { thruster: "fx_nimble" }), null).loadout).toEqual(empty);
    expect(rules.setSoftware(empty, "fx_assist", true)).toEqual({ loadout: loadout("fx_ship", { software: ["fx_assist"] }), repairs: [] });
    expect(rules.setSoftware(loadout("fx_ship", { software: ["fx_assist"] }), "fx_assist", false).loadout).toEqual(empty);
  });

  test("each refuses Equipment that isn't in the Game Data", () => {
    const unknown = (place: object) => ({
      loadout: empty,
      repairs: [{ type: "dropped", place, equipment: "fx_gone", name: "fx_gone", reason: "unknown-equipment" }],
    });
    expect(rules.setEngine(empty, "fx_gone")).toEqual(unknown({ kind: "engine" }));
    expect(rules.setThruster(empty, "fx_gone")).toEqual(unknown({ kind: "thruster" }));
    expect(rules.setSoftware(empty, "fx_gone", true)).toEqual(unknown({ kind: "software", equipment: "fx_gone" }));
  });

  test("each refuses Equipment that isn't on its fit list", () => {
    expect(rules.setEngine(empty, "fx_nimble")).toEqual(refused({ kind: "engine" }, "fx_nimble"));
    expect(rules.setThruster(empty, "fx_fusion")).toEqual(refused({ kind: "thruster" }, "fx_fusion"));
    expect(rules.setSoftware(empty, "fx_scanner", true)).toEqual(refused({ kind: "software", equipment: "fx_scanner" }, "fx_scanner"));
  });

  test("a Ship with no engines takes no engine (its engine Slots aren't Slots here)", () => {
    const glider = ship({ slots: [] });
    expect(loadoutRules(gameData([glider], [fusion]), glider).setEngine(empty, "fx_fusion")).toEqual(
      refused({ kind: "engine" }, "fx_fusion"),
    );
    expect(rules.setSlot(empty, "con_engine_01", "fx_fusion").repairs[0]).toMatchObject({ reason: "unknown-slot" });
  });
});

describe("consumables", () => {
  const flare = priced("countermeasure", "fx_flare", { min: 1, average: 1, max: 1 });
  const chaff = priced("countermeasure", "fx_chaff", { min: 1, average: 1, max: 1 });
  const decoy = priced("countermeasure", "fx_decoy", { min: 1, average: 1, max: 1 });
  const carrier = ship({
    slots: [weaponSlot("con_weapon_01")],
    capacities: { missiles: 10, drones: 0, deployables: 0, countermeasures: 5, crew: 0, cargo: 0 },
    countermeasures: "fl_countermeasures",
  });
  const rules = loadoutRules(
    gameData([carrier], [flare, chaff, decoy, darts, torpedo, dartLauncher], [
      ...fitLists,
      { id: "fl_countermeasures", equipment: ["fx_flare", "fx_chaff"] },
    ]),
    carrier,
  );
  const withFlares = loadout("fx_ship", { consumables: { fx_flare: 3 } });
  const place = (equipment: string) => ({ kind: "consumable", equipment }) as const;

  test("items of one kind share the Ship's capacity for it: a count over what the others leave is clamped", () => {
    expect(rules.setConsumable(withFlares, "fx_chaff", 2)).toEqual({
      loadout: loadout("fx_ship", { consumables: { fx_flare: 3, fx_chaff: 2 } }),
      repairs: [],
    });
    expect(rules.setConsumable(withFlares, "fx_chaff", 4)).toEqual({
      loadout: loadout("fx_ship", { consumables: { fx_flare: 3, fx_chaff: 2 } }),
      repairs: [{ type: "clamped", place: place("fx_chaff"), equipment: "fx_chaff", name: "fx_chaff", from: 4, to: 2 }],
    });
    // An item's own count doesn't count against it.
    expect(rules.setConsumable(withFlares, "fx_flare", 5).loadout).toEqual(loadout("fx_ship", { consumables: { fx_flare: 5 } }));
  });

  test("a count of 0 removes the item", () => {
    expect(rules.setConsumable(withFlares, "fx_flare", 0)).toEqual({ loadout: loadout("fx_ship"), repairs: [] });
  });

  test("the limit is the kind's capacity less what the other items take", () => {
    expect(rules.limit(withFlares, place("fx_chaff"))).toBe(2);
    expect(rules.limit(withFlares, place("fx_flare"))).toBe(5);
    expect(rules.limit(withFlares, place("fx_decoy"))).toBe(0);
  });

  test("refuses an item the Ship can't carry, one with no room left, and unknown Equipment", () => {
    const full = loadout("fx_ship", { consumables: { fx_flare: 5 } });
    const refused = (equipment: string, reason: string) => ({
      loadout: full,
      repairs: [{ type: "dropped", place: place(equipment), equipment, name: equipment, reason }],
    });
    expect(rules.setConsumable(full, "fx_decoy", 1)).toEqual(refused("fx_decoy", "doesnt-fit"));
    expect(rules.setConsumable(full, "fx_chaff", 1)).toEqual(refused("fx_chaff", "doesnt-fit"));
    expect(rules.setConsumable(full, "fx_gone", 1)).toEqual(refused("fx_gone", "unknown-equipment"));
  });

  test("missiles need a fitted launcher, and share the missile capacity, not the countermeasures'", () => {
    expect(rules.setConsumable(withFlares, "fx_dart", 1).repairs[0]).toMatchObject({ reason: "doesnt-fit" });
    const armed = rules.setSlot(withFlares, "con_weapon_01", "fx_dart_launcher").loadout;
    expect(rules.setConsumable(armed, "fx_dart", 12)).toEqual({
      loadout: loadout("fx_ship", { slots: { con_weapon_01: "fx_dart_launcher" }, consumables: { fx_flare: 3, fx_dart: 10 } }),
      repairs: [{ type: "clamped", place: place("fx_dart"), equipment: "fx_dart", name: "fx_dart", from: 12, to: 10 }],
    });
  });

  test("the query lists what each kind can take, sorted by name, leaving out kinds with no capacity", () => {
    expect(rules.consumables(withFlares)).toEqual([{ kind: "countermeasure", capacity: 5, items: [chaff, flare] }]);
  });
});

describe("Crew", () => {
  // The Ironback Hauler holds 20.
  const hauler = ship({ capacities: { missiles: 0, drones: 0, deployables: 0, countermeasures: 0, crew: 20, cargo: 0 } });
  const rules = loadoutRules(gameData([hauler]), hauler);
  const crewed = loadout("fx_ship", { crew: { service: 12 } });

  test("service crew and marines share the crew capacity: a count over what the other leaves is clamped", () => {
    expect(rules.setCrew(crewed, "marines", 8)).toEqual({ loadout: loadout("fx_ship", { crew: { service: 12, marines: 8 } }), repairs: [] });
    expect(rules.setCrew(crewed, "marines", 15)).toEqual({
      loadout: loadout("fx_ship", { crew: { service: 12, marines: 8 } }),
      repairs: [{ type: "clamped", place: { kind: "crew", role: "marines" }, name: "Marines", from: 15, to: 8 }],
    });
  });

  test("the limit is the capacity less the other role's count", () => {
    expect(rules.limit(crewed, { kind: "crew", role: "marines" })).toBe(8);
    expect(rules.limit(crewed, { kind: "crew", role: "service" })).toBe(20);
  });

  test("a count that isn't a whole number is taken as the whole number below it, and NaN as 0", () => {
    expect(rules.setCrew(crewed, "marines", 2.7).loadout).toEqual(loadout("fx_ship", { crew: { service: 12, marines: 2 } }));
    expect(rules.setCrew(crewed, "marines", Number.NaN)).toEqual({ loadout: crewed, repairs: [] });
  });

  test("a count of 0 removes the role, and with both at 0 the Loadout has no Crew", () => {
    expect(rules.setCrew(crewed, "service", 0)).toEqual({ loadout: loadout("fx_ship"), repairs: [] });
  });

  test("on a full Ship, a role is clamped to 0 and the clamp reads as the notice did", () => {
    const full = loadout("fx_ship", { crew: { marines: 20 } });
    const { loadout: edited, repairs } = rules.setCrew(full, "service", 4);
    expect(edited).toEqual(full);
    expect(repairs.map(describeRepair)).toEqual(["Service crew in crew: count cut from 4 to 0"]);
  });
});

describe("what each place can take", () => {
  const fusion = engine("fx_fusion", 100, { thrust: 1, acceleration: 1, duration: 1, recharge: 1 }, { thrust: 1, charge: 1, attack: 1 });
  const nimble = thruster("fx_nimble", { strafe: 1, pitch: 1, yaw: 1, roll: 1 });
  const aa9 = ship({
    slots: [{ ...shieldSlot("con_shield_01"), fitList: "fl_small" }, engineSlot("con_engine_01")],
    slotGroups: [
      { id: "enginegroup", kinds: { shield: { count: 2, fitList: "fl_small" }, engine: { count: 2, fitList: "fl_any" } } },
    ],
    thrusters: "fl_thrusters",
  });
  const rules = loadoutRules(
    gameData([aa9], [bubble, wall, fusion, nimble], [
      { id: "fl_small", equipment: ["fx_bubble"] },
      { id: "fl_thrusters", equipment: ["fx_nimble"] },
    ]),
    aa9,
  );
  const empty = loadout("fx_ship");

  test("each place's options come from its fit list", () => {
    expect(rules.options(empty, { kind: "slot", slot: "con_shield_01" })).toEqual([bubble]);
    expect(rules.options(empty, { kind: "group", group: "enginegroup", groupKind: "shield" })).toEqual([bubble]);
    expect(rules.options(empty, { kind: "thruster" })).toEqual([nimble]);
    expect(rules.options(empty, { kind: "engine" })).toEqual([bubble, wall, fusion, nimble]);
  });

  test("a software place takes only its own software, and only from the Ship's fit list", () => {
    const scanner = priced("software", "fx_scanner", { min: 0, average: 0, max: 0 });
    const courier = ship({ software: { fitList: "fl_software", mandatory: [] } });
    const softwareRules = loadoutRules(
      gameData([courier], [scanner, bubble], [{ id: "fl_software", equipment: ["fx_scanner"] }]),
      courier,
    );
    expect(softwareRules.options(empty, { kind: "software", equipment: "fx_scanner" })).toEqual([scanner]);
    expect(softwareRules.options(empty, { kind: "software", equipment: "fx_bubble" })).toEqual([]);
  });

  test("a place the Ship doesn't have takes nothing", () => {
    expect(rules.options(empty, { kind: "slot", slot: "con_engine_01" })).toEqual([]);
    expect(rules.options(empty, { kind: "group", group: "enginegroup", groupKind: "turret" })).toEqual([]);
    expect(rules.limit(empty, { kind: "group", group: "nowhere", groupKind: "shield" })).toBe(0);
  });

  test("a Slot Group's limit is its size, and the engine's is all of the Ship's engines (1 + 2)", () => {
    expect(rules.limit(empty, { kind: "group", group: "enginegroup", groupKind: "shield" })).toBe(2);
    expect(rules.limit(empty, { kind: "engine" })).toBe(3);
    expect(rules.limit(empty, { kind: "slot", slot: "con_shield_01" })).toBe(1);
    expect(rules.limit(empty, { kind: "thruster" })).toBe(1);
  });
});

describe("setSoftware: one of each Software Family", () => {
  const lrsMk1 = software("fx_lrs_mk1");
  const lrsMk2 = software("fx_lrs_mk2", "fx_lrs_mk1");
  const lrsMk3 = software("fx_lrs_mk3", "fx_lrs_mk2");
  const trading = software("fx_trading");
  const scout = ship({ software: { fitList: "fl_software", mandatory: [] } });
  const rules = loadoutRules(
    gameData([scout], [lrsMk1, lrsMk2, lrsMk3, trading], [
      { id: "fl_software", equipment: ["fx_lrs_mk1", "fx_lrs_mk2", "fx_lrs_mk3", "fx_trading"] },
    ]),
    scout,
  );
  const replaced = (id: string) => ({
    type: "dropped",
    place: { kind: "software", equipment: id },
    equipment: id,
    name: id,
    reason: "replaced-in-family",
  });

  test("fitting a ware swaps out the one of its family already fitted, and reports the swap", () => {
    const edit = rules.setSoftware(loadout("fx_ship", { software: ["fx_lrs_mk1", "fx_trading"] }), "fx_lrs_mk2", true);

    expect(edit).toEqual({
      loadout: loadout("fx_ship", { software: ["fx_trading", "fx_lrs_mk2"] }),
      repairs: [replaced("fx_lrs_mk1")],
    });
    expect(describeRepair(edit.repairs[0]!)).toBe("fx_lrs_mk1 in software: dropped, a Ship fits one of each Software Family");
  });

  test("a family is the whole chain of predecessors, so going back down swaps too", () => {
    expect(rules.setSoftware(loadout("fx_ship", { software: ["fx_lrs_mk3"] }), "fx_lrs_mk1", true)).toEqual({
      loadout: loadout("fx_ship", { software: ["fx_lrs_mk1"] }),
      repairs: [replaced("fx_lrs_mk3")],
    });
  });

  test("software with no predecessor is a family of its own, so it sits beside the others", () => {
    expect(rules.setSoftware(loadout("fx_ship", { software: ["fx_lrs_mk2"] }), "fx_trading", true)).toEqual({
      loadout: loadout("fx_ship", { software: ["fx_lrs_mk2", "fx_trading"] }),
      repairs: [],
    });
  });

  test("ticking the ware already fitted, or unticking one, swaps nothing", () => {
    const fitted = loadout("fx_ship", { software: ["fx_lrs_mk2"] });
    expect(rules.setSoftware(fitted, "fx_lrs_mk2", true)).toEqual({ loadout: fitted, repairs: [] });
    expect(rules.setSoftware(fitted, "fx_lrs_mk1", false)).toEqual({ loadout: fitted, repairs: [] });
  });
});
