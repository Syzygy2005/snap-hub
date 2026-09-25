import { test, expect } from "@playwright/test";
test("wiki search, reference details and add to existing draft",async ({page})=>{
  await page.goto("/decks/builder?add=TestCard2");
  await expect(page.getByText("Added Test Card 2 to your draft.")).toBeVisible();
  await page.goto("/wiki/cards");
  await expect(page.getByText("Updates are delayed.", {exact:false})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Upcoming Card",exact:true})).toHaveCount(0);
  await page.getByLabel("Search name or effect").fill("Test Card 1");
  await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(page).toHaveURL(/q=Test\+Card\+1/);
  await page.getByRole("heading",{name:"Test Card 1",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Test Card 1",exact:true,level:1})).toBeVisible();
  const variants = page.getByRole("region", {name:"Card variants"});
  await expect(variants.getByText("Test Artist", {exact:true}).first()).toBeVisible();
  await expect(variants.getByText("Preview Artist", {exact:true}).first()).toBeHidden();
  await variants.getByText("Unreleased variants (1)", {exact:true}).click();
  await expect(variants.getByText("Preview Artist", {exact:true}).first()).toBeVisible();
  // Art gets one more try before it gives up, so it takes two failures to see the fallback.
  const variantArt = variants.getByRole("img", {name:"Test Card 1 variant released-example",exact:true});
  await variantArt.evaluate(img=>img.dispatchEvent(new Event("error")));
  await expect(variants.getByRole("img", {name:"Test Card 1 variant released-example: artwork loading"})).toBeVisible();
  await variantArt.evaluate(img=>img.dispatchEvent(new Event("error")));
  await expect(variants.getByRole("img", {name:"Test Card 1 variant released-example: artwork unavailable"})).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath("wiki-card.png"),fullPage:true});
  await page.getByRole("link",{name:"Add to builder"}).click();
  await expect(page.getByText("Added Test Card 1 to your draft.")).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("snaphub:deck-draft")!).deck)).toEqual(["TestCard2","TestCard1"]);
  await page.reload();
  await expect(page.getByText("Test Card 1 is already in your draft.")).toBeVisible();
  await page.goto("/wiki/locations");
  await page.getByRole("heading",{name:"Asgard",exact:true}).click();
  await expect(page.getByText("After turn 4, whoever is winning here draws 2 cards.",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:test.info().outputPath("wiki-location.png"),fullPage:true});
  await page.goto("/wiki/cards/Upcoming");
  await expect(page.getByText("Nothing here",{exact:true})).toBeVisible();
});
test("failed wiki art remains readable",async({page})=>{
  await page.goto("/wiki/cards/TestCard1");
  const art = page.getByRole("img",{name:"Test Card 1",exact:true});
  await art.evaluate(img=>img.dispatchEvent(new Event("error")));
  await expect(page.getByRole("img",{name:"Test Card 1: artwork loading"})).toBeVisible();
  // The retry is a fresh image; it loads here, so fail it again to reach the fallback.
  await art.evaluate(img=>img.dispatchEvent(new Event("error")));
  await expect(page.getByRole("img",{name:"Test Card 1: artwork unavailable"})).toBeVisible();
});

test("art that fails once is tried again and shows",async({page})=>{
  await page.goto("/wiki/cards/TestCard1");
  await page.getByRole("img",{name:"Test Card 1",exact:true}).evaluate(img=>img.dispatchEvent(new Event("error")));
  await expect(page.getByRole("img",{name:"Test Card 1",exact:true})).toBeVisible();
  await expect(page.getByRole("img",{name:"Test Card 1: artwork unavailable"})).toHaveCount(0);
});

test("wiki separates historical sources from observed changes", async ({ page }) => {
  await page.goto("/wiki/locations/Asgard");
  await expect(page.getByRole("heading", { name: "Reference facts", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Official patch-note mentions", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observed changes", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Browse the official patch archive and other history sources" }).click();
  await expect(page.getByRole("heading", { name: "Official patch archive", exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ official patch and balance articles indexed/)).toBeVisible();
  await expect(page.locator('article a[href^="https://marvelsnap.com/"]').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("patch-archive.png") });
});
