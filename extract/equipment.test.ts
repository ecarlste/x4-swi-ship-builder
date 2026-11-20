import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_DEFAULTS, FixtureWorld, smallEngine, writeCache, type EquipmentSpec } from "./testing/fixtureWorld.ts";
import { transform } from "./transform.ts";

/** Stage 2 on a fixture cache, with readers for what it wrote. */
function run(world: FixtureWorld) {
  const cacheDir = writeCache(world);
  const gameDataDir = mkdtempSync(join(tmpdir(), "game-data-"));
  const result = transform({ cacheDir, gameDataDir, pipelineCommit: "abc1234", now: new Date("2026-03-04T05:06:07Z") });
  const readJson = (file: string) => JSON.parse(readFileSync(join(gameDataDir, "current", file), "utf8"));
  const ship = (id: string) => readJson("ships.json").find((s: { id: string }) => s.id === id);
  const item = (id: string) => readJson("equipment.json").find((e: { id: string }) => e.id === id);
  const fitLists = new Map<string, string[]>(
    readJson("fit-lists.json").map((f: { id: string; equipment: string[] }) => [f.id, f.equipment]),
  );
  /** The Equipment in a fit list. */
  const fits = (fitListId: string) => fitLists.get(fitListId);
  const slotFits = (shipId: string, slotId: string) =>
    fits(ship(shipId).slots.find((s: { id: string }) => s.id === slotId).fitList);
  const report = () => readFileSync(join(cacheDir, "extract-report.md"), "utf8");
  return { result, readJson, ship, item, fits, slotFits, report };
}

/** A Faction with a wharf (S/M), and an S fighter with two weapon Slots and an engine. */
function wharfWorld(): FixtureWorld {
  return new FixtureWorld()
    .faction({ id: "fx_guild", name: "Freight Guild" })
    .station({ faction: "fx_guild", builds: ["ship_s ship_m"] })
    .ship({
      id: "fx_fighter",
      owners: ["fx_guild"],
      slots: [
        { name: "con_weapon_01", tags: "weapon small kx7 platformcollision" },
        { name: "con_weapon_02", tags: "weapon small" },
        { name: "con_engine_01", tags: "engine small" },
      ],
    })
    .equipment(smallEngine());
}

const gun = (spec: Partial<EquipmentSpec> & { id: string }): EquipmentSpec => ({
  kind: "weapon",
  connection: "component weapon small",
  properties: `<bullet class="${spec.id}_bullet_macro"/>`,
  bullet: `<damage value="10"/><reload rate="2"/>`,
  ...spec,
});

describe("transform: Equipment", () => {
  it("writes a weapon with its raw inputs from the weapon and bullet macros", () => {
    const { item } = run(
      wharfWorld().equipment(
        gun({
          id: "fx_kx7",
          name: "KX7 Laser",
          owners: ["fx_guild"],
          licence: "militaryequipment",
          price: { min: 900, average: 1000, max: 1100 },
          connection: "component weapon small kx7",
          properties:
            `<bullet class="fx_kx7_bullet_macro"/><heat overheat="11000" cooldelay="0.63" coolrate="3000" reenable="9500"/>` +
            `<reload rate="99"/>`,
          bullet:
            `<bullet amount="1" barrelamount="2" speed="4000"/><damage value="100" noshield="20" shield="5"/>` +
            `<reload rate="4"/><ammunition value="12" reload="3"/><heat value="300"/>`,
        }),
      ),
    );

    expect(item("fx_kx7")).toEqual({
      kind: "weapon",
      id: "fx_kx7",
      name: "KX7 Laser",
      nameId: expect.stringMatching(/^\{900,\d+\}$/),
      price: { min: 900, average: 1000, max: 1100 },
      licence: "militaryequipment",
      sellers: ["fx_guild"],
      size: "s",
      damage: { value: 100, noShield: 20 },
      barrelAmount: 2,
      fireRate: 4,
      magazine: { size: 12, reloadTime: 3 },
      heat: { perShot: 300, overheat: 11000, coolDelay: 0.63, coolRate: 3000 },
      missiles: null,
      missileStorage: 0,
    });
  });

  it("reads a bullet's reload time as a fire rate, and a gun without heat or magazine as such", () => {
    const { item } = run(
      wharfWorld().equipment(gun({ id: "fx_slow", bullet: `<damage value="50"/><reload time="0.5"/>` })),
    );

    expect(item("fx_slow")).toMatchObject({
      damage: { value: 50, noShield: 0 },
      barrelAmount: 1,
      fireRate: 2,
      magazine: null,
      heat: null,
    });
  });

  it("lists in each Slot the Equipment whose type connection tags, but for `component`, the Slot has", () => {
    const { slotFits } = run(
      wharfWorld()
        .equipment(gun({ id: "fx_kx7", connection: "component weapon small kx7" }))
        .equipment(gun({ id: "fx_plain" }))
        .equipment(gun({ id: "fx_medium", connection: "component weapon medium" }))
        .equipment(gun({ id: "fx_turret", kind: "turret", connection: "component turret small" })),
    );

    expect(slotFits("fx_fighter", "con_weapon_01")).toEqual(["fx_kx7", "fx_plain"]);
    expect(slotFits("fx_fighter", "con_weapon_02")).toEqual(["fx_plain"]);
    expect(slotFits("fx_fighter", "con_engine_01")).toEqual(["fx_engine_s"]);
  });
});

