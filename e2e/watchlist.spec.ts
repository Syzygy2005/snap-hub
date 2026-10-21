import { test, expect, type Page } from "@playwright/test";

// A watchlist is kept in the browser, by player id. An id is not a person: a leaderboard reset
// restarts the ids, so a saved one can name a stranger. The board checks each saved id against
// the record's first sighting before it shows anyone as watched.

async function profileId(page: Page, name: string) {
  await page.goto(`/players?q=${encodeURIComponent(name)}`);
  await page.getByRole("link", { name: new RegExp(`^${name}\\b`) }).click();
  await page.waitForURL(/\/players\/\d+$/);
  return page.url().match(/\/players\/(\d+)/)![1];
}

test("players watched from their profile are what the Watching view shows, after a reload too", async ({ page }) => {
  await profileId(page, "Browser Player 120");
  const watch = page.getByRole("button", { name: "Watch", exact: true });
  await watch.click();
  await expect(page.getByRole("button", { name: "Watching", exact: true })).toHaveAttribute("aria-pressed", "true");

  await profileId(page, "Retired Player");
  await page.getByRole("button", { name: "Watch", exact: true }).click();

  await page.goto("/leaderboard");
  await page.getByRole("button", { name: "Watching (2)" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Browser Player 120", exact: true })).toBeVisible();
  await expect(page.getByText("Not on this board:")).toContainText("Retired Player");
  await expect(page.getByText("Your watchlist is kept in this browser only.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Watching (2)" })).toBeVisible();

  // Stopping on the profile takes them off the list.
  await profileId(page, "Browser Player 120");
  await page.getByRole("button", { name: "Watching", exact: true }).click();
  await expect(page.getByRole("button", { name: "Watch", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.goto("/leaderboard");
  await expect(page.getByRole("button", { name: "Watching (1)" })).toBeVisible();
});

test("a saved id that now names somebody else is never shown as them", async ({ page }) => {
  // What a reset leaves behind: the id was saved when it belonged to someone first seen in 2020,
  // and the record now behind it was first seen later, so it is a different player.
  const id = await profileId(page, "Browser Player 5");
  await page.evaluate((stale) => localStorage.setItem("snaphub:watchlist", JSON.stringify([stale])), {
    id: Number(id),
    name: "Old Name",
    firstSeen: "2020-01-01T00:00:00.000Z",
  });
  await expect(page.getByRole("button", { name: "Watch", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.goto("/leaderboard");
  await page.getByRole("button", { name: "Watching (1)" }).click();
  await expect(page.getByText("Nobody you watch is on this board.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browser Player 5", exact: true })).toHaveCount(0);
  await expect(page.getByText("No longer on record.")).toBeVisible();

  await page.getByRole("button", { name: "Remove Old Name from your watchlist" }).click();
  await expect(page.getByRole("button", { name: /^Watching/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Browser Player 1", exact: true })).toBeVisible();
});
