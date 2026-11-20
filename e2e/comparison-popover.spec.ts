import { expect, test, type Locator, type Page } from "@playwright/test";

/** Opens a Ship through the toolbar's picker. */
async function openShip(page: Page, size: "S" | "M" | "L" | "XL", name: string) {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Size" }).selectOption(size);
  await page.getByRole("combobox", { name: "Ship" }).fill(name);
  await page.getByRole("option", { name }).click();
}

/** The Loadout table's row whose first cell names this Slot or Slot Group kind. */
const row = (page: Page, label: string | RegExp) =>
  page
    .getByRole("table", { name: "Loadout" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: label }) });

/** Picks an option from a row's Equipment dropdown. */
async function fit(page: Page, label: string | RegExp, equipment: string) {
  await row(page, label).getByRole("combobox").click();
  await page.getByRole("listbox").getByRole("option", { name: equipment, exact: true }).click();
}

/** Opens a row's Equipment dropdown and hovers one option; returns its comparison popover. */
async function hover(page: Page, label: string | RegExp, equipment: string): Promise<Locator> {
  await row(page, label).getByRole("combobox").click();
  await page.getByRole("listbox").getByRole("option", { name: equipment, exact: true }).hover();
  const popover = page.getByRole("tooltip");
  await expect(popover).toBeVisible();
  return popover;
}

/** A popover line: its figure, value and difference. */
const figure = (popover: Locator, label: string) => popover.getByRole("row", { name: new RegExp(`^${label}`) });

const GREEN = "rgb(111, 220, 140)";
const RED = "rgb(255, 107, 107)";

test("hovering an option on an empty Slot compares it with nothing", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  const popover = await hover(page, /con_weapon_01/, "Zephyr Cannon");

  await expect(popover).toContainText("Zephyr Cannon");
  await expect(figure(popover, "Burst Output").getByRole("cell")).toHaveText(["300 MW", "+300"]);
  await expect(figure(popover, "Sustained Output").getByRole("cell")).toHaveText(["187 MW", "+187"]);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["30,000 Cr", "+30,000"]);
  // More output is better; paying more than nothing is worse.
  await expect(figure(popover, "Burst Output").getByText("+300")).toHaveCSS("color", GREEN);
  await expect(figure(popover, "Price").getByText("+30,000")).toHaveCSS("color", RED);
});

test("hovering an option on a filled Slot shows its differences from the fitted item, coloured", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  const popover = await hover(page, /con_weapon_01/, "Zephyr Cannon");

  await expect(figure(popover, "Burst Output").getByRole("cell")).toHaveText(["300 MW", "−100"]);
  await expect(figure(popover, "Sustained Output").getByRole("cell")).toHaveText(["187 MW", "+6"]);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["30,000 Cr", "+18,000"]);
  await expect(figure(popover, "Burst Output").getByText("−100")).toHaveCSS("color", RED);
  await expect(figure(popover, "Sustained Output").getByText("+6")).toHaveCSS("color", GREEN);
  await expect(figure(popover, "Price").getByText("+18,000")).toHaveCSS("color", RED);

  // A cheaper option's price is better.
  await page.keyboard.press("Escape");
  await fit(page, /con_weapon_01/, "Zephyr Cannon");
  const cheaper = await hover(page, /con_weapon_01/, "Pulse Blaster");
  await expect(figure(cheaper, "Price").getByText("−18,000")).toHaveCSS("color", GREEN);
});

test("the option text itself shows no differences", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await hover(page, /con_weapon_01/, "Zephyr Cannon");

  await expect(page.getByRole("option", { name: "Zephyr Cannon", exact: true })).toHaveText("Zephyr Cannon");
});

test("Slot Group comparisons show one unit", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");
  await fit(page, /Shields.*group_front/, "Bubble Shield M");
  await expect(row(page, /Shields.*group_front/).getByRole("spinbutton")).toHaveValue("2");
  const popover = await hover(page, /Shields.*group_front/, "Bubble Shield M");

  await expect(figure(popover, "Shield Capacity").getByRole("cell")).toHaveText(["5,000 MJ", "±0"]);
  await expect(figure(popover, "Recharge Rate").getByRole("cell")).toHaveText(["300 MW", "±0"]);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["35,000 Cr", "±0"]);
});

test("the popover lists each Seller with its Licence", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  const tube = await hover(page, /con_weapon_01/, "Torpedo Tube");
  await expect(tube.getByRole("listitem")).toHaveText(["Corsair Clans: Fixture Arms Licence (+10)"]);

  await page.keyboard.press("Escape");
  const pulse = await hover(page, /con_weapon_02/, "Pulse Blaster");
  await expect(pulse.getByRole("listitem")).toHaveText([
    "Corsair Clans: no Licence needed",
    "Freight Guild: no Licence needed",
  ]);
});
