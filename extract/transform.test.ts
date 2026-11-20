import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSnapshot } from "../shared/game-data/validateSnapshot.ts";
import { FixtureWorld, oneShipWorld, smallEngine, writeCache } from "./testing/fixtureWorld.ts";
import { transform } from "./transform.ts";

const NOW = new Date("2026-03-04T05:06:07Z");

function run(world: FixtureWorld = oneShipWorld()) {
  const cacheDir = writeCache(world);
  const gameDataDir = mkdtempSync(join(tmpdir(), "game-data-"));
  const result = transform({ cacheDir, gameDataDir, pipelineCommit: "abc1234", now: NOW });
  const readJson = (file: string) => JSON.parse(readFileSync(join(gameDataDir, "current", file), "utf8"));
  const report = () => readFileSync(join(cacheDir, "extract-report.md"), "utf8");
  const ship = (id: string) => readJson("ships.json").find((s: { id: string }) => s.id === id);
  return { result, cacheDir, gameDataDir, readJson, report, ship };
}

describe("transform: the buildable-Ship rule", () => {
  const world = () =>
    new FixtureWorld()
      .faction({ id: "fx_guild", name: "Freight Guild" })
      .faction({ id: "fx_navy", name: "Fixture Navy" })
      .faction({ id: "fx_corsairs", name: "Corsair Clans" })
      .faction({ id: "fx_rebels", name: "Rebel Cells" })
      // A wharf building S/M, and a shipyard building L and XL from two build modules.
      .station({ faction: "fx_guild", builds: ["ship_s ship_m"], tags: "wharf" })
      .station({ faction: "fx_navy", builds: ["ship_l", "ship_xl"], tags: "shipyard" })
      // A pirate base whose tags say nothing about ships still sells what its build modules build.
      .station({ faction: "fx_corsairs", builds: ["ship_s"], tags: "piratebase" })
      // fx_rebels runs a station with no build module.
      .station({ faction: "fx_rebels", builds: [], tags: "tradestation" })
      .ship({ id: "fx_shuttle", owners: ["fx_rebels", "fx_guild", "fx_corsairs"] })
      .ship({ id: "fx_cruiser", size: "l", owners: ["fx_guild", "fx_navy"] })
      .ship({ id: "fx_rebel_cruiser", size: "l", owners: ["fx_rebels", "fx_guild"] })
      .ship({ id: "fx_unowned", size: "s" })
      .ship({ id: "fx_flagship", size: "xl", owners: ["fx_navy"], tags: "ship limited missiononly" })
      .ship({ id: "fx_dummy", owners: ["fx_guild"], tags: "ship noplayerbuild" })
      .ship({ id: "fx_blueprint", owners: ["fx_guild"], tags: "ship blueprintsaleonly" })
      .equipment(smallEngine());

  it("keeps Ships with a Seller: an owner running a station whose build modules cover the Ship's size", () => {
    const { readJson } = run(world());

    const ships = readJson("ships.json") as { id: string; sellers: string[] }[];
    expect(ships.map((s) => [s.id, s.sellers])).toEqual([
      ["fx_cruiser", ["fx_navy"]],
      ["fx_shuttle", ["fx_corsairs", "fx_guild"]],
    ]);
  });

  it("lists every Ship left out in the report, with its reason", () => {
    const { report } = run(world());

    expect(report()).toContain("## Ships left out");
    expect(report()).toContain("| fx_rebel_cruiser | no Seller: owned by fx_rebels, fx_guild, and none runs a station that builds ship_l |");
    expect(report()).toContain("| fx_unowned | no Seller: no Faction owns it |");
    expect(report()).toContain("| fx_flagship | tagged missiononly, limited |");
    expect(report()).toContain("| fx_dummy | tagged noplayerbuild |");
    expect(report()).toContain("| fx_blueprint | tagged blueprintsaleonly |");
  });

  it("returns the number of Ships by size", () => {
    const { result } = run(world());

    expect(result.ships).toEqual({ s: 1, m: 0, l: 1, xl: 0 });
  });
});

