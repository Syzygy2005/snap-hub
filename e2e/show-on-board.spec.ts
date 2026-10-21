import { test, expect } from "@playwright/test";

// The board shows 100 rows at a time and opened at the top, so finding somebody at rank 734 from
// their profile meant pressing "Show more" seven times and scrolling. A link to the board now
// names the player, and the board opens at their row.

test("a profile opens the board at that player's row, past the first page", async ({ page }) => {
  await page.goto("/players?q=Browser+Player+120");
  await page.getByRole("link", { name: /^Browser Player 120\b/ }).click();
  await expect(page.getByRole("heading", { name: "Browser Player 120", exact: true })).toBeVisible();
  const id = page.url().match(/\/players\/(\d+)/)![1];

  await page.getByRole("link", { name: "Show on the board", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leaderboard\\?(.+&)?player=${id}(&|$)`));
  const row = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "Browser Player 120", exact: true }) });
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row).toBeInViewport();
  // Only that row is marked, and the rows either side of it are on the page too.
  await expect(page.locator('tbody tr[aria-current="true"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Browser Player 119", exact: true })).toBeVisible();

  // The same link opened fresh, the way a shared one arrives.
  await page.goto("/");
  await page.goto(`/leaderboard?player=${id}`);
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row).toBeInViewport();
});

test("a link to a player who is not on this board says so instead of showing the top", async ({ page }) => {
  await page.goto("/players?q=Retired+Player");
  await page.getByRole("link", { name: /^Retired Player\b/ }).click();
  await page.waitForURL(/\/players\/\d+$/);
  const id = page.url().match(/\/players\/(\d+)/)![1];

  await page.goto(`/leaderboard?player=${id}`);
  const notice = page.getByRole("status").filter({ hasText: "Retired Player is not in this top" });
  // On screen, not just on the page: on a phone the stat tiles alone fill the first screen.
  await expect(notice).toBeInViewport();
  await expect(notice.getByRole("link", { name: "Retired Player", exact: true })).toHaveAttribute("href", `/players/${id}`);
  await expect(page.locator('tbody tr[aria-current="true"]')).toHaveCount(0);
});

test("a link that names nobody leaves the board as it was", async ({ page }) => {
  for (const player of ["abc", "0", "999999"]) {
    await page.goto(`/leaderboard?player=${player}`);
    await expect(page.getByRole("link", { name: "Browser Player 1", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show more (20 left)" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "is not in this top" })).toHaveCount(0);
  }
});
