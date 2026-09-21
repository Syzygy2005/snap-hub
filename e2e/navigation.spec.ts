import { test, expect } from "@playwright/test";

test("header groups pages with keyboard and touch friendly disclosures", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByText("Menu", { exact: true }).click();
  const nav = page.getByRole("navigation", { name: isMobile ? "Mobile navigation" : "Main navigation", exact: true });
  const wiki = nav.getByRole("button", { name: "Wiki options" });
  await wiki.focus();
  await page.keyboard.press("Enter");
  await expect(wiki).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Overview", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(wiki).toBeFocused();
  await expect(wiki).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Cards", exact: true })).not.toBeVisible();
  await wiki.click();
  const stats = nav.getByRole("button", { name: "Stats options" });
  await stats.click();
  await expect(wiki).toHaveAttribute("aria-expanded", "false");
  for (const name of ["Community stats", "My Stats", "Tracker setup"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  }
  await nav.getByRole("link", { name: "Tracker setup", exact: true }).click();
  await expect(page).toHaveURL(/\/stats\/tracker$/);
  if (isMobile) await page.getByText("Menu", { exact: true }).click();
  await wiki.click();
  await nav.getByRole("link", { name: "Locations", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/locations$/);
  await expect(page.getByRole("heading", { name: "Location atlas", exact: true })).toBeVisible();
  if (isMobile) await page.getByText("Menu", { exact: true }).click();
  await wiki.click();
  await expect(nav.getByRole("link", { name: "Locations", exact: true })).toHaveAttribute("aria-current", "page");
  await page.mouse.click(8, page.viewportSize()!.height - 10);
  await expect(wiki).toHaveAttribute("aria-expanded", "false");
  const bounds = await nav.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await wiki.click();
  await expect(nav.locator(".nav-disclosure").first()).toHaveCSS("transition-duration", "0s");
  await page.screenshot({ path: test.info().outputPath("navigation.png"), fullPage: true });
});
