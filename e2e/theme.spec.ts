import { test, expect, type Page } from "@playwright/test";

const LIGHT = "rgb(243, 242, 233)";
const DARK = "rgb(16, 45, 41)";

async function expectTheme(page: Page, theme: "light" | "dark") {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("body")).toHaveCSS("background-color", theme === "dark" ? DARK : LIGHT);
}

async function captureDark(page: Page, name: string) {
  await expectTheme(page, "dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`dark-${name}.png`), fullPage: true });
}

test("theme choice works by keyboard and persists across navigation, reloads and new pages", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await expectTheme(page, "light");
  const darkToggle = page.getByRole("button", { name: "Switch to dark mode", exact: true });
  await darkToggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Switch to light mode", exact: true })).toBeVisible();
  await captureDark(page, "home");

  await page.getByRole("link", { name: "Explore the wiki", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Know your next move.", exact: true })).toBeVisible();
  await captureDark(page, "wiki");
  await page.goto("/decks/builder");
  await expect(page.getByRole("button", { name: "Test Card 1, cost 1, power 2", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Test Card 1, cost 1, power 2", exact: true }).click();
  await captureDark(page, "builder");

  const reopened = await context.newPage();
  try {
    await reopened.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await reopened.goto("/stats");
    await expect(reopened.getByRole("heading", { name: "Meta Stats", exact: true })).toBeVisible();
    await captureDark(reopened, "stats");
    const lightToggle = reopened.getByRole("button", { name: "Switch to light mode", exact: true });
    await lightToggle.focus();
    await reopened.keyboard.press("Space");
    await expectTheme(reopened, "light");
    await expectTheme(page, "light");
    await page.reload();
    await expectTheme(page, "light");
    await expect(page.getByRole("button", { name: "Switch to dark mode", exact: true })).toBeVisible();
  } finally {
    await reopened.close();
  }
});

test("denied browser storage does not prevent in-page theme switching", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { throw new DOMException("Storage is disabled", "SecurityError"); },
    });
  });
  await page.goto("/");
  await expectTheme(page, "light");
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expectTheme(page, "dark");
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await expectTheme(page, "light");
  expect(errors).toEqual([]);
});

test("a saved dark choice is painted without waiting for application hydration", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("snaphub:theme", "dark"));
  let blockedScripts = 0;
  // Keep CSS and the server-rendered page available, but prevent React from hydrating.
  await page.route(/\/_next\/.*\.js(?:\?.*)?$/, route => {
    blockedScripts++;
    return route.abort();
  });
  await page.goto("/");
  expect(blockedScripts).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Build your next winning deck.", exact: true })).toBeVisible();
  await expectTheme(page, "dark");
});

test("with no saved choice the site follows the device, live, until the visitor picks", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expectTheme(page, "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectTheme(page, "dark");
  // Picking light is a choice, and the device no longer overrides it.
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await expectTheme(page, "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expectTheme(page, "light");
});

test("a dark device is painted dark without waiting for application hydration", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.route(/\/_next\/.*\.js(?:\?.*)?$/, route => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Build your next winning deck.", exact: true })).toBeVisible();
  await expectTheme(page, "dark");
});
