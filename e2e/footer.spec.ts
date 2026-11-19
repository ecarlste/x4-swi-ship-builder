import { expect, test } from "@playwright/test";

test("the footer shows the Game Data versions and the required notices", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  // Versions from the fixture snapshot's manifest.
  await expect(footer).toContainText("SWI 9.9.9 Fixture");
  await expect(footer).toContainText("X4 9.99");

  // X4 credit with links to its store pages.
  await expect(footer.getByRole("link", { name: "Steam" })).toHaveAttribute(
    "href",
    "https://store.steampowered.com/app/392160/X4_Foundations/",
  );
  await expect(footer.getByRole("link", { name: "GOG" })).toHaveAttribute(
    "href",
    "https://www.gog.com/en/game/x4_foundations",
  );

  // Egosoft Fan Content Policy, Section 7.
  await expect(footer).toContainText(
    "This is an unofficial fan project. It is not affiliated with, endorsed, or supported by Egosoft. " +
      "Egosoft assumes no technical support or liability (e.g., for corrupted save games). Use at your own risk. " +
      "All names, trademarks, and content related to X4: Foundations are the property of Egosoft or their respective owners.",
  );

  // Lucasfilm fan-site rule.
  await expect(footer).toContainText("not affiliated with Disney or Lucasfilm");

  // SWI credit.
  await expect(footer.getByRole("link", { name: "Star Wars Interworlds" })).toBeVisible();
});

test("the page has no ads, sales or donation links", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /donat|patreon|ko-fi|buy me|sponsor|shop|store/i })).toHaveCount(0);
});
