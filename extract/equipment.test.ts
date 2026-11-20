import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FixtureWorld, smallEngine, writeCache, type EquipmentSpec } from "./testing/fixtureWorld.ts";
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
