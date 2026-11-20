/**
 * Loadouts made against older Game Data (#44): stored and shared Loadouts
 * that no longer fit the fixture snapshot (SWI "999", X4 "9.99").
 */
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { fragmentFor, row } from "./helpers.ts";

const KEY = "swi-builder:saved-loadouts:v1";

const toolbarButton = (page: Page, name: string) =>
  page.getByRole("toolbar").getByRole("button", { name, exact: true });
const savedList = (page: Page) => page.getByRole("region", { name: "Saved Loadouts" });
const savedEntry = (page: Page, name: string | RegExp) => savedList(page).getByRole("listitem").filter({ hasText: name });
const notice = (page: Page) => page.getByRole("region", { name: "This Loadout changed with the Game Data" });

async function showSavedLoadouts(page: Page) {
  await toolbarButton(page, "Saved Loadouts").click();
  await expect(savedList(page)).toBeVisible();
}

const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), KEY);

/** Puts these values in storage, then reloads so the app reads them. */
async function storeRaw(page: Page, value: unknown) {
  await page.evaluate(([key, raw]) => localStorage.setItem(key!, raw!), [KEY, JSON.stringify(value)]);
  await page.reload();
}

const older = { swi: "091", x4: "8.00" };

const savedLoadout = (over: Record<string, unknown> = {}) => ({
  format: 1,
  gameData: older,
  ship: "fx_courier",
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  ...over,
});

