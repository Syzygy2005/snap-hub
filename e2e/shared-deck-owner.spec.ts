import { test, expect } from "@playwright/test";

// Sharing a deck used to be one-way: My decks offered "Open" and "Edit a new copy", and the only
// delete or rename was an admin's. Somebody who listed a deck by mistake could not take it back.

test("the person who shared a deck can unlist it, list it again and delete it", async ({ page, browser }) => {
  const name = `Owner controls ${test.info().project.name}`;
  await page.goto("/decks/mine");
  await page.getByRole("link", { name: "Sign in with Discord", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  const cards = Array.from({ length: 12 }, (_, i) => `TestCard${i + 1}`);
  const shared = await page.request.post("/api/decks", { data: { name, cards, listed: true } });
  expect(shared.ok()).toBe(true);
  const { id } = await shared.json();

  await page.goto("/decks/mine");
  const copy = page.getByRole("region", { name: /Shared copies/ }).getByRole("listitem").filter({ hasText: name });
  await expect(copy.getByText("Public", { exact: true })).toBeVisible();
  await copy.getByRole("button", { name: "Make unlisted", exact: true }).click();
  await expect(copy.getByText("Unlisted", { exact: true })).toBeVisible();

  // Off the Decks page, and the link still opens it.
  await page.goto("/decks");
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await page.goto(`/decks/${id}`);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("You shared this", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Make public", exact: true }).click();
  await expect(page.getByRole("button", { name: "Make unlisted", exact: true })).toBeVisible();

  // Nobody else sees the controls.
  const stranger = await browser.newPage();
  await stranger.goto(`/decks/${id}`);
  await expect(stranger.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(stranger.getByText("You shared this", { exact: true })).toHaveCount(0);
  await expect(stranger.getByRole("button", { name: "Delete shared copy" })).toHaveCount(0);
  expect((await stranger.request.delete(`/api/decks/${id}`)).status()).toBe(401);
  await stranger.close();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete shared copy", exact: true }).click();
  await expect(page).toHaveURL(/\/decks\/mine$/);
  await expect(page.getByRole("region", { name: /Shared copies/ }).getByText(name, { exact: true })).toHaveCount(0);
  expect((await page.request.get(`/decks/${id}`)).status()).toBe(404);
});
