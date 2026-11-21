/**
 * The builder session's transitions, against the tiny fixture Game Data
 * (SWI "999", X4 "9.99"), in-memory storage and fake clipboard and download.
 */
import { describe, expect, test } from "vitest";
import { gameData } from "../gameData.ts";
import { indexGameData } from "../gameDataIndex.ts";
import { memoryStorage } from "../codec/testing/memoryStorage.ts";
import { createSession } from "./session.ts";
import { setSlot } from "./loadout.ts";
import type { SavedLoadout } from "../codec/loadout.ts";
import { shareLinkUrl } from "../codec/shareLink.ts";
import type { SavedLoadoutEntry } from "../codec/savedLoadouts.ts";

const current = { swi: "999", x4: "9.99" };
const older = { swi: "091", x4: "8.00" };

const savedLoadout = (over: Record<string, unknown> = {}): SavedLoadout => ({
  format: 1,
  gameData: current,
  ship: "fx_courier",
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Shielded Courier",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  ...over,
});

/** A Courier with a Bubble Shield S fitted, made against the current Game Data. */
const shielded = savedLoadout({ slots: { con_shield_01: "fx_shield_s" } });
/** Made against older Game Data: three entries no longer fit. */
const escort = savedLoadout({
  id: "33333333-2222-4333-8444-555555555555",
  name: "Escort",
  gameData: older,
  slots: { con_weapon_01: "fx_pulse_s", con_weapon_09: "fx_cannon_s", con_shield_01: "fx_shield_gone" },
  consumables: { fx_flare: 9 },
});
/** Its Ship is gone from the Game Data. */
const relic = savedLoadout({ id: "22222222-3333-4444-8555-666666666666", name: "Relic", ship: "fx_ship_gone" });

const ship = (id: string) => indexGameData(gameData).ships.get(id)!;

const APP = "https://builder.example/";

/** The fragment of a Share Link carrying this value. */
const fragmentFor = async (value: unknown) => new URL(await shareLinkUrl(APP, value as never)).hash;

/** A Saved Loadout's Loadout, as a Share Link would carry it under its name. */
const sharedOf = ({ id: _id, createdAt: _c, updatedAt: _u, ...shared }: SavedLoadout) => shared;

function setup(stored?: unknown, { clipboardFails = false } = {}) {
  const storage = memoryStorage(stored);
  const copied: string[] = [];
  const downloads: { text: string; fileName: string }[] = [];
  const session = createSession({
    gameData,
    storage,
    clipboard: {
      writeText: async (text) => {
        if (clipboardFails) throw new Error("clipboard refused");
        copied.push(text);
      },
    },
    download: (text, fileName) => void downloads.push({ text, fileName }),
  });
  return { session, storage, copied, downloads, state: () => session.getState() };
}

describe("picking a Ship", () => {
  test("opens it as an Empty Loadout with its stats, and nothing to compare against", () => {
    const { session, state } = setup();

    session.pickShip(ship("fx_courier"));

    expect(state()).toMatchObject({
      loadout: { format: 1, gameData: { swi: "999", x4: "9.99" }, ship: "fx_courier" },
      ship: { name: "Swiftwing Courier" },
      opened: null,
      loaded: null,
      was: null,
      wasStats: null,
    });
    expect(state().stats?.missing).toBeDefined();
  });

  test("an edit after picking shows no changes: a freshly picked Ship has no Loaded Loadout", () => {
    const { session, state } = setup();
    session.pickShip(ship("fx_courier"));

    session.edit(setSlot(state().loadout!, "con_weapon_01", "fx_pulse_s"));

    expect(state().loadout?.slots).toEqual({ con_weapon_01: "fx_pulse_s" });
    expect(state().was).toBeNull();
  });
});

const listedNames = (state: { savedList: { entries: { status: string; loadout?: { name: string } }[] } }) =>
  state.savedList.entries.map((e) => e.loadout?.name ?? e.status);

