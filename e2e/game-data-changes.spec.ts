/**
 * Loadouts made against older Game Data (#44): stored and shared Loadouts
 * that no longer fit the fixture snapshot (SWI "999", X4 "9.99").
 */
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { row } from "./helpers.ts";

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

});

test("a Saved Loadout's Repairs flag is reached by Tab and opens a Tooltip naming what no longer fits", async ({ page }) => {
  await storeRaw(page, [escort]);
  await showSavedLoadouts(page);
  const flag = savedEntry(page, "Escort").getByRole("button", { name: /3 items no longer fit/ });

  for (let presses = 0; presses < 30 && !(await flag.evaluate((el) => el === document.activeElement)); presses++) {
    await page.keyboard.press("Tab");
  }
  await expect(flag).toBeFocused();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Zephyr Cannon in con_weapon_09: dropped");
  await expect(tooltip).toContainText("fx_shield_gone in con_shield_01: dropped");
  await expect(tooltip).toContainText("Glare Flare in consumables: count cut from 9 to 5");

  await page.keyboard.press("Tab");
  await expect(tooltip).toBeHidden();
});
