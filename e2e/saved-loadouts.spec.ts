import { expect, test, type Page } from "@playwright/test";
import { fit, loadoutTable, pickShip, row } from "./helpers.ts";

const KEY = "swi-builder:saved-loadouts:v1";

const saveButton = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Save", exact: true });
const saveDialog = (page: Page) => page.getByRole("dialog", { name: "Save Loadout" });
const savedList = (page: Page) => page.getByRole("region", { name: "Saved Loadouts" });
const savedEntry = (page: Page, name: string | RegExp) => savedList(page).getByRole("listitem").filter({ hasText: name });

/** Saves for the first time, under this name. */
async function saveAs(page: Page, name: string) {
  await saveButton(page).click();
  await saveDialog(page).getByRole("textbox", { name: "Name" }).fill(name);
  await saveDialog(page).getByRole("button", { name: "Save" }).click();
  await expect(saveDialog(page)).toBeHidden();
}

async function showSavedLoadouts(page: Page) {
  await page.getByRole("button", { name: "Saved Loadouts" }).click();
  await expect(savedList(page)).toBeVisible();
}

/** Puts this raw value in storage, then reloads so the app reads it. */
async function storeRaw(page: Page, raw: string) {
  await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [KEY, raw]);
  await page.reload();
}

const savedLoadout = (over: Record<string, unknown> = {}) => ({
  format: 1,
  gameData: { swi: "999", x4: "9.99" },
  ship: "fx_courier",
  id: "6f1c1f2e-5d2b-4c1a-9a3e-0b7f6c2d9e11",
  name: "Escort",
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  ...over,
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a first save asks for a name, suggesting the Ship's, and the Loadout reopens after a reload", async ({ page }) => {
  await pickShip(page, "L", "Ironback Hauler");
  await fit(page, /con_shield_01/, "Bubble Shield M");

  await saveButton(page).click();
  const name = saveDialog(page).getByRole("textbox", { name: "Name" });
  await expect(name).toHaveValue("Ironback Hauler");
  await name.fill("Heavy Freighter");
  await saveDialog(page).getByRole("button", { name: "Save" }).click();
  await expect(saveDialog(page)).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Heavy Freighter");

  await page.reload();
  await expect(loadoutTable(page)).toBeHidden();
  await showSavedLoadouts(page);
  const entry = savedEntry(page, "Heavy Freighter");
  await expect(entry).toContainText("Ironback Hauler");
  await entry.getByRole("button", { name: "Open" }).click();

  await expect(page.getByRole("combobox", { name: "Ship" })).toHaveValue("Ironback Hauler");
  await expect(page.getByRole("combobox", { name: "Size" })).toHaveValue("l");
  await expect(row(page, /con_shield_01/).getByRole("combobox")).toHaveText(/Bubble Shield M/);
});

test("deleting the open Saved Loadout keeps its name, and Save asks for a name, suggesting it", async ({ page }) => {
  await pickShip(page, "S", "Swiftwing Courier");
  await saveAs(page, "Courier A");

  await showSavedLoadouts(page);
  await savedEntry(page, "Courier A").getByRole("button", { name: "Delete" }).click();
  await expect(savedList(page).getByRole("listitem")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe("[]");

  await expect(page.getByRole("toolbar")).toContainText("Courier A");
  await saveButton(page).click();
  await expect(saveDialog(page).getByRole("textbox", { name: "Name" })).toHaveValue("Courier A");
});

test("a damaged entry is Unreadable with Delete only, and the others still open", async ({ page }) => {
  await storeRaw(page, JSON.stringify([savedLoadout(), { name: "half a loadout" }, savedLoadout({ format: 2, id: "11111111-2222-4333-8444-555555555555", name: "Future" })]));

  await showSavedLoadouts(page);
  const items = savedList(page).getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Escort");
  await expect(items.nth(1)).toContainText("Unreadable");
  await expect(items.nth(1).getByRole("button")).toHaveText(["Delete"]);
  await expect(items.nth(2)).toContainText("Unreadable");
  await expect(items.nth(2)).toContainText("made by a newer version of the builder");
  await expect(items.nth(2).getByRole("button")).toHaveText(["Delete"]);

  await items.nth(1).getByRole("button", { name: "Delete" }).click();
  await expect(items).toHaveCount(2);
  await items.nth(0).getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("combobox", { name: "Ship" })).toHaveValue("Swiftwing Courier");
});

test("a stored value that isn't a list shows its error in the list", async ({ page }) => {
  await storeRaw(page, '{"not":"a list"}');

  await showSavedLoadouts(page);
  await expect(savedList(page).getByRole("alert")).toContainText("couldn't be read");
  await expect(savedList(page).getByRole("listitem")).toHaveCount(0);
});
