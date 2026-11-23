import { expect, test, type Page } from "@playwright/test";
import { fit, loadoutTable, openShip, row } from "./helpers.ts";

const sliderOf = (page: Page, place: string) => page.getByRole("slider", { name: `${place} count` });
const countOf = (page: Page, place: string) => page.getByRole("spinbutton", { name: `${place} count` });

/** The Courier with both launchers fitted: Darts and Torpedoes share 10 missiles. */
async function courierWithMissiles(page: Page) {
  await openShip(page, "S", "Swiftwing Courier");
  await fit(page, /con_weapon_01/, "Dart Launcher");
  await fit(page, /con_weapon_02/, "Torpedo Tube");
}

test("consumable, Crew and Slot Group counts are each a slider plus a number, named after the Place", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");
  await fit(page, /Turrets group_front/, "Flak Turret");

  for (const place of ["Porter Drone", "Marker Beacon", "Service crew", "Marines", "group_front Turrets"]) {
    await expect(sliderOf(page, place)).toBeVisible();
    await expect(countOf(page, place)).toBeVisible();
  }
  // The track spans the full capacity: the section's, or the Slot Group's (a range input's max is its aria-valuemax).
  await expect(sliderOf(page, "Porter Drone")).toHaveAttribute("max", "20");
  await expect(sliderOf(page, "Service crew")).toHaveAttribute("max", "20");
  await expect(sliderOf(page, "group_front Turrets")).toHaveAttribute("max", "4");
  await expect(sliderOf(page, "group_front Turrets")).toHaveAttribute("aria-valuenow", "4");
  // The Captain has none.
  await expect(row(page, "Captain").getByRole("slider")).toHaveCount(0);
});

test("the thumb stops at the limit the section's other rows leave, though the track spans the capacity", async ({
  page,
}) => {
  await courierWithMissiles(page);
  await countOf(page, "Dart Missile").fill("6");
  await countOf(page, "Dart Missile").press("Enter");

  const torpedoes = sliderOf(page, "Heavy Torpedo");
  await expect(torpedoes).toHaveAttribute("max", "10");
  // Dragging to the far end of the track stops at the 4 the Darts leave.
  // Grab the thumb, at 0 on the track's left end, and drag well past the track's right end.
  const thumb = (await torpedoes.boundingBox())!;
  const y = thumb.y + thumb.height / 2;
  await page.mouse.move(thumb.x + thumb.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(thumb.x + 300, y, { steps: 5 });
  await page.mouse.up();
  await expect(torpedoes).toHaveAttribute("aria-valuenow", "4");
  await expect(countOf(page, "Heavy Torpedo")).toHaveValue("4");
  await expect(loadoutTable(page).getByRole("rowgroup", { name: /^Missiles/ }).getByRole("columnheader")).toHaveText(
    /10 \/ 10$/,
  );
});

test("the slider follows a typed value, applied on Enter or blur, and a value over the limit clamps", async ({ page }) => {
  await openShip(page, "L", "Ironback Hauler");
  const drones = countOf(page, "Porter Drone");
  const slider = sliderOf(page, "Porter Drone");

  await drones.fill("7");
  await drones.press("Enter");
  await expect(slider).toHaveAttribute("aria-valuenow", "7");
  await expect(loadoutTable(page).getByRole("rowgroup", { name: /^Drones/ }).getByRole("columnheader")).toHaveText(
    /7 \/ 20$/,
  );

  await drones.fill("12");
  await drones.blur();
  await expect(slider).toHaveAttribute("aria-valuenow", "12");

  await drones.fill("99");
  await drones.press("Enter");
  await expect(drones).toHaveValue("20");
  await expect(slider).toHaveAttribute("aria-valuenow", "20");

  await drones.fill("-3");
  await drones.press("Enter");
  await expect(drones).toHaveValue("0");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
});

test("arrow keys move a slider by one, Page Up and Page Down by ten, and Home and End jump to zero and the limit", async ({
  page,
}) => {
  await openShip(page, "L", "Ironback Hauler");
  const crew = sliderOf(page, "Service crew");
  const count = countOf(page, "Service crew");
  await crew.focus();

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await expect(count).toHaveValue("2");
  await page.keyboard.press("ArrowLeft");
  await expect(count).toHaveValue("1");
  await page.keyboard.press("PageUp");
  await expect(count).toHaveValue("11");
  await page.keyboard.press("PageDown");
  await expect(count).toHaveValue("1");
  await page.keyboard.press("End");
  await expect(count).toHaveValue("20");
  await page.keyboard.press("Home");
  await expect(count).toHaveValue("0");

  // With 12 Service crew aboard, the Marines' limit is the 8 places left.
  await count.fill("12");
  await count.press("Enter");
  const marines = sliderOf(page, "Marines");
  await marines.focus();
  await page.keyboard.press("End");
  await expect(countOf(page, "Marines")).toHaveValue("8");
  await expect(marines).toHaveAttribute("max", "20");
  await page.keyboard.press("PageDown");
  await expect(countOf(page, "Marines")).toHaveValue("0");
  await page.keyboard.press("PageUp");
  await expect(countOf(page, "Marines")).toHaveValue("8");
  await page.keyboard.press("ArrowUp");
  await expect(countOf(page, "Marines")).toHaveValue("8");
});
