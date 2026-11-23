import { expect, test, type Locator, type Page } from "@playwright/test";
import { fit, openShip, row, tokenColour } from "./helpers.ts";

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


test("hovering an option on an empty Slot compares it with nothing", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  const popover = await hover(page, /con_weapon_01/, "Zephyr Cannon");

  await expect(popover).toContainText("Zephyr Cannon");
  await expect(figure(popover, "Burst Output").getByRole("cell")).toHaveText(["300 MW", "+300"]);
  await expect(figure(popover, "Sustained Output").getByRole("cell")).toHaveText(["187 MW", "+187"]);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["30,000 Cr", "+30,000"]);
  // More output is better; paying more than nothing is worse.
  await expect(figure(popover, "Burst Output").getByText("+300")).toHaveCSS("color", await tokenColour(page, "success"));
  await expect(figure(popover, "Price").getByText("+30,000")).toHaveCSS("color", await tokenColour(page, "destructive"));
});

test("hovering an option on a filled Slot shows its differences from the fitted item, coloured", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  const popover = await hover(page, /con_weapon_01/, "Zephyr Cannon");

  await expect(figure(popover, "Burst Output").getByRole("cell")).toHaveText(["300 MW", "−100"]);
  await expect(figure(popover, "Sustained Output").getByRole("cell")).toHaveText(["187 MW", "+6"]);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["30,000 Cr", "+18,000"]);
  await expect(figure(popover, "Burst Output").getByText("−100")).toHaveCSS("color", await tokenColour(page, "destructive"));
  await expect(figure(popover, "Sustained Output").getByText("+6")).toHaveCSS("color", await tokenColour(page, "success"));
  await expect(figure(popover, "Price").getByText("+18,000")).toHaveCSS("color", await tokenColour(page, "destructive"));

  // A cheaper option's price is better.
  await page.keyboard.press("Escape");
  await fit(page, /con_weapon_01/, "Zephyr Cannon");
  const cheaper = await hover(page, /con_weapon_01/, "Pulse Blaster");
  await expect(figure(cheaper, "Price").getByText("−18,000")).toHaveCSS("color", await tokenColour(page, "success"));
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

test("the Engines row compares one engine, though it fits all of the Ship's engines (#50)", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");
  const popover = await hover(page, /^Engines/, "Haul Engine L");

  await expect(figure(popover, "Thrust").getByRole("cell")).toHaveText(["30,000 kN", "+30,000"]);
  await expect(figure(popover, "Travel Thrust").getByRole("cell")).toHaveText(["240,000 kN", "+240,000"]);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["220,000 Cr", "+220,000"]);
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

test("a hovered launcher shows a row per missile, best first, then No missile, and marks the loaded one (#65)", async ({
  page,
}) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await fit(page, /con_weapon_02/, "Torpedo Tube");
  await page.getByRole("spinbutton", { name: "Ion Torpedo count" }).fill("3");
  await page.getByRole("spinbutton", { name: "Ion Torpedo count" }).press("Enter");
  const popover = await hover(page, /con_weapon_01/, "Torpedo Tube");

  // Each against the fitted Pulse Blaster (400 / 181); the Heavy Torpedo outfires the loaded Ion Torpedo.
  const missiles = popover.getByRole("table", { name: "Missiles" });
  await expect(missiles.getByRole("columnheader")).toHaveText(["Missile", "Burst", "Sustained"]);
  await expect(missiles.getByRole("rowheader")).toHaveText(["Heavy Torpedo", "Ion Torpedo ◂ loaded", "No missile"]);
  await expect(figure(missiles, "Heavy Torpedo").getByRole("cell")).toHaveText(["833 MW", "+433", "833 MW", "+652"]);
  await expect(figure(missiles, "Ion Torpedo").getByRole("cell")).toHaveText(["166 MW", "−234", "166 MW", "−15"]);
  await expect(figure(missiles, "No missile").getByRole("cell")).toHaveText(["0 MW", "−400", "0 MW", "−181"]);
  await expect(figure(missiles, "Heavy Torpedo").getByText("+433")).toHaveCSS("color", await tokenColour(page, "success"));
  await expect(figure(missiles, "No missile").getByText("−400")).toHaveCSS("color", await tokenColour(page, "destructive"));
  // No one-pair Burst / Sustained rows; the price still shows.
  await expect(figure(popover, "Burst Output")).toHaveCount(0);
  await expect(figure(popover, "Price").getByRole("cell")).toHaveText(["24,000 Cr", "+12,000"]);
});

test("with nothing compatible loaded, No missile is the loaded row (#65)", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  const popover = await hover(page, /con_weapon_01/, "Torpedo Tube");

  await expect(popover.getByRole("table", { name: "Missiles" }).getByRole("rowheader")).toHaveText([
    "Heavy Torpedo",
    "Ion Torpedo",
    "No missile ◂ loaded",
  ]);
});

test("arrowing through an open Equipment control moves the popover to each focused option", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await row(page, /con_weapon_01/).getByRole("combobox").focus();
  const option = (name: string) => page.getByRole("listbox").getByRole("option", { name, exact: true });
  const popover = page.getByRole("tooltip");

  // Opening lands on the fitted option, which compares with itself.
  await page.keyboard.press("ArrowDown");
  await expect(option("Pulse Blaster")).toBeFocused();
  await expect(popover).toContainText("Pulse Blaster");
  await expect(figure(popover, "Burst Output").getByRole("cell")).toHaveText(["400 MW", "±0"]);

  await page.keyboard.press("ArrowDown");
  await expect(option("Torpedo Tube")).toBeFocused();
  await expect(popover).toContainText("Torpedo Tube");
  await expect(option("Torpedo Tube")).toHaveAccessibleDescription(/Torpedo Tube/);

  await page.keyboard.press("ArrowDown");
  await expect(option("Zephyr Cannon")).toBeFocused();
  await expect(popover).toContainText("Zephyr Cannon");
  await expect(figure(popover, "Burst Output").getByRole("cell")).toHaveText(["300 MW", "−100"]);
  await expect(figure(popover, "Burst Output").getByText("−100")).toHaveCSS("color", await tokenColour(page, "destructive"));
  await expect(option("Zephyr Cannon")).toHaveAccessibleDescription(/Zephyr Cannon/);
  await expect(option("Torpedo Tube")).not.toHaveAttribute("aria-describedby");

  // "— empty —" has nothing to compare, so the popover goes.
  await page.keyboard.press("Home");
  await expect(option("— empty —")).toBeFocused();
  await expect(popover).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
});
