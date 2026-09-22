import { test, expect } from "@playwright/test";

test("home search finds cards, artists, locations, players and guide sections",async({page})=>{
  await page.goto("/");
  const header=page.getByRole("search",{name:"Site search"});
  await header.getByRole("searchbox").fill("Asgard");
  await header.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/\/search\?q=Asgard/);
  await page.getByRole("region",{name:"Locations",exact:true}).getByRole("link",{name:/Asgard/}).click();
  await expect(page).toHaveURL(/\/wiki\/locations\/Asgard/);
  await page.goto("/search?q=Test+Card+1");
  await expect(page.getByRole("region",{name:"Cards",exact:true}).getByRole("heading",{name:"Test Card 1",exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Variants",exact:true})).toBeVisible();
  await page.goto("/search?q=Test+Artist");
  await page.getByRole("region",{name:"Variants",exact:true}).getByRole("link").first().click();
  await expect(page).toHaveURL(/#variant-released-example$/);
  await expect(page.locator("#variant-released-example")).toBeInViewport();
  await page.goto("/search?q=Browser+Player+1");
  await expect(page.getByRole("region",{name:"Players",exact:true})).toBeVisible();
  await page.goto("/search?q=prio");
  await page.getByRole("link",{name:/Priority \/ prio/}).click();
  await expect(page).toHaveURL(/\/wiki\/terminology#priority$/);
  await expect(page.locator("#priority")).toBeInViewport();
});

test("variant filters survive reload and previews require an explicit choice",async({page})=>{
  await page.goto("/wiki/variants");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("combobox",{name:"Artist",exact:true}).selectOption("Test Artist");
  await page.getByRole("button",{name:"Apply filters"}).click();
  await expect(page).toHaveURL(/artist=Test\+Artist/);
  await page.reload();
  await expect(page.getByRole("combobox",{name:"Artist",exact:true})).toHaveValue("Test Artist");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByRole("link",{name:"Reset",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Artist",exact:true})).toHaveValue("");
  await page.getByRole("combobox",{name:"Release status",exact:true}).selectOption("unreleased");
  await page.getByRole("button",{name:"Apply filters"}).click();
  await expect(page.getByText("Unreleased previews can change.",{exact:false})).toBeVisible();
  await expect(page.locator("article").getByText("Preview Artist",{exact:true})).toBeVisible();
  await page.getByRole("combobox",{name:"Artist",exact:true}).selectOption("Preview Artist");
  await page.getByRole("button",{name:"Apply filters"}).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.screenshot({path:test.info().outputPath("variant-gallery.png"),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("wiki guides are linked, readable on mobile, and searchable",async({page})=>{
  await page.goto("/wiki");
  await page.screenshot({path:test.info().outputPath("wiki-home.png"),fullPage:true});
  for(const [slug,title] of [["basics","How to play"],["game-modes","Game modes"],["terminology","SNAP terminology"],["collection","Collection & cosmetics"]]){
    await page.goto(`/wiki/${slug}`);
    await expect(page.getByRole("heading",{name:title,exact:true,level:1})).toBeVisible();
    await expect(page.getByRole("navigation",{name:"On this page"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto("/wiki/game-modes");
  await page.screenshot({path:test.info().outputPath("game-modes.png"),fullPage:true});
  await page.goto("/search?q=NoMatchingStringAnywhere");
  await expect(page.getByText("No matches found",{exact:true})).toBeVisible();
  await page.goto("/search?q=%20%20");
  await expect(page.getByText("What are you looking for?",{exact:true})).toBeVisible();
  await page.goto("/wiki/not-a-guide");
  await expect(page.getByText("Nothing here",{exact:true})).toBeVisible();
});
