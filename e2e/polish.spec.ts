import { test, expect } from "@playwright/test";

test("energy bars interpolate additions and removals, with instant reduced motion", async ({ page }) => {
  await page.goto("/decks/builder");
  const curve = page.getByRole("img", { name: /^Energy curve:/ });
  const bar = curve.locator(".energy-bar").nth(1);
  await expect(bar).toHaveCSS("height", "0px");
  await bar.evaluate(el => {
    el.addEventListener("transitionstart", event => {
      if ((event as TransitionEvent).propertyName !== "height") return;
      const animation = el.getAnimations().find(a =>
        a instanceof CSSTransition && a.transitionProperty === "height");
      if (!animation?.effect) return;
      // Sample the real transition at a deterministic midpoint, independent of frame timing.
      animation.pause();
      animation.currentTime = Number(animation.effect.getComputedTiming().duration) / 2;
      el.setAttribute("data-observed-height", getComputedStyle(el).height);
      animation.play();
    });
  });
  await page.getByRole("button", { name: "Test Card 1, cost 1, power 2", exact: true }).click();
  await expect(bar).toHaveCSS("height", "16px");
  const rising = parseFloat((await bar.getAttribute("data-observed-height"))!);
  expect(rising).toBeGreaterThan(0);
  expect(rising).toBeLessThan(16);
  await page.getByRole("button", { name: "Remove Test Card 1", exact: true }).click();
  await expect(bar).toHaveCSS("height", "0px");
  const falling = parseFloat((await bar.getAttribute("data-observed-height"))!);
  expect(falling).toBeGreaterThan(0);
  expect(falling).toBeLessThan(16);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Test Card 1, cost 1, power 2", exact: true }).click();
  await expect(bar).toHaveCSS("transition-duration", "0s");
  await expect(bar).toHaveCSS("height", "16px");
  await page.screenshot({ path: test.info().outputPath("builder-polish.png"), fullPage: true });
});

test("empty reference searches offer a clear recovery", async ({ page }) => {
  await page.goto("/wiki/cards?q=does-not-exist");
  await expect(page.getByText("No matches yet", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(/\/wiki\/cards$/);
  await expect(page.getByRole("heading", { name: "Test Card 1", exact: true })).toBeVisible();
});
