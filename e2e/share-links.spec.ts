import { expect, test, type Page } from "@playwright/test";
import { fit, pickShip, row, toasts } from "./helpers.ts";

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
  await expect(toasts(page)).toContainText("Link copied");
  const link = await readClipboard(page);
  expect(link).toMatch(/\/#l=[A-Za-z0-9_-]+$/);

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole("combobox", { name: "Ship" })).toHaveValue("Ironback Hauler");
  // The link has done its job, so the fragment is cleared.
  await expect(other).toHaveURL(/\/$/);
  await expect(row(other, /con_shield_01/).getByRole("combobox")).toHaveText(/Bubble Shield M/);
  await expect(row(other, /^Engines/).getByRole("combobox")).toHaveText(/Haul Engine L/);
  await expect(other.getByRole("toolbar")).toContainText("Heavy Freighter");

  // A shared Loadout isn't one of this browser's Saved Loadouts: saving asks for a name, suggesting the shared one.
  await saveButton(other).click();
  await expect(saveDialog(other).getByRole("textbox", { name: "Name" })).toHaveValue("Heavy Freighter");
});