describe("transform: the Equipment Seller rule", () => {
  /**
   * fx_guild runs a wharf (S/M); fx_navy a shipyard (L); fx_dockers an
   * equipment dock that builds nothing but equips S to L; fx_rebels a station
   * with no equip module. One S Ship and one L Ship, each with a weapon Slot
   * of its size.
   */
  const world = () =>
    new FixtureWorld()
      .faction({ id: "fx_guild", name: "Freight Guild" })
      .faction({ id: "fx_navy", name: "Fixture Navy" })
      .faction({ id: "fx_rebels", name: "Rebel Cells" })
      .faction({ id: "fx_dockers", name: "Dock Union" })
      .station({ faction: "fx_guild", builds: ["ship_s ship_m"] })
      .station({ faction: "fx_navy", builds: ["ship_l"] })
      .station({ faction: "fx_dockers", builds: [], equips: ["ship_s ship_m ship_l"], tags: "equipmentdock" })
      .station({ faction: "fx_rebels", builds: [] })
      .ship({ id: "fx_fighter", owners: ["fx_guild"], slots: [{ name: "con_weapon_01", tags: "weapon small" }] })
      .ship({ id: "fx_frigate", size: "l", owners: ["fx_navy"], slots: [{ name: "con_weapon_01", tags: "weapon large" }] })
      .equipment(gun({ id: "fx_owned", owners: ["fx_guild", "fx_rebels"] }))
      .equipment(gun({ id: "fx_ownerless" }))
      .equipment(gun({ id: "fx_large", connection: "component weapon large", owners: ["fx_guild", "fx_navy"] }))
      .equipment(gun({ id: "fx_large_guild", connection: "component weapon large", owners: ["fx_guild"] }))
      .equipment(gun({ id: "fx_rebel_gun", owners: ["fx_rebels"] }))
      .equipment(gun({ id: "fx_xenon_gun", owners: ["fx_xenon"] }))
      .equipment(gun({ id: "fx_station_turret", kind: "turret", connection: "component turret large", owners: ["fx_navy"] }));

  it("sells an item where an owner runs a station that equips a class of Ship it fits", () => {
    const { item } = run(world());

    expect(item("fx_owned").sellers).toEqual(["fx_guild"]);
    expect(item("fx_large").sellers).toEqual(["fx_navy"]);
  });

  it("sells an item without an owner wherever a station equips a class of Ship it fits, equipment docks included", () => {
    const { item } = run(world());

    expect(item("fx_ownerless").sellers).toEqual(["fx_dockers", "fx_guild"]);
  });

  it("leaves out Equipment without a Seller or that fits no buildable Ship, with the reason in the report", () => {
    const { readJson, report } = run(world());

    expect(readJson("equipment.json").map((e: { id: string }) => e.id)).toEqual([
      "fx_large",
      "fx_owned",
      "fx_ownerless",
    ]);
    expect(report()).toContain("## Equipment left out");
    expect(report()).toContain("| fx_rebel_gun | no Seller: owned by fx_rebels, and none runs a station that equips ships |");
    expect(report()).toContain("| fx_xenon_gun | no Seller: owned by fx_xenon, and none runs a station that equips ships |");
    expect(report()).toContain("| fx_large_guild | no Seller: fx_guild equip none of the classes it fits (ship_l) |");
    expect(report()).toContain("| fx_station_turret | fits no buildable Ship |");
  });

  it("warns about Equipment that has a Seller but no compatible Slot", () => {
    const { report } = run(world());

    expect(report()).toContain("- fx_station_turret has a Seller but no compatible Slot on any buildable Ship");
    expect(report()).not.toContain("- fx_xenon_gun has a Seller");
  });

  it("counts the Equipment wares with a Seller before the fits-a-buildable-Ship filter", () => {
    const { result } = run(world());

    expect(result.equipment).toEqual({ included: 3, withSeller: 5 });
  });

  it("lists the Factions that sell only Equipment, and the Licences Equipment needs", () => {
    const { readJson } = run(
      world().equipment(gun({ id: "fx_military", owners: ["fx_dockers"], licence: "militaryequipment" })),
    );

    expect(readJson("factions.json").map((f: { id: string }) => f.id)).toEqual(["fx_dockers", "fx_guild", "fx_navy"]);
    expect(readJson("licences.json")).toContainEqual({ id: "militaryequipment", name: "Military Equipment Licence", reputation: null });
  });
});

