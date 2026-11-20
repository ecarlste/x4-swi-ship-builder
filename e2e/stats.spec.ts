import { expect, test, type Page } from "@playwright/test";
import { fit, openShip } from "./helpers.ts";

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
  await expect(stat(page, "Radar Range (km)")).toHaveText("20");
  await expect(stat(page, "Container Storage (m³)")).toHaveText("50");
  await expect(stat(page, "Crew")).toHaveText("2");
  await expect(stat(page, "Missiles")).toHaveText("10");
  await expect(stat(page, "Countermeasures")).toHaveText("5");

  const price = stats(page).getByRole("region", { name: "Price" });
  await expect(price).toContainText("100,000 Cr");
  await expect(price).toContainText("80,000 – 120,000 Cr");
  await expect(price.getByText("Estimate", { exact: true })).toBeVisible();
});

test("the Stats panel has a visible Stats heading", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await expect(stats(page).getByRole("heading", { name: "Stats", exact: true })).toBeVisible();
  await expect(stats(page).getByRole("table", { name: "Stats" })).toBeVisible();
});

test("an S Ship has no Avg. Group Shield rows, and only its own cargo type", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  await expect(stats(page).getByRole("rowheader", { name: "Avg. Group Shield (MJ)" })).toHaveCount(0);
  await expect(stats(page).getByRole("rowheader", { name: /Storage/ })).toHaveText(["Container Storage (m³)"]);
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

test("weapons fill the burst and sustained weapon output rows", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");

  // Pulse Blaster: 100 × 4/s = 400 burst; overheats in 5 s, cools in 1 + 5 s.
  await fit(page, /con_weapon_01/, "Pulse Blaster");
  await expect(stat(page, "Burst Weapon Output (MW)")).toHaveText("400");
  await expect(stat(page, "Sustained Weapon Output (MW)")).toHaveText("181");
});

test("Avg. Turret Output averages Slot Group turrets over six directions, with the game's tooltip", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  // 4 Flak Turrets: (80 + 10) × 2 barrels × 20 / (5 + 20 / 3) per s each, / 6.
  await fit(page, /Turrets group_front/, "Flak Turret");

  const row = stats(page).getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Avg. Turret Output (MW)" }) });
  await expect(row.getByRole("cell")).toHaveText("205");
  await expect(row).toHaveAttribute("title", "all turrets' damage averaged over six directions");
  await expect(stat(page, "Burst Weapon Output (MW)")).toHaveText("0");
});

test("an L Ship's group shields show in the Avg. Group Shield rows, not the main Shield row", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");

  // Picking Equipment fills both of the group's Slots: 2 × 5,000 MJ, 2 × 300 MW.
  await fit(page, /Shields group_front/, "Bubble Shield M");

  await expect(stat(page, "Shield (MJ)")).toHaveText("0");
  await expect(stat(page, "Avg. Group Shield (MJ)")).toHaveText("10,000");
  await expect(stat(page, "Recharge Rate (MW)")).toHaveText("0");
});

test("the flight rows follow the engine and thruster", async ({ page }) => {
  await openShip(page, "S", "Swiftwing Courier");
  await expect(stat(page, "Speed (m/s)")).toHaveText("0");
  await expect(stat(page, "Yaw (°/s)")).toHaveText("0.0");

  // Mass 10, drag 5 forward / 4 sideways; 1,500 thrust, boost ×4, travel ×10.
  await fit(page, /^Engines/, "Sprint Engine S");
  await expect(stat(page, "Speed (m/s)")).toHaveText("300");
  await expect(stat(page, "Acceleration (m/s²)")).toHaveText("150");
  await expect(stat(page, "Boost Speed (m/s)")).toHaveText("1,200");
  await expect(stat(page, "Boost Acceleration (m/s²)")).toHaveText("300");
  await expect(stat(page, "Boost Capacity (s)")).toHaveText("10.0");
  await expect(stat(page, "Boost Recharge Rate (%/s)")).toHaveText("5.0");
  await expect(stat(page, "Travel Speed (m/s)")).toHaveText("3,000");
  await expect(stat(page, "Travel Acceleration (m/s²)")).toHaveText("150");
  await expect(stat(page, "Travel Charge Time (s)")).toHaveText("5.0");

  // Strafe 400; yaw 3 / 1.5 = 2 °/s, which the game's rad/s round trip shows as 1.9.
  await fit(page, "Thruster", "Nimble Thruster S");
  await expect(stat(page, "Strafe Speed (m/s)")).toHaveText("100.0");
  await expect(stat(page, "Strafe Acceleration (m/s²)")).toHaveText("40.0");
  await expect(stat(page, "Yaw (°/s)")).toHaveText("1.9");
  await expect(stat(page, "Roll (°/s)")).toHaveText("2.0");
});
