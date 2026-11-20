import { expect, test, type Page } from "@playwright/test";

/** Opens a Ship through the toolbar's picker. */
async function openShip(page: Page, size: "S" | "M" | "L" | "XL", name: string) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Size" }).selectOption(size);
  await page.getByRole("combobox", { name: "Ship" }).fill(name);
  await page.getByRole("option", { name }).click();
}

const loadoutTable = (page: Page) => page.getByRole("table", { name: "Loadout" });
/** The Loadout table's row whose first cell names this Slot, Slot Group kind or consumable. */
const row = (page: Page, label: string | RegExp) =>
  loadoutTable(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label }) });

/** Picks an option from a row's Equipment dropdown. */
async function fit(page: Page, label: string | RegExp, equipment: string) {
  await row(page, label).getByRole("combobox").click();
  await page.getByRole("listbox").getByRole("option", { name: equipment, exact: true }).click();
}

/** Checks the open dropdown lists exactly these options, in order. */
async function expectOptions(page: Page, names: string[]) {
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(options.nth(i)).toHaveAccessibleName(name);
}

test("a Slot's dropdown lists only its compatible Equipment, sorted by name, with empty first", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const weapon = row(page, /con_weapon_01/);
  await expect(weapon.getByRole("combobox")).toHaveText(/— empty —/);
  await weapon.getByRole("combobox").click();
  await expectOptions(page, ["— empty —", "Dart Launcher", "Pulse Blaster", "Torpedo Tube", "Zephyr Cannon"]);
  await expect(page.getByRole("option", { name: "— empty —" })).toHaveAttribute("aria-selected", "true");
});

test("filling a Slot shows its Equipment, quantity, key value and average price, and it can be emptied", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await fit(page, /con_weapon_01/, "Zephyr Cannon");
  const weapon = row(page, /con_weapon_01/);
  await expect(weapon.getByRole("combobox")).toHaveText(/Zephyr Cannon/);
  await expect(weapon.getByRole("cell")).toHaveText([/Zephyr Cannon/, "1", "300 dmg/shot", "30,000 Cr"]);

  // The fitted item is ticked.
  await weapon.getByRole("combobox").click();
  await expect(page.getByRole("option", { name: "Zephyr Cannon" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("option", { name: "Zephyr Cannon" })).toContainText("✓");
  await page.getByRole("option", { name: "— empty —" }).click();

  await expect(weapon.getByRole("combobox")).toHaveText(/— empty —/);
  await expect(weapon.getByRole("cell")).toHaveText([/— empty —/, "", "", ""]);
  // The other Slots were never touched.
  await expect(row(page, /con_weapon_02/).getByRole("combobox")).toHaveText(/— empty —/);
});

test("a Slot with one compatible item still has a dropdown", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await fit(page, /con_shield_01/, "Bubble Shield S");
  await expect(row(page, /con_shield_01/).getByRole("cell").nth(2)).toHaveText("1,000 MJ");
  await fit(page, /con_shield_01/, "— empty —");
  await expect(row(page, /con_shield_01/).getByRole("combobox")).toHaveText(/— empty —/);
});

test("picking another Ship opens it as an Empty Loadout", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");

  await page.getByRole("combobox", { name: "Ship" }).fill("Bramble");
  await page.keyboard.press("Enter");

  await expect(row(page, /con_weapon_01/).getByRole("combobox")).toHaveText(/— empty —/);
});
