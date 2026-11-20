import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SNAPSHOT_FILES, validateSnapshot, type RawSnapshot } from "./validateSnapshot.ts";

const fixtureDir = join(import.meta.dirname, "../../fixtures/game-data/tiny");

function loadFixture(): RawSnapshot {
  return Object.fromEntries(
    SNAPSHOT_FILES.map((name) => [name, JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), "utf8"))]),
  ) as RawSnapshot;
}

describe("validateSnapshot", () => {
  it("accepts the tiny fixture snapshot", () => {
    const result = validateSnapshot(loadFixture());

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.gameData.manifest.swi.label).toBe("9.9.9 Fixture");
      expect(result.gameData.ships.map((s) => s.id)).toContain("fx_courier");
    }
  });

  it("rejects a snapshot that breaks the schema, naming the file and field", () => {
    const raw = loadFixture() as Record<string, any>;
    raw.equipment[0].kind = "hyperdrive";

    const result = validateSnapshot(raw as RawSnapshot);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringMatching(/^equipment\.0\.kind: /)]);
  });

  it("gives the crew price, which Crew is bought at", () => {
    const result = validateSnapshot(loadFixture());

    expect(result.ok && result.gameData.crewPrice).toEqual({ min: 4000, average: 6000, max: 8000 });
  });

  it("rejects a snapshot without the crew price", () => {
    const raw = loadFixture() as Record<string, any>;
    delete raw["crew-price"];

    const result = validateSnapshot(raw as RawSnapshot);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([expect.stringMatching(/^crew-price: /)]);
  });

  describe("reference integrity", () => {
    function errorsAfter(change: (raw: Record<string, any>) => void): string[] {
      const raw = loadFixture() as Record<string, any>;
      change(raw);
      const result = validateSnapshot(raw as RawSnapshot);
      expect(result.ok).toBe(false);
      return result.errors;
    }

    it("reports a Slot whose fit list doesn't exist", () => {
      const errors = errorsAfter((raw) => {
        raw.ships[0].slots[0].fitList = "fl_missing";
      });

      expect(errors).toEqual([
        'ships: fx_courier slot con_weapon_01 refers to unknown fit list "fl_missing"',
      ]);
    });

    it("reports every other unknown fit list a Ship or launcher refers to", () => {
      const errors = errorsAfter((raw) => {
        const hauler = raw.ships[1];
        hauler.slotGroups[0].kinds.turret.fitList = "fl_a";
        hauler.thrusters = "fl_b";
        hauler.software.fitList = "fl_c";
        hauler.drones = "fl_d";
        hauler.deployables = "fl_e";
        hauler.countermeasures = "fl_f";
        raw.equipment.find((e: any) => e.id === "fx_launcher_s").missiles = "fl_g";
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          'ships: fx_hauler slot group group_front turret refers to unknown fit list "fl_a"',
          'ships: fx_hauler thrusters refers to unknown fit list "fl_b"',
          'ships: fx_hauler software refers to unknown fit list "fl_c"',
          'ships: fx_hauler drones refers to unknown fit list "fl_d"',
          'ships: fx_hauler deployables refers to unknown fit list "fl_e"',
          'ships: fx_hauler countermeasures refers to unknown fit list "fl_f"',
          'equipment: fx_launcher_s missiles refers to unknown fit list "fl_g"',
        ]),
      );
    });

    it("reports a fit list naming unknown Equipment", () => {
      const errors = errorsAfter((raw) => {
        raw["fit-lists"].find((f: any) => f.id === "fl_shield_s").equipment.push("fx_ghost_shield");
      });

      expect(errors).toEqual(['fit-lists: fl_shield_s refers to unknown equipment "fx_ghost_shield"']);
    });

    it("reports unknown Sellers and Licences on Ships and Equipment", () => {
      const errors = errorsAfter((raw) => {
        raw.ships[0].sellers = ["fx_nobody"];
        raw.ships[0].licence = "fx_no_licence";
        raw.equipment[0].sellers.push("fx_nobody");
        raw.equipment[0].licence = "fx_no_licence";
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          'ships: fx_courier seller refers to unknown faction "fx_nobody"',
          'ships: fx_courier licence refers to unknown licence "fx_no_licence"',
          'equipment: fx_flare seller refers to unknown faction "fx_nobody"',
          'equipment: fx_flare licence refers to unknown licence "fx_no_licence"',
        ]),
      );
      expect(errors).toHaveLength(4);
    });

    it("reports duplicate ids within a table and within a Ship", () => {
      const errors = errorsAfter((raw) => {
        raw.factions.push({ id: "fx_guild", name: "Second Guild" });
        const hauler = raw.ships[1];
        hauler.slots.push({ ...hauler.slots[0] });
        hauler.slotGroups.push({ ...hauler.slotGroups[1] });
      });

      expect(errors).toEqual([
        'factions: duplicate id "fx_guild"',
        'ships: fx_hauler has duplicate Slot id "con_shield_01"',
        'ships: fx_hauler has duplicate Slot Group id "enginegroup"',
      ]);
    });

    it("reports Slot Group ids that collide once trimmed, since the game merges them (#52)", () => {
      const errors = errorsAfter((raw) => {
        const hauler = raw.ships[1];
        hauler.slotGroups.push({ ...hauler.slotGroups[1], id: "enginegroup  " });
      });

      expect(errors).toEqual([
        'ships: fx_hauler has Slot Group ids "enginegroup", "enginegroup  " that are one Slot Group in game, as they differ only by spaces',
      ]);
    });

    it("reports a Ship whose engines don't share one fit list, since they take one engine type (#50)", () => {
      const errors = errorsAfter((raw) => {
        raw.ships[1].slotGroups.push({ id: "enginegroup_aft", kinds: { engine: { count: 1, fitList: "fl_engine_s" } } });
      });

      expect(errors).toEqual([
        'ships: fx_hauler engines are on more than one fit list ("fl_engine_l", "fl_engine_s"), but take one engine type',
      ]);
    });

    it("reports Equipment of the wrong kind in a fit list", () => {
      const errors = errorsAfter((raw) => {
        raw.ships[0].slots[2].fitList = "fl_weapon_s"; // a shield Slot
        raw.ships[1].slotGroups[1].kinds.engine.fitList = "fl_thruster_l";
        raw.ships[1].drones = "fl_deployables";
        raw.equipment.find((e: any) => e.id === "fx_launcher_s").missiles = "fl_drones";
      });

      expect(errors).toEqual(
        expect.arrayContaining([
          'ships: fx_courier slot con_shield_01 takes shield but fit list "fl_weapon_s" has weapon "fx_cannon_s"',
          'ships: fx_courier slot con_shield_01 takes shield but fit list "fl_weapon_s" has weapon "fx_launcher_s"',
          'ships: fx_courier slot con_shield_01 takes shield but fit list "fl_weapon_s" has weapon "fx_pulse_s"',
          'ships: fx_courier slot con_shield_01 takes shield but fit list "fl_weapon_s" has weapon "fx_tube_s"',
          'ships: fx_hauler slot group enginegroup engine takes engine but fit list "fl_thruster_l" has thruster "fx_thruster_l"',
          'ships: fx_hauler drones takes drone but fit list "fl_deployables" has deployable "fx_beacon"',
          'equipment: fx_launcher_s missiles takes missile but fit list "fl_drones" has drone "fx_cargo_drone"',
        ]),
      );
      expect(errors).toHaveLength(7);
    });

    it("reports mandatory software that isn't one of the Ship's software options", () => {
      const errors = errorsAfter((raw) => {
        raw.ships[0].software.mandatory = ["fx_pulse_s"];
      });

      expect(errors).toEqual([
        'ships: fx_courier mandatory software "fx_pulse_s" is not in fit list "fl_software"',
      ]);
    });
  });
});
