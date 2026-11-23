import { expect, test } from "@playwright/test";

test("the footer shows the Game Data versions and the required notices", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  // The Snapshot, from the fixture snapshot's manifest: X4 "999" shows as the game writes it.
  await expect(footer).toContainText(
    "Game Data: SWI 9.9.9 Fixture · X4 9.99 · extracted 2026-01-01 from 1f68ba3",
  );
  await expect(footer.getByRole("link", { name: "1f68ba3" })).toHaveAttribute(
    "href",
    "https://github.com/ecarlste/x4-swi-ship-builder/commit/1f68ba3c0ffee5ca1ab1e0d15ea5edbadc0de123",
  );

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