describe("transform: fit lists", () => {
  const shield = (id: string, connection: string): EquipmentSpec => ({
    id,
    kind: "shield",
    connection,
    properties: `<recharge max="1000" rate="100" delay="2"/>`,
  });

  it("gives a Slot Group kind the Equipment that fits all of its connections of that kind, and warns when they differ", () => {
    const { ship, fits, report } = run(
      wharfWorld()
        .station({ faction: "fx_guild", builds: ["ship_l"] })
        .ship({
          id: "fx_frigate",
          size: "l",
          owners: ["fx_guild"],
          slots: [
            { name: "con_shield_01", tags: "shield medium standard", group: "group_front" },
            { name: "con_shield_02", tags: "shield medium standard", group: "group_front" },
            { name: "con_shield_03", tags: "shield medium", group: "group_back" },
            { name: "con_shield_04", tags: "shield medium standard", group: "group_back" },
          ],
        })
        .equipment(shield("fx_shield_plain", "component shield medium"))
        .equipment(shield("fx_shield_standard", "component shield medium standard")),
    );

    const groups = ship("fx_frigate").slotGroups;
    expect(fits(groups.find((g: { id: string }) => g.id === "group_front").kinds.shield.fitList)).toEqual([
      "fx_shield_plain",
      "fx_shield_standard",
    ]);
    expect(fits(groups.find((g: { id: string }) => g.id === "group_back").kinds.shield.fitList)).toEqual(["fx_shield_plain"]);
    expect(report()).toContain(`fx_frigate: the shield connections of Slot Group "group_back" don't all take the same Equipment`);
  });

  it("gives the thruster the thrusters whose connection tags, but for component and thruster, the macro's <thruster tags> has", () => {
    const thruster = (id: string, connection: string): EquipmentSpec => ({
      id,
      kind: "thruster",
      connection,
      properties: `<thrust strafe="400" pitch="160" yaw="161" roll="200"/>`,
    });
    const { ship, fits, item } = run(
      wharfWorld()
        .ship({ id: "fx_drifter", owners: ["fx_guild"], thruster: null })
        .equipment(thruster("fx_thruster_s", "thruster small component"))
        .equipment(thruster("fx_thruster_m", "thruster medium component")),
    );

    expect(fits(ship("fx_fighter").thrusters)).toEqual(["fx_thruster_s"]);
    expect(fits(ship("fx_drifter").thrusters)).toEqual([]);
    expect(item("fx_thruster_s")).toMatchObject({ size: "s", thrust: { strafe: 400, pitch: 160, yaw: 161, roll: 200 } });
  });

  it("gives the software in the ship macro's list, marking default=\"1\" software mandatory", () => {
    const { ship, fits, item, report } = run(
      wharfWorld()
        .ship({
          id: "fx_scout",
          owners: ["fx_guild"],
          software: [
            { ware: "fx_flightassist", default: true },
            { ware: "fx_scanner" },
            { ware: "fx_not_software" },
          ],
        })
        .equipment({ id: "fx_flightassist", kind: "software", name: "Flight Assist" })
        .equipment({ id: "fx_scanner", kind: "software" })
        .equipment({ id: "fx_unlisted", kind: "software" }),
    );

    expect(fits(ship("fx_scout").software.fitList)).toEqual(["fx_flightassist", "fx_scanner"]);
    expect(ship("fx_scout").software.mandatory).toEqual(["fx_flightassist"]);
    expect(fits(ship("fx_fighter").software.fitList)).toEqual([]);
    expect(item("fx_flightassist")).toMatchObject({ kind: "software", name: "Flight Assist", sellers: ["fx_guild"] });
    expect(item("fx_unlisted")).toBeUndefined();
    expect(report()).toContain(`fx_scout: its software list has "fx_not_software", which isn't a software ware`);
  });

  it("gives every drone, deployable and countermeasure to Ships that can carry them", () => {
    const { ship, fits, item } = run(
      wharfWorld()
        .ship({ id: "fx_carrier", owners: ["fx_guild"], properties: { storage: { unit: 4, countermeasure: 0 } } })
        .equipment({ id: "fx_drone", kind: "drone" })
        .equipment({ id: "fx_satellite", kind: "deployable" })
        .equipment({ id: "fx_mine", kind: "deployable", tags: "equipment mine" })
        .equipment({ id: "fx_flare", kind: "countermeasure", price: { min: 1, average: 2, max: 3 } }),
    );

    expect(fits(ship("fx_carrier").drones)).toEqual(["fx_drone"]);
    expect(fits(ship("fx_fighter").drones)).toEqual([]);
    expect(fits(ship("fx_carrier").deployables)).toEqual(["fx_mine", "fx_satellite"]);
    expect(fits(ship("fx_carrier").countermeasures)).toEqual([]);
    expect(fits(ship("fx_fighter").countermeasures)).toEqual(["fx_flare"]);
    expect(item("fx_mine").kind).toBe("deployable");
    expect(item("fx_flare")).toMatchObject({ kind: "countermeasure", price: { min: 1, average: 2, max: 3 }, licence: null });
  });

  it("makes launchers weapons or turrets that list the missiles whose tags their <ammunition tags> has", () => {
    const missile = (id: string, tags: string, owners?: string[]): EquipmentSpec => ({
      id,
      kind: "missile",
      owners,
      properties: `<missile amount="1" tags="${tags}"/><explosiondamage value="7000" hull="500"/><reload time="10"/>`,
    });
    const { item, fits, report } = run(
      wharfWorld()
        .equipment(
          gun({
            id: "fx_launcher",
            macroClass: "missilelauncher",
            properties: `<ammunition tags="protl concl"/><bullet class="fx_proton_macro"/>`,
            bullet: undefined,
          }),
        )
        .equipment(missile("fx_proton", "protl"))
        .equipment(missile("fx_concussion", "concl"))
        .equipment(missile("fx_ion", "ionl"))
        .equipment(missile("fx_xenon_proton", "protl", ["fx_xenon"])),
    );

    expect(item("fx_launcher")).toMatchObject({
      kind: "weapon",
      damage: { value: 0, noShield: 0 },
      barrelAmount: 1,
      fireRate: 1,
      magazine: null,
      heat: null,
    });
    expect(fits(item("fx_launcher").missiles)).toEqual(["fx_concussion", "fx_proton"]);
    expect(item("fx_proton")).toMatchObject({ kind: "missile", explosionDamage: 7000, hullDamage: 500, reloadTime: 10, sellers: ["fx_guild"] });
    expect(item("fx_ion")).toBeUndefined();
    expect(report()).toContain("| fx_ion | no launcher on a buildable Ship fires it |");
    expect(report()).toContain("| fx_xenon_proton | no Seller: owned by fx_xenon, and none runs a station that equips ships |");
  });

  it("reads a launcher's own missile storage, and a missile's barrelamount (#39: Light Rocket Launcher)", () => {
    // "reocketl" is SWI's own (misspelt) ammunition tag for light rockets.
    const { item } = run(
      wharfWorld()
        .equipment(
          gun({
            id: "fx_rocket_launcher",
            macroClass: "missilelauncher",
            properties: `<ammunition tags="reocketl"/><bullet class="fx_rocket_macro"/><storage capacity="6"/>`,
            bullet: undefined,
          }),
        )
        .equipment(
          gun({
            id: "fx_krupx",
            macroClass: "missilelauncher",
            properties: `<ammunition tags="reocketl"/><bullet class="fx_rocket_macro"/>`,
            bullet: undefined,
          }),
        )
        .equipment({
          id: "fx_rocket",
          kind: "missile",
          properties:
            `<missile amount="1" barrelamount="3" tags="reocketl"/>` +
            `<explosiondamage value="1500" hull="1000"/><reload time="2"/>`,
        })
        .equipment({
          id: "fx_torpedo",
          kind: "missile",
          properties: `<missile amount="1" tags="reocketl"/><explosiondamage value="7000" hull="7000"/><reload time="10"/>`,
        })
        .equipment(gun({ id: "fx_laser" })),
    );

    expect(item("fx_rocket_launcher").missileStorage).toBe(6);
    expect(item("fx_krupx").missileStorage).toBe(0);
    expect(item("fx_laser").missileStorage).toBe(0);
    expect(item("fx_rocket").barrelAmount).toBe(3);
    expect(item("fx_torpedo").barrelAmount).toBe(1);
  });

  it("writes shields and engines with their raw inputs, and no size when their connection has no size tag", () => {
    const { item, slotFits } = run(
      wharfWorld()
        .ship({ id: "fx_xwing", owners: ["fx_guild"], slots: [{ name: "con_shield_01", tags: "shield astromech" }] })
        .equipment({ ...shield("fx_r2", "shield astromech"), properties: `<recharge max="827" rate="82.5"/>` })
        .equipment({
          id: "fx_engine_xwing",
          kind: "engine",
          connection: "engine small",
          properties:
            `<thrust forward="550" reverse="450"/><travel charge="4" thrust="21.6" attack="0"/>` +
            `<boost duration="11" thrust="2.5" recharge="80" acceleration="1.25"/>`,
        }),
    );

    expect(slotFits("fx_xwing", "con_shield_01")).toEqual(["fx_r2"]);
    expect(item("fx_r2")).toMatchObject({ kind: "shield", size: null, capacity: 827, rechargeRate: 82.5, rechargeDelay: 0 });
    expect(item("fx_engine_xwing")).toMatchObject({
      kind: "engine",
      size: "s",
      thrust: { forward: 550, reverse: 450 },
      boost: { thrust: 2.5, acceleration: 1.25, duration: 11, recharge: 80 },
      travel: { thrust: 21.6, charge: 4, attack: 0 },
    });
  });

  it("gives an engine without boost@acceleration 1, and without boost@recharge the engine class default (#39: Gozanti Engine)", () => {
    const { item } = run(
      wharfWorld().equipment({
        id: "fx_engine_gozanti",
        kind: "engine",
        connection: "engine small",
        properties:
          `<thrust forward="1350" reverse="1350"/><travel charge="7" thrust="20.6" attack="0"/>` +
          `<boost duration="20" thrust="2.7" attack="5" release="3"/>`,
      }),
    );

    expect(item("fx_engine_gozanti").boost).toEqual({
      thrust: 2.7,
      acceleration: 1,
      duration: 20,
      recharge: ENGINE_DEFAULTS.boostRecharge,
    });
  });

  it("shares one fit list between identical lists", () => {
    const { ship, readJson } = run(
      wharfWorld()
        .ship({ id: "fx_twin", owners: ["fx_guild"], slots: [{ name: "con_weapon_09", tags: "weapon small" }] })
        .equipment(gun({ id: "fx_plain" })),
    );

    expect(ship("fx_twin").slots[0].fitList).toBe(ship("fx_fighter").slots.find((s: { id: string }) => s.id === "con_weapon_02").fitList);
    const lists = readJson("fit-lists.json").map((f: { equipment: string[] }) => f.equipment.join(","));
    expect(new Set(lists).size).toBe(lists.length);
  });

  it("leaves out and warns about a gun whose bullet has no fire rate", () => {
    const { item, report } = run(wharfWorld().equipment(gun({ id: "fx_tractor", bullet: `<damage value="0"/>` })));

    expect(item("fx_tractor")).toBeUndefined();
    expect(report()).toContain("| fx_tractor | its bullet has no reload@rate or reload@time |");
    expect(report()).toContain("- fx_tractor: its bullet has no reload@rate or reload@time");
  });

  it("keeps an Equipment price outside min..max as written, and lists it as a warning", () => {
    const { item, report } = run(wharfWorld().equipment(gun({ id: "fx_odd", price: { min: 30, average: 20, max: 40 } })));

    expect(item("fx_odd").price).toEqual({ min: 30, average: 20, max: 40 });
    expect(report()).toContain("fx_odd: price isn't min <= average <= max (30, 20, 40)");
  });

  it("fails when no Equipment has a Seller and fits a buildable Ship", () => {
    const world = new FixtureWorld()
      .faction({ id: "fx_guild", name: "Freight Guild" })
      .station({ faction: "fx_guild", builds: ["ship_s"] })
      .ship({ id: "fx_fighter", owners: ["fx_guild"] })
      .equipment(gun({ id: "fx_xenon_gun", owners: ["fx_xenon"] }));

    expect(() => run(world)).toThrow(/No Equipment found/);
  });
});
