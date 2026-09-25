import { test, expect } from "@playwright/test";

test("wiki groups keep every section reachable on desktop and mobile", async ({ page, isMobile }) => {
  await page.goto("/wiki/cards/TestCard1");
  const sections = page.getByRole("navigation", { name: "Wiki sections" });
  await expect(sections.getByRole("link", { name: "Cards", exact: true })).toHaveAttribute("aria-current", "page");
  if (isMobile) {
    const picker = page.getByRole("combobox", { name: "Wiki page" });
    await expect(picker).toHaveValue("/wiki/cards");
    await expect(picker.locator("option")).toHaveCount(12);
    await picker.selectOption("/wiki/variants");
  } else {
    await page.getByRole("navigation", { name: "Wiki groups" }).getByRole("link", { name: "Art & Collection" }).click();
  }
  await expect(page).toHaveURL(/\/wiki\/variants$/);
  await sections.getByRole("link", { name: "Artists", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/artists$/);
  if (isMobile) await page.getByRole("combobox", { name: "Wiki page" }).selectOption("/wiki/basics");
  else await page.getByRole("navigation", { name: "Wiki groups" }).getByRole("link", { name: "Guides", exact: true }).click();
  await expect(sections.getByRole("link", { name: "How to play", exact: true })).toHaveAttribute("aria-current", "page");
  await sections.getByRole("link", { name: "Game modes", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/game-modes$/);
  if (isMobile) await page.getByRole("combobox", { name: "Wiki page" }).selectOption("/wiki/history");
  else await page.getByRole("navigation", { name: "Wiki groups" }).getByRole("link", { name: "History", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/history$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("card grid reflows and stops motion when preferences change", async ({ page }) => {
  await page.goto("/decks/builder");
  const pool = page.getByRole("region", { name: "Card pool" });
  await expect(pool.locator("li[data-card-id]")).toHaveCount(12);
  // The mobile header and intro can put all cards below the fold. Motion is intentionally
  // viewport-limited, so bring the filters and the first card rows into view together.
  await pool.locator(".builder-toolbar").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => {
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.matches("li[data-card-id]")) this.setAttribute("data-animated", "true");
      return original.call(this, frames, options);
    };
  });
  await page.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("name");
  await expect(pool.locator("li[data-card-id]").first()).toHaveAttribute("data-card-id", "TestCard1");
  await expect.poll(() => pool.locator('[data-animated="true"]').count()).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => pool.locator("ul").evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.evaluate(() => document.querySelectorAll("[data-animated]").forEach((el) => el.removeAttribute("data-animated")));
  await page.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("cost");
  await expect(pool.locator("li[data-card-id]").first()).toHaveAttribute("data-card-id", "TestCard7");
  await expect(pool.locator("[data-animated]")).toHaveCount(0);
  await page.getByRole("group", { name: "Filter by cost" }).getByRole("button", { name: "1", exact: true }).click();
  await expect(pool.locator("li[data-card-id]")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(pool.locator("li[data-card-id]")).toHaveCount(12);
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    await page.screenshot({ path: test.info().outputPath(`builder-${theme}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
