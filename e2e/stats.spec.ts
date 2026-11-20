import { expect, test, type Page } from "@playwright/test";

/** Opens a Ship through the toolbar's picker. */
async function openShip(page: Page, size: "S" | "M" | "L" | "XL", name: string) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Size" }).selectOption(size);
  await page.getByRole("combobox", { name: "Ship" }).fill(name);
  await page.getByRole("option", { name }).click();
}

/** Picks an option from a Loadout table row's Equipment dropdown. */
async function fit(page: Page, label: string | RegExp, equipment: string) {
  await page
    .getByRole("table", { name: "Loadout" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label }) })
    .getByRole("combobox")
    .click();
  await page.getByRole("listbox").getByRole("option", { name: equipment, exact: true }).click();
}

const stats = (page: Page) => page.getByRole("complementary", { name: "Stats" });
/** The value cell of the first Stats row with this label. */
const stat = (page: Page, label: string) =>
  stats(page)
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label, exact: true }) })
    .first()
    .getByRole("cell");

test("an Empty Loadout shows the Ship's own stats and zeros for what isn't fitted", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await expect(stat(page, "Hull (MJ)")).toHaveText("3,000");
  await expect(stat(page, "Shield (MJ)")).toHaveText("0");
  await expect(stat(page, "Recharge Delay (s)")).toHaveText("0.00");
  await expect(stat(page, "Avg. Group Shield (MJ)")).toHaveText("0");
  await expect(stat(page, "Radar Range (km)")).toHaveText("20");
  await expect(stat(page, "Cargo (m³)")).toHaveText("50");
  await expect(stat(page, "Crew")).toHaveText("2");
  await expect(stat(page, "Missiles")).toHaveText("10");
  await expect(stat(page, "Countermeasures")).toHaveText("5");

  const price = stats(page).getByRole("region", { name: "Price" });
  await expect(price).toContainText("100,000 Cr");
  await expect(price).toContainText("80,000 – 120,000 Cr");
});

test("the Stats panel updates as equipment changes", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await fit(page, /con_shield_01/, "Bubble Shield S");
  await expect(stat(page, "Shield (MJ)")).toHaveText("1,000");
  await expect(stat(page, "Recharge Rate (MW)")).toHaveText("100");
  await expect(stat(page, "Recharge Delay (s)")).toHaveText("2.00");
  await expect(stats(page).getByRole("region", { name: "Price" })).toContainText("109,000 Cr");

  await fit(page, /con_shield_01/, "— empty —");
  await expect(stat(page, "Shield (MJ)")).toHaveText("0");
  await expect(stats(page).getByRole("region", { name: "Price" })).toContainText("100,000 Cr");
});

test("an L Ship's group shields show in the Avg. Group Shield rows, not the main Shield row", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  // Picking Equipment fills both of the group's Slots: 2 × 5,000 MJ, 2 × 300 MW.
  await fit(page, /Shields group_front/, "Bubble Shield M");

  await expect(stat(page, "Shield (MJ)")).toHaveText("0");
  await expect(stat(page, "Avg. Group Shield (MJ)")).toHaveText("10,000");
  await expect(stat(page, "Recharge Rate (MW)")).toHaveText("0");
});
