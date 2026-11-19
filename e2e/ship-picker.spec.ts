import { expect, test, type Page } from "@playwright/test";

const shipPicker = (page: Page) => page.getByRole("combobox", { name: "Ship" });
const shipOptions = (page: Page) => page.getByRole("listbox", { name: "Ships" }).getByRole("option");

/** Opens the Ship picker and checks it lists exactly these Ships, in order. */
async function expectListedShips(page: Page, names: string[]) {
  await shipPicker(page).click();
  const options = shipOptions(page);
  await expect(options).toHaveCount(names.length);
  for (const [i, name] of names.entries()) {
    await expect(options.nth(i)).toHaveAccessibleName(name);
  }
  await page.keyboard.press("Escape");
}

test("the Size dropdown narrows the Ship list to Ships of that size", async ({ page }) => {
  await page.goto("/");

  const size = page.getByRole("combobox", { name: "Size" });
  await expect(size.getByRole("option", { selected: true })).toHaveText("S");
  await expectListedShips(page, ["Bramble Fighter", "Swiftwing Courier", "Needle Interceptor"]);

  await size.selectOption("M");
  await expectListedShips(page, ["Lancer Gunship (Corsair Clans)", "Lancer Gunship (Freight Guild)"]);

  await size.selectOption("XL");
  await expectListedShips(page, []);
});

test("the Seller filter narrows the Ship list to one Faction's Ships", async ({ page }) => {
  await page.goto("/");

  const seller = page.getByRole("combobox", { name: "Seller" });
  await expect(seller.getByRole("option", { selected: true })).toHaveText("Any");

  await seller.selectOption("Corsair Clans");
  await expectListedShips(page, ["Bramble Fighter", "Needle Interceptor"]);

  await page.getByRole("combobox", { name: "Size" }).selectOption("M");
  await expectListedShips(page, ["Lancer Gunship (Corsair Clans)"]);

  await seller.selectOption("Any");
  await expectListedShips(page, ["Lancer Gunship (Corsair Clans)", "Lancer Gunship (Freight Guild)"]);
});

test("the Size and Seller filters only narrow the picker, leaving the open Ship in place", async ({ page }) => {
  await page.goto("/");
  await shipPicker(page).click();
  await page.getByRole("option", { name: "Swiftwing Courier" }).click();

  await page.getByRole("combobox", { name: "Seller" }).selectOption("Corsair Clans");
  await page.getByRole("combobox", { name: "Size" }).selectOption("M");

  await expect(page).toHaveTitle("Swiftwing Courier · X4: SWI Ship Builder");
  await expect(page.getByRole("heading", { name: "Swiftwing Courier" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ship" }).getByRole("listitem")).toHaveText([
    "Freight Guild: no Licence needed",
  ]);
});

test("typing part of a name filters the Ship list as you type", async ({ page }) => {
  await page.goto("/");

  await shipPicker(page).fill("r");
  await expect(shipOptions(page)).toHaveCount(3);
  await shipPicker(page).pressSequentially("i");
  await expect(shipOptions(page)).toHaveCount(1);
  await expect(shipOptions(page)).toHaveAccessibleName("Swiftwing Courier");

  await shipPicker(page).fill("WING");
  await expect(shipOptions(page)).toHaveAccessibleName("Swiftwing Courier");

  await shipPicker(page).fill("zzz");
  await expect(shipOptions(page)).toHaveCount(0);
  await expect(page.getByText("No Ships match.")).toBeVisible();
});

test("the Ship list is grouped by Ship Type, and each option shows its Sellers", async ({ page }) => {
  await page.goto("/");
  await shipPicker(page).click();
  const list = page.getByRole("listbox", { name: "Ships" });

  const groups = list.getByRole("group");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAccessibleName("Fighter");
  await expect(groups.nth(1)).toHaveAccessibleName("Interceptor");

  const fighters = groups.nth(0).getByRole("option");
  await expect(fighters.nth(0)).toHaveAccessibleName("Bramble Fighter");
  await expect(fighters.nth(1)).toHaveAccessibleName("Swiftwing Courier");
  await expect(groups.nth(1).getByRole("option")).toHaveAccessibleName("Needle Interceptor");

  await expect(fighters.nth(1)).toHaveAccessibleDescription("Freight Guild");
  await expect(list.getByRole("option", { name: "Needle Interceptor" })).toHaveAccessibleDescription(
    "Corsair Clans, Freight Guild",
  );
});

test("picking a Ship opens it, and a duplicate name shows its Seller suffix in the picker and title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Choose a size, then a Ship.")).toBeVisible();

  await page.getByRole("combobox", { name: "Size" }).selectOption("M");
  await shipPicker(page).fill("lancer");
  await shipOptions(page).filter({ hasText: "Lancer Gunship (Freight Guild)" }).click();

  await expect(shipPicker(page)).toHaveValue("Lancer Gunship (Freight Guild)");
  await expect(page).toHaveTitle("Lancer Gunship (Freight Guild) · X4: SWI Ship Builder");
  await expect(page.getByRole("heading", { name: "Lancer Gunship (Freight Guild)" })).toBeVisible();
  await expect(page.getByText("Choose a size, then a Ship.")).toBeHidden();
});

test("picking another Ship replaces the current one", async ({ page }) => {
  await page.goto("/");
  await shipPicker(page).click();
  await page.getByRole("option", { name: "Bramble Fighter" }).click();

  // Keyboard picking: the first match is active.
  await shipPicker(page).fill("needle");
  await page.keyboard.press("Enter");

  await expect(shipPicker(page)).toHaveValue("Needle Interceptor");
  await expect(page).toHaveTitle("Needle Interceptor · X4: SWI Ship Builder");
  await expect(page.getByRole("heading", { name: "Needle Interceptor" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bramble Fighter" })).toHaveCount(0);
});

test("the Stats panel's Ship block lists each Seller with the Licence it requires", async ({ page }) => {
  await page.goto("/");
  const shipBlock = page.getByRole("region", { name: "Ship" });

  // A Licence with a reputation shows it.
  await page.getByRole("combobox", { name: "Size" }).selectOption("L");
  await shipPicker(page).click();
  await page.getByRole("option", { name: "Ironback Hauler" }).click();
  await expect(shipBlock.getByRole("listitem")).toHaveText([
    "Corsair Clans: Fixture Arms Licence (+10)",
    "Freight Guild: Fixture Arms Licence (+10)",
  ]);

  // A Licence without a reputation shows just its name.
  await page.getByRole("combobox", { name: "Size" }).selectOption("S");
  await shipPicker(page).fill("needle");
  await page.keyboard.press("Enter");
  await expect(shipBlock.getByRole("listitem")).toHaveText([
    "Corsair Clans: Fixture Ship Licence",
    "Freight Guild: Fixture Ship Licence",
  ]);

  // A Ship that needs no Licence says so.
  await shipPicker(page).fill("swiftwing");
  await page.keyboard.press("Enter");
  await expect(shipBlock.getByRole("listitem")).toHaveText(["Freight Guild: no Licence needed"]);
});