describe("saving", () => {
  test("a first save asks for a name, suggesting the Ship's", () => {
    const { session, state, storage } = setup();
    session.pickShip(ship("fx_courier"));

    session.save();

    expect(state().naming).toEqual({ suggestedName: "Swiftwing Courier" });
    expect(storage.raw()).toBeNull();
  });

  test("saving under a name adds a Saved Loadout and makes it the Loaded Loadout", () => {
    const { session, state, storage } = setup();
    session.pickShip(ship("fx_courier"));
    session.save();

    session.save("Courier A");

    const [saved] = JSON.parse(storage.raw()!);
    expect(saved).toMatchObject({ ship: "fx_courier", name: "Courier A" });
    expect(state()).toMatchObject({
      naming: null,
      opened: { id: saved.id, name: "Courier A" },
      loaded: { ship: "fx_courier" },
      message: { kind: "status", text: "Saved “Courier A”." },
    });
    expect(listedNames(state())).toEqual(["Courier A"]);
  });

  test("the suggested name follows what's open while the dialog is up", async () => {
    const { session, state } = setup();
    session.pickShip(ship("fx_courier"));
    session.save();

    await session.openShareLink(await fragmentFor(sharedOf(shielded)));
    expect(state().naming).toEqual({ suggestedName: "Shielded Courier" });

    session.pickShip(ship("fx_bramble"));
    expect(state().naming).toEqual({ suggestedName: "Bramble Fighter" });
  });

  test("cancelling the name closes the dialog and saves nothing", () => {
    const { session, state, storage } = setup();
    session.pickShip(ship("fx_courier"));
    session.save();

    session.cancelNaming();

    expect(state().naming).toBeNull();
    expect(storage.raw()).toBeNull();
  });

  test("saving again updates the opened Saved Loadout without asking for a name", () => {
    const { session, state, storage } = setup();
    session.pickShip(ship("fx_courier"));
    session.save("Courier A");
    session.edit(setSlot(state().loadout!, "con_weapon_01", "fx_cannon_s"));

    session.save();

    expect(state().naming).toBeNull();
    const list = JSON.parse(storage.raw()!);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Courier A", slots: { con_weapon_01: "fx_cannon_s" } });
  });

  test("after a save, changes are measured from the saved version", () => {
    const { session, state } = setup();
    session.pickShip(ship("fx_courier"));
    session.save("Courier A");
    session.edit(setSlot(state().loadout!, "con_shield_01", "fx_shield_s"));

    expect(state().was).toMatchObject({ ship: "fx_courier" });
    expect(state().was).not.toHaveProperty("slots");
    expect(state().wasStats).not.toBeNull();

    session.save();
    expect(state().was).toBeNull();
    expect(state().wasStats).toBeNull();

    session.edit(setSlot(state().loadout!, "con_shield_01", null));
    expect(state().was?.slots).toEqual({ con_shield_01: "fx_shield_s" });
  });

  test("picking another Ship and saving asks for a name again and adds a new Saved Loadout", () => {
    const { session, state } = setup();
    session.pickShip(ship("fx_courier"));
    session.save("Courier A");

    session.pickShip(ship("fx_bramble"));
    session.save();
    expect(state().naming).toEqual({ suggestedName: "Bramble Fighter" });
    session.save("Bramble A");

    expect(listedNames(state())).toEqual(["Courier A", "Bramble A"]);
  });

  test("a stored value that isn't a list shows an error and is left untouched", () => {
    const { session, state, storage } = setup('{"not":"a list"}');
    session.pickShip(ship("fx_courier"));
    session.save();

    session.save("Courier A");

    expect(state().naming).toBeNull();
    expect(state().message).toEqual({ kind: "error", text: expect.stringMatching(/couldn't be read/) });
    expect(state().opened).toBeNull();
    expect(storage.raw()).toBe('{"not":"a list"}');
  });
});

/** The listed Saved Loadout with this name. */
const entry = (state: { savedList: { entries: SavedLoadoutEntry[] } }, name: string) => {
  const found = state.savedList.entries.find((e) => e.status === "ok" && e.loadout.name === name);
  if (found?.status !== "ok") throw new Error(`no Saved Loadout named ${name}`);
  return found;
};

describe("the Saved Loadouts list", () => {
  test("toggles open and shut, reading storage again as it opens", () => {
    const { session, state, storage } = setup();
    expect(state().showSaved).toBe(false);

    storage.setItem("swi-builder:saved-loadouts:v1", JSON.stringify([shielded]));
    session.toggleSaved();
    expect(state().showSaved).toBe(true);
    expect(listedNames(state())).toEqual(["Shielded Courier"]);

    session.toggleSaved();
    expect(state().showSaved).toBe(false);
  });
});

describe("opening a Saved Loadout", () => {
  test("opens it under its name and id as the Loaded Loadout, and hides the list", () => {
    const { session, state } = setup([shielded]);
    session.toggleSaved();

    session.openSaved(entry(state(), "Shielded Courier").loadout);

    expect(state()).toMatchObject({
      loadout: { ship: "fx_courier", slots: { con_shield_01: "fx_shield_s" } },
      opened: { id: shielded.id, name: "Shielded Courier" },
      loaded: { ship: "fx_courier", slots: { con_shield_01: "fx_shield_s" } },
      showSaved: false,
      notice: null,
      was: null,
    });
    expect(state().loadout).not.toHaveProperty("id");
    expect(state().loadout).not.toHaveProperty("createdAt");
  });

  test("editing it shows what it was; undoing the edit clears it", () => {
    const { session, state } = setup([shielded]);
    session.openSaved(shielded);

    session.edit(setSlot(state().loadout!, "con_shield_01", null));
    expect(state().was?.slots).toEqual({ con_shield_01: "fx_shield_s" });
    expect(state().wasStats?.rows).toBeDefined();

    session.edit(setSlot(state().loadout!, "con_shield_01", "fx_shield_s"));
    expect(state().was).toBeNull();
  });

  test("picking a Ship afterwards drops the name and the Loaded Loadout", () => {
    const { session, state } = setup([shielded]);
    session.openSaved(shielded);

    session.pickShip(ship("fx_bramble"));

    expect(state()).toMatchObject({ opened: null, loaded: null, was: null });
  });

  test("one that no longer fits opens repaired, with a notice, and the repaired version is the Loaded Loadout", () => {
    const { session, state, storage } = setup([escort]);
    const before = storage.raw();

    session.openSaved(escort);

    expect(state().loadout).toMatchObject({ gameData: current, slots: { con_weapon_01: "fx_pulse_s" }, consumables: { fx_flare: 5 } });
    expect(state().notice?.versions).toEqual({ from: older, to: current });
    expect(state().notice?.changes).toHaveLength(3);
    expect(state().was).toBeNull();
    expect(storage.raw()).toBe(before);

    session.dismissNotice();
    expect(state().notice).toBeNull();
  });

  test("saving a repaired one writes the repaired version under its id, and clears the notice", () => {
    const { session, state, storage } = setup([escort]);
    session.openSaved(escort);

    session.save();

    expect(state().naming).toBeNull();
    expect(state().notice).toBeNull();
    expect(JSON.parse(storage.raw()!)).toEqual([
      expect.objectContaining({ id: escort.id, gameData: current, slots: { con_weapon_01: "fx_pulse_s" } }),
    ]);
  });

  test("one that only changed version opens without a notice", () => {
    const { session, state } = setup();
    session.openSaved(savedLoadout({ gameData: older, slots: { con_weapon_01: "fx_pulse_s" } }));

    expect(state().loadout?.gameData).toEqual(current);
    expect(state().notice).toBeNull();
  });

  test("one whose Ship is gone isn't opened, and says why", () => {
    const { session, state } = setup([shielded, relic]);
    session.openSaved(shielded);
    session.toggleSaved();

    session.openSaved(relic);

    expect(state().message).toEqual({ kind: "error", text: expect.stringContaining("fx_ship_gone") });
    expect(state().opened?.name).toBe("Shielded Courier");
    expect(state().showSaved).toBe(true);
  });

  test("opening clears the last message", () => {
    const { session, state } = setup([shielded]);
    session.pickShip(ship("fx_courier"));
    session.save("Courier A");
    expect(state().message).not.toBeNull();

    session.openSaved(shielded);

    expect(state().message).toBeNull();
  });
});

describe("Crew (ADR 0004)", () => {
  const boarding = savedLoadout({ ship: "fx_hauler", name: "Boarding Hauler", crew: { service: 5, marines: 3 } });

  test("comes back when a Saved Loadout is opened", () => {
    const { session, state } = setup([boarding]);

    session.openSaved(boarding);

    expect(state().loadout?.crew).toEqual({ service: 5, marines: 3 });
  });

  test("travels in a copied Share Link", async () => {
    const { session, copied } = setup([boarding]);
    session.openSaved(boarding);
    await session.copyLink(APP);

    const other = setup();
    await other.session.openShareLink(new URL(copied[0]!).hash);

    expect(other.state().loadout?.crew).toEqual({ service: 5, marines: 3 });
  });
});

describe("deleting a Saved Loadout", () => {
  test("removes it from storage and the list", () => {
    const { session, state, storage } = setup([shielded, escort]);

    session.delete(entry(state(), "Shielded Courier"));

    expect(listedNames(state())).toEqual(["Escort"]);
    expect(JSON.parse(storage.raw()!)).toEqual([escort]);
  });

  test("an Unreadable one is removed by its place", () => {
    const { session, state } = setup([{ name: "half a loadout" }, shielded]);

    session.delete(state().savedList.entries[0]!);

    expect(listedNames(state())).toEqual(["Shielded Courier"]);
  });

  test("deleting the open one keeps its name and its Loaded Loadout, and Save asks for a name, suggesting it", () => {
    const { session, state } = setup([shielded]);
    session.openSaved(shielded);
    session.edit(setSlot(state().loadout!, "con_shield_01", null));

    session.delete(entry(state(), "Shielded Courier"));

    expect(state().opened).toEqual({ name: "Shielded Courier" });
    expect(state().was?.slots).toEqual({ con_shield_01: "fx_shield_s" });
    session.save();
    expect(state().naming).toEqual({ suggestedName: "Shielded Courier" });
  });

  test("deleting another one leaves the open one as it is", () => {
    const { session, state } = setup([shielded, escort]);
    session.openSaved(shielded);

    session.delete(entry(state(), "Escort"));

    expect(state().opened).toEqual({ id: shielded.id, name: "Shielded Courier" });
  });
});

describe("opening a Share Link", () => {
  test("a fragment without one does nothing", async () => {
    const { session, state } = setup();
    session.pickShip(ship("fx_courier"));
    const before = state();

    expect(await session.openShareLink("")).toBe(false);
    expect(await session.openShareLink("#other=1")).toBe(false);
    expect(state()).toBe(before);
  });

  test("opens its Loadout under its name, without an id, as the Loaded Loadout", async () => {
    const { session, state } = setup();

    expect(await session.openShareLink(await fragmentFor(sharedOf(shielded)))).toBe(true);

    expect(state()).toMatchObject({
      loadout: { ship: "fx_courier", slots: { con_shield_01: "fx_shield_s" } },
      opened: { name: "Shielded Courier" },
      loaded: { slots: { con_shield_01: "fx_shield_s" } },
      was: null,
    });
    expect(state().loadout).not.toHaveProperty("name");
    session.edit(setSlot(state().loadout!, "con_shield_01", null));
    expect(state().was?.slots).toEqual({ con_shield_01: "fx_shield_s" });
  });

  test("a shared Loadout isn't one of this browser's Saved Loadouts: Save asks for a name, suggesting the shared one", async () => {
    const { session, state } = setup([shielded]);
    await session.openShareLink(await fragmentFor(sharedOf(shielded)));

    session.save();

    expect(state().naming).toEqual({ suggestedName: "Shielded Courier" });
  });

  test("one shared without a name opens without one, and Save suggests the Ship's", async () => {
    const { session, state } = setup();
    const { name: _name, ...unnamed } = sharedOf(shielded);
    await session.openShareLink(await fragmentFor(unnamed));

    expect(state().opened).toBeNull();
    session.save();
    expect(state().naming).toEqual({ suggestedName: "Swiftwing Courier" });
  });

  test("one that no longer fits opens repaired, with the notice", async () => {
    const { session, state } = setup();

    await session.openShareLink(await fragmentFor(sharedOf(escort)));

    expect(state().notice?.changes).toHaveLength(3);
    expect(state().loadout?.slots).toEqual({ con_weapon_01: "fx_pulse_s" });
    expect(state().opened).toEqual({ name: "Escort" });
  });

  test.each([
    ["a tampered link", "#l=this-is-not-a-loadout", /Share Link is damaged/],
    ["a link from a newer version of the builder", { format: 2, gameData: current, ship: "fx_courier" }, /newer version of the builder/],
    ["a link to a Ship that isn't in the Game Data", { format: 1, gameData: current, ship: "ship_gone" }, /ship_gone/],
  ])("%s shows an error and opens nothing", async (_what, link, error) => {
    const { session, state } = setup();

    expect(await session.openShareLink(typeof link === "string" ? link : await fragmentFor(link))).toBe(true);

    expect(state().message).toEqual({ kind: "error", text: expect.stringMatching(error) });
    expect(state().loadout).toBeNull();
  });

  test("latest wins: picking a Ship while a link is being read keeps the picked Ship", async () => {
    const { session, state } = setup();
    const fragment = await fragmentFor(sharedOf(shielded));

    const reading = session.openShareLink(fragment);
    session.pickShip(ship("fx_bramble"));
    await reading;

    expect(state().loadout?.ship).toBe("fx_bramble");
    expect(state().opened).toBeNull();
  });

  test("latest wins: opening a Saved Loadout while a link is being read keeps the Saved Loadout", async () => {
    const { session, state } = setup([escort]);
    const fragment = await fragmentFor(sharedOf(shielded));

    const reading = session.openShareLink(fragment);
    session.openSaved(escort);
    await reading;

    expect(state().opened).toEqual({ id: escort.id, name: "Escort" });
  });

  test("latest wins: of two links read at once, the later one opens", async () => {
    const { session, state } = setup();
    const first = await fragmentFor(sharedOf(shielded));
    const second = await fragmentFor(sharedOf(savedLoadout({ ship: "fx_bramble", name: "Bramble" })));

    const reading = session.openShareLink(first);
    await session.openShareLink(second);
    await reading;

    expect(state().opened).toEqual({ name: "Bramble" });
  });

  test("a fragment without a link doesn't cancel a link being read", async () => {
    const { session, state } = setup();

    const reading = session.openShareLink(await fragmentFor(sharedOf(shielded)));
    await session.openShareLink("#other=1");
    await reading;

    expect(state().opened).toEqual({ name: "Shielded Courier" });
  });

  test("a Saved Loadout that can't open doesn't cancel a link being read", async () => {
    const { session, state } = setup([relic]);

    const reading = session.openShareLink(await fragmentFor(sharedOf(shielded)));
    session.openSaved(relic);
    await reading;

    expect(state().opened).toEqual({ name: "Shielded Courier" });
  });

  test("a superseded damaged link shows no error", async () => {
    const { session, state } = setup();

    const reading = session.openShareLink("#l=this-is-not-a-loadout");
    session.pickShip(ship("fx_courier"));
    await reading;

    expect(state().message).toBeNull();
  });
});

describe("copying a Share Link", () => {
  test("copies a link to the Loadout, under the name it's open under, that opens it again", async () => {
    const { session, state, copied } = setup([shielded]);
    session.openSaved(shielded);
    session.edit(setSlot(state().loadout!, "con_weapon_01", "fx_cannon_s"));

    await session.copyLink(`${APP}#l=stale`);

    expect(state().message).toEqual({ kind: "status", text: "Link copied to the clipboard." });
    expect(copied).toHaveLength(1);
    const link = new URL(copied[0]!);
    expect(link.origin + link.pathname).toBe(APP);

    const other = setup();
    await other.session.openShareLink(link.hash);
    expect(other.state().opened).toEqual({ name: "Shielded Courier" });
    expect(other.state().loadout?.slots).toEqual({ con_shield_01: "fx_shield_s", con_weapon_01: "fx_cannon_s" });
  });

  test("a link copied from an unsaved Loadout carries no name", async () => {
    const { session, copied } = setup();
    session.pickShip(ship("fx_courier"));

    await session.copyLink(APP);

    const other = setup();
    await other.session.openShareLink(new URL(copied[0]!).hash);
    expect(other.state().opened).toBeNull();
    expect(other.state().loadout?.ship).toBe("fx_courier");
  });

  test("a clipboard that refuses shows an error", async () => {
    const { session, state } = setup(undefined, { clipboardFails: true });
    session.pickShip(ship("fx_courier"));

    await session.copyLink(APP);

    expect(state().message).toEqual({ kind: "error", text: "The link couldn't be copied to the clipboard." });
  });
});

const loadoutFile = (loadouts: unknown[], over: Record<string, unknown> = {}) =>
  new Blob([JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts, ...over })], { type: "application/json" });

describe("importing a Loadout File", () => {
  test("adds its Loadouts, says how many, and shows the list", async () => {
    const { session, state } = setup([shielded]);

    await session.import(loadoutFile([escort, relic]));

    expect(state().message).toEqual({ kind: "status", text: "Imported 2 Loadouts." });
    expect(state().showSaved).toBe(true);
    expect(listedNames(state())).toEqual(["Shielded Courier", "Escort", "Relic"]);
  });

  test("one Loadout is counted in the singular", async () => {
    const { session, state } = setup();

    await session.import(loadoutFile([escort]));

    expect(state().message).toEqual({ kind: "status", text: "Imported 1 Loadout." });
  });

  test("a bad file is rejected in full with its error", async () => {
    const { session, state, storage } = setup([shielded]);
    const before = storage.raw();

    await session.import(loadoutFile([escort], { format: 2 }));

    expect(state().message).toEqual({ kind: "error", text: expect.stringMatching(/newer version of the builder/) });
    expect(state().showSaved).toBe(false);
    expect(storage.raw()).toBe(before);
  });

  test("an import that finishes after a Ship is picked still adds its Loadouts and says so", async () => {
    const { session, state } = setup();

    const importing = session.import(loadoutFile([escort]));
    session.pickShip(ship("fx_courier"));
    await importing;

    expect(state().loadout?.ship).toBe("fx_courier");
    expect(state().message).toEqual({ kind: "status", text: "Imported 1 Loadout." });
    expect(listedNames(state())).toEqual(["Escort"]);
  });

  test("an imported Loadout that no longer fits opens repaired, with the notice", async () => {
    const { session, state } = setup();
    await session.import(loadoutFile([escort]));

    session.openSaved(entry(state(), "Escort").loadout);

    expect(state().notice?.changes).toHaveLength(3);
  });
});

describe("exporting", () => {
  test("Export downloads every readable Saved Loadout as one Loadout File, leaving storage as it was", () => {
    const { session, storage, downloads } = setup([shielded, { name: "half a loadout" }, relic]);
    const before = storage.raw();

    session.exportAll();

    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.fileName).toBe("saved-loadouts.json");
    expect(JSON.parse(downloads[0]!.text)).toEqual({ app: "x4-swi-ship-builder", format: 1, loadouts: [shielded, relic] });
    expect(storage.raw()).toBe(before);
  });

  test("with nothing saved there's nothing to export", () => {
    const { session, state, downloads } = setup();

    session.exportAll();

    expect(downloads).toEqual([]);
    expect(state().message).toEqual({ kind: "error", text: "There are no Saved Loadouts to export." });
  });

  test("a stored value that isn't a list can't be exported", () => {
    const { session, state, downloads } = setup('{"not":"a list"}');

    session.exportAll();

    expect(downloads).toEqual([]);
    expect(state().message).toEqual({ kind: "error", text: expect.stringMatching(/couldn't be read/) });
  });

  test("Export on one Saved Loadout downloads just that one, named after it", () => {
    const { session, downloads } = setup([shielded, escort]);

    session.exportOne(escort);

    expect(downloads[0]!.fileName).toBe("Escort.json");
    expect(JSON.parse(downloads[0]!.text).loadouts).toEqual([escort]);
  });

  test.each([
    ["Freighter: Mk 2/3", "Freighter_ Mk 2_3.json"],
    ['a <b> "c"?', "a _b_ _c_.json"],
  ])("a name with characters file systems refuse (%s) is made safe", (name, fileName) => {
    const { session, downloads } = setup();

    session.exportOne(savedLoadout({ name }));

    expect(downloads[0]!.fileName).toBe(fileName);
  });
});

describe("the state", () => {
  test("stats are worked out again only when the Loadout or the Loaded Loadout changes", () => {
    const { session, state } = setup([shielded]);
    session.openSaved(shielded);
    session.edit(setSlot(state().loadout!, "con_shield_01", null));
    const { stats, wasStats } = state();

    session.toggleSaved();
    session.dismissNotice();

    expect(state().stats).toBe(stats);
    expect(state().wasStats).toBe(wasStats);
  });

  test("subscribers hear every change, until they unsubscribe", () => {
    const { session } = setup();
    let heard = 0;
    const unsubscribe = session.subscribe(() => heard++);

    session.toggleSaved();
    unsubscribe();
    session.toggleSaved();

    expect(heard).toBe(1);
  });
});
