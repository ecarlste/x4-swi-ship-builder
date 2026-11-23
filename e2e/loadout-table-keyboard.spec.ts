import { expect, test } from "@playwright/test";
import { loadoutTable, openShip, row } from "./helpers.ts";

// The Loadout table by keyboard alone. Each test focuses one control (as Tab would reach it) and
// then uses only the keys.

test("Equipment is fitted from the Loadout table by keyboard", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  const weapon = row(page, /con_weapon_01/).getByRole("combobox");
  await weapon.focus();

  // The arrow keys open the list on the fitted option, then move through it; Enter fits.
  await page.keyboard.press("ArrowDown");
  const option = (name: string) => page.getByRole("listbox").getByRole("option", { name, exact: true });
  await expect(option("— empty —")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(option("Dart Launcher")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(option("Pulse Blaster")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(weapon).toHaveText(/Pulse Blaster/);
  await expect(weapon).toBeFocused();

  // Enter opens it too; a typed letter jumps to the next option starting with it.
  await page.keyboard.press("Enter");
  await expect(option("Pulse Blaster")).toBeFocused();
  await page.keyboard.press("z");
  await expect(option("Zephyr Cannon")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(weapon).toHaveText(/Zephyr Cannon/);
  await expect(row(page, /con_weapon_01/).getByRole("cell")).toHaveText([/Zephyr Cannon/, "1", "300 dmg/shot", "30,000 Cr"]);

  // Space opens it, and Escape closes it without changing what's fitted.
  await page.keyboard.press(" ");
  await expect(option("Zephyr Cannon")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(option("Torpedo Tube")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(weapon).toHaveText(/Zephyr Cannon/);
  await expect(weapon).toBeFocused();
});

test("software is toggled with Space", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  const scanner = page.getByRole("checkbox", { name: "Long Scanner" });
  const price = loadoutTable(page).getByRole("row").filter({ has: scanner }).getByRole("cell").nth(3);
  await scanner.focus();

  await page.keyboard.press(" ");
  await expect(scanner).toBeChecked();
  await expect(price).toHaveText("11,000 Cr");
  await page.keyboard.press(" ");
  await expect(scanner).not.toBeChecked();
  await expect(price).toHaveText("");
});

test("a count is set with the arrow keys on its slider or by typing, and clamps over its limit", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  const flares = page.getByRole("spinbutton", { name: "Glare Flare count" });
  const slider = page.getByRole("slider", { name: "Glare Flare count" });
  const cells = loadoutTable(page).getByRole("row").filter({ has: flares }).getByRole("cell");
  await slider.focus();

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(flares).toHaveValue("2");
  await expect(cells.nth(3)).toHaveText("120 Cr");
  await page.keyboard.press("ArrowDown");
  await expect(flares).toHaveValue("1");

  await page.keyboard.press("Tab");
  await expect(flares).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("9");
  await page.keyboard.press("Enter");
  await expect(flares).toHaveValue("5");
  await expect(cells.nth(3)).toHaveText("300 Cr");
});

test("a row mark is reached by Tab and opens its Tooltip on focus", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  // The Thruster's mandatory mark sits in its row header, just before its Equipment control.
  await row(page, "Thruster").getByRole("combobox").focus();

  await page.keyboard.press("Shift+Tab");
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("Mandatory upgrade missing");

  // Moving on closes it.
  await page.keyboard.press("Tab");
  await expect(tooltip).toBeHidden();
});
