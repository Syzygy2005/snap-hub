import { test, expect } from "@playwright/test";

test("populated leaderboard renders with string-valued freshness metadata",async({page})=>{
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  const home=await page.goto("/");
  expect(home?.status()).toBe(200);
  await expect(page.getByRole("status").filter({hasText:"Source checked"})).toBeVisible();
  const response=await page.goto("/leaderboard");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading",{name:"Infinite Leaderboard"})).toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"Source checked"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Browser Player 1",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Show more (20 left)"}).click();
  await expect(page.getByRole("link",{name:"Browser Player 120",exact:true})).toBeVisible();
  await page.getByRole("searchbox",{name:"Filter leaderboard"}).fill("Browser Player 120");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link",{name:"Browser Player 120",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