describe("transform: the snapshot", () => {
  it("writes a valid snapshot to <swi-version>_x4-<x4-version>/ and points current at it", () => {
    const { result, gameDataDir, readJson } = run();

    expect(result.snapshotDir).toBe(join(gameDataDir, "123_x4-700"));
    expect(realpathSync(join(gameDataDir, "current"))).toBe(realpathSync(result.snapshotDir));
    const raw = Object.fromEntries(
      ["manifest", "ships", "equipment", "fit-lists", "factions", "licences"].map((f) => [f, readJson(`${f}.json`)]),
    );
    expect(validateSnapshot(raw as never).errors).toEqual([]);
  });

  it("writes the manifest: SWI and X4 versions, DLCs, extraction time, pipeline commit and a content hash", () => {
    const { readJson } = run();

    expect(readJson("manifest.json")).toEqual({
      swi: { version: "123", label: "1.2.3 HF", date: "2026-01-02" },
      x4: { version: "700" },
      dlcs: [
        { id: "fx_dlc_a", version: "710" },
        { id: "fx_dlc_b", version: "720" },
      ],
      extractedAt: "2026-03-04T05:06:07Z",
      pipelineCommit: "abc1234",
      contentHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
  });

  it("gives the same content hash for the same data, and a different one when it changes", () => {
    const hash = (world: FixtureWorld) => run(world).readJson("manifest.json").contentHash;

    expect(hash(oneShipWorld())).toBe(hash(oneShipWorld()));
    expect(hash(oneShipWorld())).not.toBe(hash(oneShipWorld().ship({ id: "fx_more", owners: ["fx_guild"] })));
  });

  it("pretty-prints each file, with Ships sorted by id whatever the ware order", () => {
    const { gameDataDir, readJson } = run(
      oneShipWorld().ship({ id: "fx_b", owners: ["fx_guild"] }).ship({ id: "fx_a", owners: ["fx_guild"] }),
    );

    expect(readJson("ships.json").map((s: { id: string }) => s.id)).toEqual(["fx_a", "fx_b", "fx_fighter"]);
    const text = readFileSync(join(gameDataDir, "current", "ships.json"), "utf8");
    expect(text).toBe(JSON.stringify(readJson("ships.json"), null, 2) + "\n");
  });

  it("replaces the snapshot and the current pointer when run again", () => {
    const cacheDir = writeCache(oneShipWorld());
    const gameDataDir = mkdtempSync(join(tmpdir(), "game-data-"));
    transform({ cacheDir, gameDataDir, pipelineCommit: "first", now: NOW });
    transform({ cacheDir, gameDataDir, pipelineCommit: "second", now: NOW });

    const manifest = JSON.parse(readFileSync(join(gameDataDir, "current", "manifest.json"), "utf8"));
    expect(manifest.pipelineCommit).toBe("second");
  });

  it("writes nothing when the snapshot fails validation", () => {
    const cacheDir = writeCache(oneShipWorld().ship({ id: "fx_broken", owners: ["fx_guild"], properties: { hull: -5 } }));
    const gameDataDir = mkdtempSync(join(tmpdir(), "game-data-"));

    expect(() => transform({ cacheDir, gameDataDir, pipelineCommit: "abc", now: NOW })).toThrow(
      /snapshot failed validation:\n.*ships\.\d+\.stats\.hull/,
    );
    expect(existsSync(join(gameDataDir, "current"))).toBe(false);
  });
});

describe("transform: hard failures", () => {
  it("fails when no Ship is buildable", () => {
    const world = new FixtureWorld().faction({ id: "fx_guild", name: "Freight Guild" }).ship({ id: "fx_orphan" });

    expect(() => run(world)).toThrow(/No buildable Ships found/);
  });

  it("fails when a ship ware's macro isn't in the index", () => {
    const world = oneShipWorld().ship({ id: "fx_lost", owners: ["fx_guild"], macro: "fx_missing_macro" });

    expect(() => run(world)).toThrow(/ware fx_lost refers to macro "fx_missing_macro", which index\/macros\.xml doesn't list/);
  });

  it("fails when a ship macro's component file isn't there", () => {
    const world = oneShipWorld();
    const files = world.files();
    const componentPath = Object.keys(files).find((p) => p.endsWith("fx_fighter_component.xml"))!;
    world.extraFiles[componentPath] = `<components/>`;

    expect(() => run(world)).toThrow(/refers to component "fx_fighter_component", but .* isn't in the cache/);
  });

  it("fails when the cache hasn't been merged", () => {
    const gameDataDir = mkdtempSync(join(tmpdir(), "game-data-"));

    expect(() => transform({ cacheDir: mkdtempSync(join(tmpdir(), "empty-")), gameDataDir, pipelineCommit: "x" })).toThrow(
      /layers\.json doesn't exist\. Run the merge stage first\./,
    );
  });
});

describe("transform: Factions and Licences", () => {
  const world = () =>
    new FixtureWorld()
      .faction({
        id: "fx_guild",
        name: "Freight Guild",
        licences: [
          { type: "generaluseship", name: "Guild Civilian Licence", minrelation: "-0.01" },
          { type: "militaryship", name: "Guild Military Licence", minrelation: "0.01" },
          { type: "capitalship", name: "Guild Capital Licence", minrelation: "0.1" },
        ],
      })
      .faction({
        id: "fx_navy",
        name: "Fixture Navy",
        licences: [
          { type: "militaryship", name: "Navy Military Licence", minrelation: "-0.01" },
          { type: "capitalship", name: "Navy Capital Licence", minrelation: "0.1" },
        ],
      })
      .faction({ id: "fx_unused", name: "Nobody" })
      .station({ faction: "fx_guild", builds: ["ship_s ship_m ship_l"] })
      .station({ faction: "fx_navy", builds: ["ship_s ship_l"] })
      .ship({ id: "fx_shuttle", owners: ["fx_guild"], licence: "generaluseship" })
      .ship({ id: "fx_fighter", owners: ["fx_guild", "fx_navy"], licence: "militaryship" })
      .ship({ id: "fx_cruiser", size: "l", owners: ["fx_guild", "fx_navy"], licence: "capitalship" })
      .ship({ id: "fx_free", owners: ["fx_navy"] })
      .equipment(smallEngine(["fx_guild"]));

  it("lists the Factions that sell Ships, with their English names", () => {
    const { readJson } = run(world());

    expect(readJson("factions.json")).toEqual([
      { id: "fx_guild", name: "Freight Guild" },
      { id: "fx_navy", name: "Fixture Navy" },
    ]);
  });

  it("lists the Licences Ships need, with the reputation when every Seller asks for the same one", () => {
    const { readJson, ship, report } = run(world());

    expect(readJson("licences.json")).toEqual([
      { id: "capitalship", name: "Capital Ship Licence", reputation: 20 },
      { id: "generaluseship", name: "General Use Ship Licence", reputation: -10 },
      { id: "militaryship", name: "Military Ship Licence", reputation: null },
    ]);
    expect(ship("fx_free").licence).toBeNull();
    expect(report()).toContain("Licence militaryship needs a different reputation per Seller, so none is given: 10 (fx_guild); -10 (fx_navy)");
  });

  it("fails when a Seller isn't defined in libraries/factions.xml", () => {
    const world = new FixtureWorld()
      .station({ faction: "fx_ghost", builds: ["ship_s"] })
      .ship({ id: "fx_fighter", owners: ["fx_ghost"] })
      .equipment(smallEngine());

    expect(() => run(world)).toThrow(/Faction "fx_ghost" sells Ships or Equipment but libraries\/factions\.xml doesn't define it/);
  });
});

describe("transform: display names", () => {
  it("resolves names from English text, following references, dropping (comments) and keeping escaped parentheses", () => {
    const { ship } = run(
      oneShipWorld()
        .text("950", "1", "Venator")
        .text("950", "2", "{950,1}-class (dev note)Star Destroyer \\(Clone Era\\)")
        .ship({ id: "fx_venator", owners: ["fx_guild"], nameRef: "{950,2}" }),
    );

    expect(ship("fx_venator")).toMatchObject({ name: "Venator-class Star Destroyer (Clone Era)", nameId: "{950,2}" });
  });

  it("fails when a name's text id isn't in the English text", () => {
    expect(() => run(oneShipWorld().ship({ id: "fx_nameless", owners: ["fx_guild"], nameRef: "{950,9}" }))).toThrow(
      /ware fx_nameless: text \{950,9\} isn't in t\/0001-l044\.xml/,
    );
  });

  it("adds the distinguishing Sellers to Ships that share a display name", () => {
    const { ship } = run(
      oneShipWorld()
        .faction({ id: "fx_hutts", name: "Hutt Cartel" })
        .faction({ id: "fx_navy", name: "Fixture Navy" })
        .station({ faction: "fx_hutts", builds: ["ship_s"] })
        .station({ faction: "fx_navy", builds: ["ship_s"] })
        .ship({ id: "fx_venator", name: "Venator", owners: ["fx_guild", "fx_navy"] })
        .ship({ id: "fx_venator_hutt", name: "Venator", owners: ["fx_guild", "fx_hutts"] })
        .ship({ id: "fx_venator_plain", name: "Venator", owners: ["fx_guild"] }),
    );

    expect(ship("fx_venator").name).toBe("Venator (Fixture Navy)");
    expect(ship("fx_venator_hutt").name).toBe("Venator (Hutt Cartel)");
    expect(ship("fx_venator_plain").name).toBe("Venator");
    expect(ship("fx_fighter").name).toBe("Fixture Fighter");
  });

  it("fails when Sellers don't tell Ships with the same display name apart", () => {
    const world = oneShipWorld()
      .ship({ id: "fx_twin_a", name: "Twin", owners: ["fx_guild"] })
      .ship({ id: "fx_twin_b", name: "Twin", owners: ["fx_guild"] });

    expect(() => run(world)).toThrow(/Sellers don't tell these Ships apart: "Twin" \(fx_twin_a, fx_twin_b\)/);
  });
});

describe("transform: Ships", () => {
  it("writes a buildable Ship with its ware, macro and component data", () => {
    const { ship } = run(
      new FixtureWorld()
        .faction({ id: "fx_guild", name: "Freight Guild" })
        .station({ faction: "fx_guild", builds: ["ship_s ship_m"] })
        .ship({
          id: "fx_fighter",
          name: "Fixture Fighter",
          owners: ["fx_guild"],
          licence: "generaluseship",
          price: { min: 80, average: 100, max: 120 },
          properties: {
            hull: 3500,
            mass: 12,
            purpose: "fight",
            type: "interceptor",
            crew: 2,
            radar: 25000,
            rotationspeed: 90,
            storage: { missile: 6, unit: 3 },
            accfactors: `forward="0.8" horizontal="3"`,
          },
          storage: [{ capacity: 250, tags: "container" }],
        })
        .equipment(smallEngine()),
    );

    expect(ship("fx_fighter")).toEqual({
      id: "fx_fighter",
      name: "Fixture Fighter",
      nameId: "{900,2}",
      price: { min: 80, average: 100, max: 120 },
      licence: "generaluseship",
      sellers: ["fx_guild"],
      size: "s",
      type: "interceptor",
      purpose: "fight",
      stats: {
        hull: 3500,
        mass: 12,
        radarRange: 25000,
        drag: { forward: 1, reverse: 2, horizontal: 3, vertical: 4, pitch: 5, yaw: 6, roll: 7 },
        accFactors: { forward: 0.8, reverse: 1, horizontal: 3, vertical: 1 },
        maxRotationSpeed: 90,
      },
      capacities: { missiles: 6, drones: 3, deployables: 5, countermeasures: 8, crew: 2, cargo: 250 },
      cargoTypes: ["container"],
      slots: [{ id: "con_engine_01", kind: "engine", size: "s", mandatory: false, fitList: expect.any(String) }],
      slotGroups: [],
      thrusters: expect.any(String),
      software: { fitList: expect.any(String), mandatory: [] },
      drones: expect.any(String),
      deployables: expect.any(String),
      countermeasures: expect.any(String),
    });
  });

  it("takes radar range, crew and countermeasure and deployable capacity from the class defaults when the macro has none", () => {
    const { ship } = run(
      oneShipWorld().ship({ id: "fx_plain", size: "m", owners: ["fx_guild"], properties: { storage: { missile: 2, deployable: 7 } } }),
    );

    expect(ship("fx_plain").stats.radarRange).toBe(30000);
    expect(ship("fx_plain").capacities).toMatchObject({ crew: 5, countermeasures: 16, deployables: 7, missiles: 2, drones: 0 });
  });

  it("adds up the Ship's storage and lists its cargo types", () => {
    const { ship } = run(
      oneShipWorld()
        .ship({ id: "fx_mixed", owners: ["fx_guild"], storage: [{ capacity: 500, tags: "solid liquid" }, { capacity: 100, tags: "container" }] })
        .ship({ id: "fx_none", owners: ["fx_guild"], storage: [] }),
    );

    expect(ship("fx_mixed").capacities.cargo).toBe(600);
    expect(ship("fx_mixed").cargoTypes).toEqual(["container", "liquid", "solid"]);
    expect(ship("fx_none").capacities.cargo).toBe(0);
    expect(ship("fx_none").cargoTypes).toEqual([]);
  });

  it("reads Slots and Slot Groups from the component's connections", () => {
    const { ship, report } = run(
      oneShipWorld().station({ faction: "fx_guild", builds: ["ship_l"] }).ship({
        id: "fx_frigate",
        size: "l",
        owners: ["fx_guild"],
        slots: [
          { name: "con_weapon_02", tags: "weapon medium kx7" },
          { name: "con_weapon_01", tags: "component weapon small" },
          { name: "con_turret_01", tags: "turret medium mandatory" },
          { name: "con_shield_01", tags: "shield astromech" },
          { name: "con_engine_01", tags: "engine large", group: "enginegroup" },
          { name: "con_engine_02", tags: "engine large", group: "enginegroup" },
          { name: "con_turret_02", tags: "turret medium hittable", group: "group_front" },
          { name: "con_turret_03", tags: "turret medium hittable", group: "group_front" },
          { name: "con_turret_04", tags: "turret medium hittable", group: "group_front" },
          { name: "con_shield_02", tags: "shield medium hittable", group: "group_front" },
          { name: "con_dock_01", tags: "dock medium" },
        ],
      }),
    );

    const slot = (id: string, kind: string, size: string, mandatory = false) => ({ id, kind, size, mandatory, fitList: "empty" });
    expect(ship("fx_frigate").slots).toEqual([
      slot("con_shield_01", "shield", "l"),
      slot("con_turret_01", "turret", "m", true),
      slot("con_weapon_01", "weapon", "s"),
      slot("con_weapon_02", "weapon", "m"),
    ]);
    expect(ship("fx_frigate").slotGroups).toEqual([
      { id: "enginegroup", kinds: { engine: { count: 2, fitList: "empty" } } },
      { id: "group_front", kinds: { turret: { count: 3, fitList: "empty" }, shield: { count: 1, fitList: "empty" } } },
    ]);
    expect(report()).toContain("fx_frigate: shield slot con_shield_01 has no size tag; it takes the Ship's size");
  });

  it("keeps group names exactly as written, and warns about ones with stray spaces", () => {
    const { ship, report } = run(
      oneShipWorld().ship({
        id: "fx_gunboat",
        owners: ["fx_guild"],
        slots: [
          { name: "con_shield_01", tags: "shield small", group: "group_left" },
          { name: "con_turret_01", tags: "turret small", group: "group_left " },
        ],
      }),
    );

    expect(ship("fx_gunboat").slotGroups.map((g: { id: string }) => g.id)).toEqual(["group_left", "group_left "]);
    expect(report()).toContain(`fx_gunboat: Slot Group "group_left " has spaces around its name`);
  });

  it("fails on a weapon connection in a Slot Group", () => {
    const world = oneShipWorld().ship({
      id: "fx_odd",
      owners: ["fx_guild"],
      slots: [{ name: "con_weapon_01", tags: "weapon small", group: "g1" }],
    });

    expect(() => run(world)).toThrow(/fx_odd: weapon connection con_weapon_01 is in group g1/);
  });

  it("keeps a price whose average is outside min..max as written, and lists it as a warning", () => {
    const { ship, report } = run(
      oneShipWorld().ship({ id: "fx_odd", owners: ["fx_guild"], price: { min: 300, average: 200, max: 400 } }),
    );

    expect(ship("fx_odd").price).toEqual({ min: 300, average: 200, max: 400 });
    expect(report()).toMatch(/fx_odd: price isn't min <= average <= max \(300, 200, 400\)/);
  });
});

describe("transform: the snapshot diff", () => {
  it("diffs the new snapshot against the one current pointed at, and writes the diff beside the report", () => {
    const gameDataDir = mkdtempSync(join(tmpdir(), "game-data-"));
    transform({ cacheDir: writeCache(oneShipWorld()), gameDataDir, pipelineCommit: "first", now: NOW });
    // oneShipWorld, with the fighter's hull changed and a scout added.
    const cacheDir = writeCache(
      new FixtureWorld()
        .faction({ id: "fx_guild", name: "Freight Guild", licences: [{ type: "generaluseship", name: "Guild Ship Licence", minrelation: "-0.01" }] })
        .station({ faction: "fx_guild", builds: ["ship_s ship_m"] })
        .ship({ id: "fx_fighter", name: "Fixture Fighter", owners: ["fx_guild"], licence: "generaluseship", properties: { hull: 9000 } })
        .ship({ id: "fx_scout", name: "Fixture Scout", owners: ["fx_guild"] })
        .equipment(smallEngine()),
    );

    const result = transform({ cacheDir, gameDataDir, pipelineCommit: "second", now: NOW });

    expect(result.diffPath).toBe(join(cacheDir, "snapshot-diff.md"));
    const diff = readFileSync(result.diffPath, "utf8");
    expect(diff).toContain("| Ships | 1 | 0 | 1 |");
    expect(diff).toContain("| fx_scout | Fixture Scout |");
    expect(diff).toContain("| fx_fighter | Fixture Fighter | stats.hull |");
  });

  it("says when there is no previous snapshot", () => {
    const { result } = run();

    expect(readFileSync(result.diffPath, "utf8")).toContain("No previous snapshot to diff against");
  });
});

describe("transform: rotationspeed@max", () => {
  const thruster = (id: string, yaw: number) => ({
    id,
    kind: "thruster" as const,
    connection: "thruster small component",
    properties: `<thrust strafe="400" pitch="100" yaw="${yaw}" roll="100"/>`,
  });
  // The fixture Ships' drag is pitch 5, yaw 6, roll 7: turning is thrust / drag before the cap.
  const world = () =>
    oneShipWorld()
      .ship({ id: "fx_capped", owners: ["fx_guild"], properties: { rotationspeed: 18 } })
      .ship({ id: "fx_loose", owners: ["fx_guild"], properties: { rotationspeed: 50 } })
      .equipment(thruster("fx_thruster_a", 60))
      .equipment(thruster("fx_thruster_b", 120));

  it("lists every Ship whose rotationspeed@max is below thrust / drag with a thruster that fits it", () => {
    const { report } = run(world());

    expect(report()).toContain("## Ships where rotationspeed@max binds");
    expect(report()).toContain("| fx_capped | 18 | fx_thruster_a: pitch 20; fx_thruster_b: pitch 20, yaw 20 |");
    expect(report()).not.toContain("| fx_loose |");
    expect(report()).not.toContain("| fx_fighter |");
  });

  it("says None when no cap binds", () => {
    const { report } = run();

    expect(report()).toMatch(/## Ships where rotationspeed@max binds\n\n[^#|]*\nNone\./);
  });
});
