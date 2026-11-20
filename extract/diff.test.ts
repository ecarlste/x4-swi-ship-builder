import { describe, expect, it } from "vitest";
import { diffSnapshots, renderDiff, type DiffableSnapshot } from "./diff.ts";

/** Two hand-made snapshots: only what the diff looks at, with a few stats to change. */
const previous: DiffableSnapshot = {
  manifest: { swi: { label: "0.9.0" }, x4: { version: "800" } },
  ships: [
    { id: "fx_courier", name: "Swiftwing Courier", price: { min: 90, average: 100, max: 110 }, slots: [{ id: "con_a" }] },
    { id: "fx_hauler", name: "Ironback Hauler", stats: { hull: 5000, drag: { yaw: 3 } } },
    { id: "fx_needle", name: "Needle Striker", sellers: ["fx_guild"] },
  ],
  equipment: [
    { id: "fx_pulse_s", name: "Pulse Blaster", kind: "weapon" },
    { id: "fx_shield_s", name: "Bubble Shield S", kind: "shield", capacity: 100 },
  ],
};

const next: DiffableSnapshot = {
  manifest: { swi: { label: "0.9.1 HF" }, x4: { version: "800" } },
  ships: [
    // Price, a Slot's fit list and nested stats changed; the Needle is unchanged; the Bramble is new.
    { id: "fx_bramble", name: "Bramble Fighter" },
    { id: "fx_courier", name: "Swiftwing Courier", price: { min: 90, average: 120, max: 110 }, slots: [{ id: "con_b" }] },
    { id: "fx_hauler", name: "Ironback Hauler Mk2", stats: { hull: 5000, drag: { yaw: 4 } } },
    { id: "fx_needle", name: "Needle Striker", sellers: ["fx_guild"] },
  ],
  equipment: [
    { id: "fx_shield_s", name: "Bubble Shield S", kind: "shield", capacity: 120 },
    { id: "fx_torpedo", name: "Heavy Torpedo", kind: "missile" },
  ],
};

describe("diffSnapshots", () => {
  it("lists the Ships and Equipment added, removed and changed, by id with their names", () => {
    const diff = diffSnapshots(previous, next);

    expect(diff.ships).toEqual({
      added: [{ id: "fx_bramble", name: "Bramble Fighter" }],
      removed: [],
      changed: [
        { id: "fx_courier", name: "Swiftwing Courier", fields: ["price.average", "slots[con_a]", "slots[con_b]"] },
        { id: "fx_hauler", name: "Ironback Hauler Mk2", fields: ["name", "stats.drag.yaw"] },
      ],
    });
    expect(diff.equipment).toEqual({
      added: [{ id: "fx_torpedo", name: "Heavy Torpedo" }],
      removed: [{ id: "fx_pulse_s", name: "Pulse Blaster" }],
      changed: [{ id: "fx_shield_s", name: "Bubble Shield S", fields: ["capacity"] }],
    });
  });

  it("goes into lists of items with ids by id, so it names the Slot Groups that changed (#52)", () => {
    const ship = (slotGroups: unknown[]) => ({
      ...previous,
      ships: [{ id: "fx_miner", name: "Gas Miner", slotGroups, slots: [{ id: "con_a" }] }],
    });
    const before = ship([
      { id: "enginegroup", kinds: { shield: { count: 2 }, engine: { count: 1 } } },
      { id: "enginegroup  ", kinds: { engine: { count: 2 } } },
      { id: "group_top", kinds: { turret: { count: 1 } } },
    ]);
    const after = ship([
      { id: "enginegroup", kinds: { shield: { count: 2 }, engine: { count: 3 } } },
      { id: "group_top", kinds: { turret: { count: 1 } } },
    ]);

    expect(diffSnapshots(before, after).ships.changed).toEqual([
      { id: "fx_miner", name: "Gas Miner", fields: ["slotGroups[enginegroup].kinds.engine.count", 'slotGroups["enginegroup  "]'] },
    ]);
  });

  it("finds nothing between a snapshot and itself", () => {
    const diff = diffSnapshots(next, structuredClone(next));

    expect(diff.ships).toEqual({ added: [], removed: [], changed: [] });
    expect(diff.equipment).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe("renderDiff", () => {
  it("renders counts, then each added, removed and changed item with its name", () => {
    const text = renderDiff(diffSnapshots(previous, next), previous, next);

    expect(text).toContain("# Snapshot diff");
    expect(text).toContain("From SWI 0.9.0 on X4 800 to SWI 0.9.1 HF on X4 800.");
    expect(text).toContain("| Ships | 1 | 0 | 2 |");
    expect(text).toContain("| Equipment | 1 | 1 | 1 |");
    expect(text).toContain("### Ships added\n\n| Id | Name |\n| --- | --- |\n| fx_bramble | Bramble Fighter |");
    expect(text).toContain("### Ships removed\n\nNone.");
    expect(text).toContain("| fx_hauler | Ironback Hauler Mk2 | name, stats.drag.yaw |");
    expect(text).toContain("### Equipment removed\n\n| Id | Name |\n| --- | --- |\n| fx_pulse_s | Pulse Blaster |");
  });

  it("says when there is no previous snapshot to diff against", () => {
    const text = renderDiff(undefined, undefined, next);

    expect(text).toContain("No previous snapshot to diff against");
  });
});
