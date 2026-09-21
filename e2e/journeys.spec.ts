import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const signIn = async (page: Page) => {
  await page.goto("/decks/builder");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
};

test("navigation works on mobile and desktop", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByText("Menu", { exact: true }).click();
  const nav = page.getByRole("navigation", { name: isMobile ? "Mobile navigation" : "Main navigation", exact: true });
  await page.screenshot({ path: test.info().outputPath("navigation.png"), fullPage: true });
  if (isMobile) {
    await page.getByText("Menu", { exact: true }).press("Escape");
    await expect(nav).not.toBeVisible();
    await page.getByText("Menu", { exact: true }).click();
  }
  await nav.getByRole("button", { name: "Stats options" }).click();
  await nav.getByRole("link", { name: "My Stats", exact: true }).click();
  await expect(page).toHaveURL(/\/stats\/me/);
  if (isMobile) await expect(page.locator("details").filter({ has: page.getByText("Menu", { exact: true }) })).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("deck import, export and private sync across browsers", async ({ page, browser, baseURL }) => {
  await signIn(page);
  const ids = Array.from({ length: 12 }, (_, i) => `TestCard${i + 1}`);
  const code = Buffer.from(JSON.stringify({ Cards: ids.map((CardDefId) => ({ CardDefId })), Name: "E2E private" })).toString("base64");
  await page.getByRole("button", { name: "Import code", exact: true }).click();
  await page.getByLabel("Deck code to import").fill(code);
  await page.getByRole("button", { name: "Load deck", exact: true }).click();
  await page.getByLabel("Deck name").fill(`E2E ${test.info().project.name}`);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; } } }));
  await page.getByRole("button", { name: "Copy code", exact: true }).click();
  const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
  expect(JSON.parse(Buffer.from(copied, "base64").toString()).Cards).toHaveLength(12);
  await page.getByRole("button", { name: "Save new private deck" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved privately" })).toBeVisible();
  await page.getByRole("region", { name: "Private account decks" }).screenshot({ path: test.info().outputPath("account-decks.png") });
  const ctx = await browser.newContext({ baseURL });
  const second = await ctx.newPage();
  await signIn(second);
  await expect(second.getByRole("button", { name: `E2E ${test.info().project.name} · 12/12`, exact: true })).toBeVisible();
  const privateResponse = await second.request.get("/api/decks/private");
  const id = (await privateResponse.json()).decks[0].id;
  expect((await second.request.get(`/decks/${id}`)).status()).toBe(404);
  await second.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(second.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect((await second.request.get("/api/decks/private")).status()).toBe(401);
  await ctx.close();
});

test("tracker setup confirms a real game upload", async ({ page }) => {
  const response = await page.request.post("/api/tracker/keys", { data: { name: "E2E PC" } });
  const { token } = await response.json();
  expect(token).toBeTruthy();
  await page.goto("/stats/tracker");
  // Use the same browser storage key as the application's key helper.
  await page.evaluate((key) => localStorage.setItem("snaphub:tracker-key", key), token);
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Waiting for your first game");
  const upload = await page.request.post("/api/tracker/games", { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, data: readFileSync("src/lib/stats/fixtures/real-game.json") });
  expect(upload.ok(), await upload.text()).toBe(true);
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByRole("status")).toHaveText("Tracker upload received");
});
