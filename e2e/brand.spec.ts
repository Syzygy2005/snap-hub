import { test, expect } from "@playwright/test";

test("new identity stays usable on home, menus and share assets", async ({page,isMobile}) => {
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Build your next winning deck."})).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("background-color","rgb(16, 45, 41)");
  await page.screenshot({path:test.info().outputPath("brand-home.png"),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('img[src*="banner.webp"], img[src*="wordmark.png"], img[src*="brand/icon.png"]').count()).toBe(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:"Skip to content"})).toBeFocused();
  if (isMobile) {
    await page.getByText("Menu",{exact:true}).click();
    const menu=page.getByRole("navigation",{name:"Mobile navigation"});
    await expect(menu).toBeVisible();
    await menu.getByRole("link",{name:"Wiki",exact:true}).click();
  } else await page.getByRole("link",{name:"Explore the wiki",exact:true}).click();
  await page.getByRole("navigation",{name:"Wiki sections"}).getByRole("link",{name:"Cards",exact:true}).click();
  await expect(page.getByRole("navigation",{name:"Wiki sections"}).getByRole("link",{name:"Cards",exact:true})).toHaveAttribute("aria-current","page");
  for (const path of ["/icon.svg","/apple-icon","/opengraph-image","/leaderboard/movers/opengraph-image"]) {
    const response=await page.request.get(path); expect(response.ok()).toBe(true); expect(response.headers()["content-type"]).toMatch(/image/);
  }
});

test("artwork motion resets and respects touch and reduced motion",async({page,isMobile})=>{
  await page.goto("/wiki/cards/TestCard1");
  const art=page.locator(".brand-art");
  const title=page.getByRole("heading",{name:"Test Card 1",exact:true});
  const before=await title.boundingBox();
  if (!isMobile) {
    await art.hover({position:{x:15,y:15}});
    await expect(art).toHaveAttribute("data-engaged","true");
    expect(await title.boundingBox()).toEqual(before);
    await art.dispatchEvent("pointercancel",{pointerType:"mouse"});
    await expect(art).toHaveAttribute("data-engaged","false");
    await art.hover({position:{x:50,y:50}});
    await expect(art).toHaveAttribute("data-engaged","true");
  } else {
    await art.dispatchEvent("pointermove",{pointerType:"touch",clientX:20,clientY:20});
    await expect(art).not.toHaveAttribute("data-engaged","true");
  }
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(art.locator(".brand-art-stage")).toHaveCSS("transform","none");
  await expect(art).toHaveAttribute("data-engaged","false");
  await expect(art.locator(".brand-art-sheen")).toHaveCSS("display","none");
});
