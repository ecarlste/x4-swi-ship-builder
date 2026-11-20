import { expect, test, type Page } from "@playwright/test";

/** Opens a Ship through the toolbar's picker. */
async function openShip(page: Page, size: "S" | "M" | "L" | "XL", name: string) {
  await page.getByRole("combobox", { name: "Size" }).selectOption(size);
  await page.getByRole("combobox", { name: "Ship" }).fill(name);
  await page.getByRole("option", { name }).click();
}

const loadoutTable = (page: Page) => page.getByRole("table", { name: "Loadout" });
const row = (page: Page, label: string | RegExp) =>
  loadoutTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label }) });

async function fit(page: Page, label: string | RegExp, equipment: string) {
  await row(page, label).getByRole("combobox").click();
  await page.getByRole("listbox").getByRole("option", { name: equipment, exact: true }).click();
}

const copyLink = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Copy link" });
const saveButton = (page: Page) => page.getByRole("toolbar").getByRole("button", { name: "Save", exact: true });
const saveDialog = (page: Page) => page.getByRole("dialog", { name: "Save Loadout" });

/** A Share Link fragment carrying this value, built in the page the way the app builds one. */
async function fragmentFor(page: Page, value: unknown) {
  return page.evaluate(async (json) => {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const base64url = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    return `#l=${base64url}`;
  }, JSON.stringify(value));
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
});

test("Copy link is disabled until a Ship is picked", async ({ page }) => {
  await expect(copyLink(page)).toBeDisabled();
  await openShip(page, "S", "Swiftwing Courier");
  await expect(copyLink(page)).toBeEnabled();
});

test("a copied link opens the same Loadout, with its name, in a new page", async ({ context, page }) => {
  await openShip(page, "L", "Ironback Hauler");
  await fit(page, /con_shield_01/, "Bubble Shield M");
  await saveButton(page).click();
  await saveDialog(page).getByRole("textbox", { name: "Name" }).fill("Heavy Freighter");
  await saveDialog(page).getByRole("button", { name: "Save" }).click();

  await copyLink(page).click();
  await expect(page.getByRole("status")).toContainText("Link copied");
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/#l=[A-Za-z0-9_-]+$/);

  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole("combobox", { name: "Ship" })).toHaveValue("Ironback Hauler");
  await expect(row(other, /con_shield_01/).getByRole("combobox")).toHaveText(/Bubble Shield M/);
  await expect(other.getByRole("toolbar")).toContainText("Heavy Freighter");

  // A shared Loadout isn't one of this browser's Saved Loadouts: saving asks for a name, suggesting the shared one.
  await saveButton(other).click();
  await expect(saveDialog(other).getByRole("textbox", { name: "Name" })).toHaveValue("Heavy Freighter");
});

test("a link copied from an unsaved Loadout opens without a name", async ({ context, page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Zephyr Cannon");
  await copyLink(page).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());

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

  await openShip(page, "S", "Swiftwing Courier");
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