/** Three entries no longer fit: a gone Slot, gone Equipment, and a count over capacity. */
const escort = savedLoadout({
  slots: { con_weapon_01: "fx_pulse_s", con_weapon_09: "fx_cannon_s", con_shield_01: "fx_shield_gone" },
  consumables: { fx_flare: 9 },
});
/** Everything still fits; only the versions differ. */
const patrol = savedLoadout({
  id: "11111111-2222-4333-8444-555555555555",
  name: "Patrol",
  slots: { con_weapon_01: "fx_pulse_s" },
});
/** Its Ship is gone. */
const relic = savedLoadout({
  id: "22222222-3333-4444-8555-666666666666",
  name: "Relic",
  ship: "fx_ship_gone",
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("the Saved Loadouts list", () => {
  test("flags a Loadout that will change with a count and a tooltip naming what no longer fits", async ({ page }) => {
    await storeRaw(page, [escort, patrol]);
    await showSavedLoadouts(page);

    const flag = savedEntry(page, "Escort").getByText("⚠ 3 items no longer fit");
    await expect(flag).toBeVisible();
    await expect(flag).toHaveAttribute("title", /Zephyr Cannon in con_weapon_09: dropped/);
    await expect(flag).toHaveAttribute("title", /fx_shield_gone in con_shield_01: dropped/);
    await expect(flag).toHaveAttribute("title", /Glare Flare in consumables: count cut from 9 to 5/);

    // A version change on its own isn't shown.
    await expect(savedEntry(page, "Patrol")).not.toContainText("⚠");
  });

  test("shows a Loadout whose Ship is gone as Unavailable, with Delete and Export only", async ({ page }) => {
    await storeRaw(page, [relic, patrol]);
    await showSavedLoadouts(page);

    const entry = savedEntry(page, "Relic");
    await expect(entry).toContainText("Ship no longer in Game Data");
    await expect(entry).toContainText("fx_ship_gone");
    await expect(entry.getByRole("button")).toHaveText(["Export", "Delete"]);

    const download = page.waitForEvent("download");
    await entry.getByRole("button", { name: "Export" }).click();
    const file = await download;
    expect(JSON.parse(await readFile((await file.path())!, "utf8")).loadouts).toEqual([relic]);

    await entry.getByRole("button", { name: "Delete" }).click();
    await expect(savedList(page).getByRole("listitem")).toHaveText([/Patrol/]);
  });
});

test.describe("opening a Loadout that changes", () => {
  test("a Saved Loadout opens repaired, with a dismissable notice, and the stored copy is left alone", async ({ page }) => {
    await storeRaw(page, [escort]);
    const before = await stored(page);
    await showSavedLoadouts(page);
    await savedEntry(page, "Escort").getByRole("button", { name: "Open" }).click();

    await expect(notice(page)).toContainText("SWI 091 · X4 8.00");
    await expect(notice(page)).toContainText("SWI 999 · X4 9.99");
    await expect(notice(page).getByRole("listitem")).toHaveText([
      /Zephyr Cannon in con_weapon_09: dropped/,
      /fx_shield_gone in con_shield_01: dropped/,
      /Glare Flare in consumables: count cut from 9 to 5/,
    ]);
    await expect(row(page, /con_weapon_01/).getByRole("combobox")).toHaveText(/Pulse Blaster/);
    await expect(row(page, /con_shield_01/).getByRole("combobox")).toHaveText(/empty/);

    // The repaired Loadout is the snapshot, so nothing shows as changed since loading.
    await expect(page.getByText(/was:/)).toHaveCount(0);
    expect(await stored(page)).toBe(before);

    await notice(page).getByRole("button", { name: "Dismiss" }).click();
    await expect(notice(page)).toBeHidden();
  });

  test("Save writes the repaired version with the new versions, and clears the ⚠", async ({ page }) => {
    await storeRaw(page, [escort]);
    await showSavedLoadouts(page);
    await savedEntry(page, "Escort").getByRole("button", { name: "Open" }).click();
    await expect(notice(page)).toBeVisible();

    await expect(toolbarButton(page, "Save")).toBeEnabled();
    await toolbarButton(page, "Save").click();
    await expect(page.getByRole("status")).toContainText("Saved “Escort”");

    const [saved] = JSON.parse((await stored(page))!) as Record<string, unknown>[];
    expect(saved).toMatchObject({
      id: escort.id,
      gameData: { swi: "999", x4: "9.99" },
      slots: { con_weapon_01: "fx_pulse_s" },
      consumables: { fx_flare: 5 },
    });

    await showSavedLoadouts(page);
    await expect(savedEntry(page, "Escort")).not.toContainText("⚠");
  });

  test("a Saved Loadout that only changed version opens without a notice", async ({ page }) => {
    await storeRaw(page, [patrol]);
    await showSavedLoadouts(page);
    await savedEntry(page, "Patrol").getByRole("button", { name: "Open" }).click();
    await expect(row(page, /con_weapon_01/).getByRole("combobox")).toHaveText(/Pulse Blaster/);
    await expect(notice(page)).toBeHidden();
  });

  test("a Share Link opens repaired, with the notice", async ({ page }) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...shared } = escort;
    await page.goto(`/${await fragmentFor(page, shared)}`);

    await expect(notice(page).getByRole("listitem")).toHaveCount(3);
    await expect(row(page, /con_weapon_01/).getByRole("combobox")).toHaveText(/Pulse Blaster/);
    await expect(page.getByRole("toolbar")).toContainText("Escort");
  });

  test("Crew over the Ship's crew capacity opens cut to fit, service crew first, with the cuts in the notice", async ({ page }) => {
    // The Swiftwing Courier holds 1 Crew.
    const { id: _id, createdAt: _c, updatedAt: _u, ...shared } = savedLoadout({ crew: { service: 1, marines: 2 } });
    await page.goto(`/${await fragmentFor(page, shared)}`);

    await expect(notice(page).getByRole("listitem")).toHaveText([
      "Service crew in crew: count cut from 1 to 0",
      "Marines in crew: count cut from 2 to 1",
    ]);
    await expect(page.getByRole("spinbutton", { name: "Service crew count" })).toHaveValue("0");
    await expect(page.getByRole("spinbutton", { name: "Marines count" })).toHaveValue("1");
    // The repaired Loadout is the snapshot, so nothing shows as changed since loading.
    await expect(page.getByText(/was:/)).toHaveCount(0);
  });

  test("Crew on a Ship with no crew capacity opens with all of it cut, and no Crew section", async ({ page }) => {
    // The Needle Striker holds no Crew, only its Captain.
    const { id: _id, createdAt: _c, updatedAt: _u, ...shared } = savedLoadout({
      ship: "fx_needle",
      crew: { service: 1, marines: 2 },
    });
    await page.goto(`/${await fragmentFor(page, shared)}`);

    await expect(notice(page).getByRole("listitem")).toHaveText([
      "Service crew in crew: count cut from 1 to 0",
      "Marines in crew: count cut from 2 to 0",
    ]);
    await expect(page.getByRole("spinbutton", { name: "Service crew count" })).toHaveCount(0);
    await expect(page.getByRole("spinbutton", { name: "Marines count" })).toHaveCount(0);
  });

  test("an imported Loadout opens repaired, with the notice", async ({ page }) => {
    const chooser = page.waitForEvent("filechooser");
    await toolbarButton(page, "Import").click();
    await (await chooser).setFiles({
      name: "loadouts.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ app: "x4-swi-ship-builder", format: 1, loadouts: [escort] })),
    });
    await expect(page.getByRole("status")).toContainText("Imported 1 Loadout");

    await expect(savedEntry(page, "Escort")).toContainText("⚠ 3 items no longer fit");
    await savedEntry(page, "Escort").getByRole("button", { name: "Open" }).click();
    await expect(notice(page).getByRole("listitem")).toHaveCount(3);
  });
});
