import { expect, test, type Page } from "@playwright/test";
import { fit, fragmentFor, loadoutTable, pickShip, row } from "./helpers.ts";

const copyLink = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Copy link" });
const saveButton = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Save", exact: true });
const saveDialog = (page: Page) => page.getByRole("dialog", { name: "Save Loadout" });

/** What the page's clipboard holds. (A string expression, since the e2e tsconfig has no DOM types.) */
const readClipboard = (page: Page) => page.evaluate<string>("navigator.clipboard.readText()");

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
});

test("Copy link is disabled until a Ship is picked", async ({ page }) => {
  await expect(copyLink(page)).toBeDisabled();
  await pickShip(page, "S", "Swiftwing Courier");
  await expect(copyLink(page)).toBeEnabled();
});

test("a copied link opens the same Loadout, with its name, in a new page", async ({ context, page }) => {
  await pickShip(page, "L", "Ironback Hauler");
  await fit(page, /con_shield_01/, "Bubble Shield M");
  await fit(page, /^Engines/, "Haul Engine L");
  await saveButton(page).click();
  await saveDialog(page).getByRole("textbox", { name: "Name" }).fill("Heavy Freighter");
  await saveDialog(page).getByRole("button", { name: "Save" }).click();

  await copyLink(page).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  const link = await readClipboard(page);
  expect(link).toMatch(/\/#l=[A-Za-z0-9_-]+$/);

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole("combobox", { name: "Ship" })).toHaveValue("Ironback Hauler");
  await expect(row(other, /con_shield_01/).getByRole("combobox")).toHaveText(/Bubble Shield M/);
  await expect(row(other, /^Engines/).getByRole("combobox")).toHaveText(/Haul Engine L/);
  await expect(other.getByRole("toolbar")).toContainText("Heavy Freighter");

  // A shared Loadout isn't one of this browser's Saved Loadouts: saving asks for a name, suggesting the shared one.
  await saveButton(other).click();
  await expect(saveDialog(other).getByRole("textbox", { name: "Name" })).toHaveValue("Heavy Freighter");
});

test("a link copied from an unsaved Loadout opens without a name", async ({ context, page }) => {
  await pickShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Zephyr Cannon");
  await copyLink(page).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  const link = await readClipboard(page);

  const other = await context.newPage();
  await other.goto(link);
  await expect(row(other, /con_weapon_01/).getByRole("combobox")).toHaveText(/Zephyr Cannon/);
  await saveButton(other).click();
  await expect(saveDialog(other).getByRole("textbox", { name: "Name" })).toHaveValue("Swiftwing Courier");
});

test("a tampered link shows an error and leaves the app usable", async ({ page }) => {
  await page.goto("/#l=this-is-not-a-loadout");
  await expect(page.getByRole("alert")).toContainText("Share Link is damaged");
  await expect(loadoutTable(page)).toBeHidden();

  await pickShip(page, "S", "Swiftwing Courier");
  await expect(loadoutTable(page)).toBeVisible();
});

test("a link from a newer version of the builder is rejected", async ({ page }) => {
  const fragment = await fragmentFor(page, {
    format: 2,
    gameData: { swi: "999", x4: "9.99" },
    ship: "fx_courier",
  });
  await page.goto(`/${fragment}`);
  await expect(page.getByRole("alert")).toContainText("made by a newer version of the builder");
  await expect(loadoutTable(page)).toBeHidden();
});

test("a link to a Ship that isn't in the Game Data shows an error", async ({ page }) => {
  const fragment = await fragmentFor(page, {
    format: 1,
    gameData: { swi: "999", x4: "9.99" },
    ship: "ship_gone",
  });
  await page.goto(`/${fragment}`);
  await expect(page.getByRole("alert")).toContainText("ship_gone");
  await expect(loadoutTable(page)).toBeHidden();
});
