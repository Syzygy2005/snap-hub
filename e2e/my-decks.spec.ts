import { test, expect, type Route } from "@playwright/test";

test("My decks copies browser drafts privately, reopens the same account draft, and respects sign-out", async ({ page }) => {
  const name = `My browser draft ${test.info().project.name}`;
  const updatedName = `Updated private ${test.info().project.name}`;
  const sharedName = `Shared original ${test.info().project.name}`;
  const unlistedName = `Unlisted original ${test.info().project.name}`;
  await page.goto("/decks/builder");
  await page.getByRole("button", { name: /^Test Card 1, cost/ }).click();
  await page.getByRole("button", { name: /^Test Card 2, cost/ }).click();
  await page.getByLabel("Deck name").fill(name);
  await page.getByRole("button", { name: "Save to browser", exact: true }).click();
  await page.getByRole("link", { name: "My decks", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/decks\/mine$/);

  const browserSection = page.getByRole("region", { name: /In this browser/ });
  await expect(browserSection.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save to account", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in with Discord", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await browserSection.getByRole("button", { name: "Save to account", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "now saved privately" })).toBeVisible();

  const privateResponse = await page.request.get("/api/decks/private");
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
  const matching = (await privateResponse.json()).decks.filter((d: { name: string }) => d.name === name);
  expect(matching).toHaveLength(1);
  const id = matching[0].id;
  const accountSection = page.getByRole("region", { name: /Private account drafts/ });
  const draft = accountSection.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await draft.getByRole("link", { name: "Edit private draft" }).click();
  await expect(page).toHaveURL(new RegExp(`private=${id}`));
  await expect(page.getByLabel("Deck name")).toHaveValue(name);
  await page.getByLabel("Deck name").fill(updatedName);
  await page.getByRole("button", { name: /^Test Card 3, cost/ }).click();
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue(updatedName);
  await expect(page.getByText("Restored your unsaved private draft from this browser.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("snaphub:deck-draft")!).name)).toBe(name);
  const secondDraft = await (await page.request.post("/api/decks/private", { data: { name: `Other private ${test.info().project.name}`, cards: ["TestCard4"] } })).json();
  await page.goto(`/decks/builder?private=${secondDraft.deck.id}`);
  await expect(page.getByLabel("Deck name")).toHaveValue(secondDraft.deck.name);
  await expect(page.getByText("Restored your unsaved private draft from this browser.", { exact: true })).toHaveCount(0);
  await page.goto(`/decks/builder?private=${id}`);
  await expect(page.getByLabel("Deck name")).toHaveValue(updatedName);
  await page.getByRole("button", { name: "Update selected deck", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved privately" })).toBeVisible();
  const savedAgain = (await (await page.request.get("/api/decks/private")).json()).decks;
  expect(savedAgain.filter((d: { name: string }) => d.name === name)).toHaveLength(0);
  expect(savedAgain.find((d: { id: string }) => d.id === id)).toMatchObject({ name: updatedName, cards: ["TestCard1", "TestCard2", "TestCard3"] });
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue(updatedName);
  await expect(page.getByText("Restored your unsaved private draft from this browser.", { exact: true })).toHaveCount(0);
  expect((await page.request.get(`/decks/${id}`)).status()).toBe(404);

  // Loading a different list must not leave the previous private draft selected for overwrite.
  await page.getByRole("button", { name: "Import code", exact: true }).click();
  await page.getByLabel("Deck code to import").fill(Buffer.from(JSON.stringify({ Cards: [{ CardDefId: "TestCard3" }] })).toString("base64"));
  await page.getByRole("button", { name: "Load deck", exact: true }).click();
  await expect(page.getByRole("button", { name: "Update selected deck", exact: true })).toHaveCount(0);

  const cards = Array.from({ length: 12 }, (_, i) => `TestCard${i + 1}`);
  for (const [name, listed] of [[sharedName, true], [unlistedName, false]] as const) {
    const response = await page.request.post("/api/decks", { data: { name, cards, listed } });
    expect(response.ok()).toBe(true);
  }
  await page.goto("/decks/mine");
  const sharedSection = page.getByRole("region", { name: /Shared copies/ });
  await expect(sharedSection.getByRole("listitem").filter({ hasText: sharedName }).getByText("Public", { exact: true })).toBeVisible();
  await expect(sharedSection.getByRole("listitem").filter({ hasText: unlistedName }).getByText("Unlisted", { exact: true })).toBeVisible();
  await expect(browserSection.getByRole("heading", { name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: test.info().outputPath("my-decks.png"), fullPage: true });

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(accountSection.getByRole("heading", { name: updatedName, exact: true })).toHaveCount(0);
  await expect(sharedSection.getByRole("heading", { name: unlistedName, exact: true })).toHaveCount(0);
  await expect(browserSection.getByRole("heading", { name, exact: true })).toBeVisible();
  expect((await page.request.get("/api/decks/private")).status()).toBe(401);
  await page.goto(`/decks/builder?private=${id}`);
  await expect(page.getByRole("link", { name: "Sign in with Discord", exact: true })).toBeVisible();
  await expect(page.getByLabel("Deck name")).toHaveCount(0);
  await expect(page.getByText(updatedName, { exact: true })).toHaveCount(0);
});

test("a delayed private save cannot reselect cleared work, and keeps edits made during saving", async ({ page }) => {
  await page.goto("/decks/mine");
  await page.getByRole("link", { name: "Sign in with Discord", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  const originalName = `Pending original ${test.info().project.name}`;
  const created = await (await page.request.post("/api/decks/private", {
    data: { name: originalName, cards: ["TestCard1"] },
  })).json();
  await page.goto(`/decks/builder?private=${created.deck.id}`);
  await expect(page.getByLabel("Deck name")).toHaveValue(originalName);

  // The real API saves first; hold only its response so this exercises a late acknowledgement.
  const holdNextSave = async () => {
    let release!: () => void;
    let saved!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const stored = new Promise<void>((resolve) => { saved = resolve; });
    let consumed = false;
    const handler = async (route: Route) => {
      if (consumed || route.request().method() !== "POST") return route.continue();
      consumed = true;
      const response = await route.fetch();
      saved();
      await gate;
      await route.fulfill({ response });
      await page.unroute("**/api/decks/private", handler);
    };
    await page.route("**/api/decks/private", handler);
    return { release, stored };
  };

  const oldSave = await holdNextSave();
  await page.getByRole("button", { name: "Update selected deck", exact: true }).click();
  await oldSave.stored;
  const nextName = `New work ${test.info().project.name}`;
  try {
    await page.getByRole("button", { name: "Clear deck", exact: true }).click();
    await page.getByRole("button", { name: /^Test Card 3, cost/ }).click();
    await page.getByLabel("Deck name").fill(nextName);
  } finally { oldSave.release(); }
  await expect(page.getByRole("status").filter({ hasText: "Previous deck saved privately" })).toBeVisible();
  await expect(page).toHaveURL(/\/decks\/builder$/);
  await expect(page.getByLabel("Deck name")).toHaveValue(nextName);
  await expect(page.getByRole("button", { name: "Update selected deck", exact: true })).toHaveCount(0);
  const saved = (await (await page.request.get("/api/decks/private")).json()).decks;
  expect(saved.find((d: { id: string }) => d.id === created.deck.id)).toMatchObject({ name: originalName, cards: ["TestCard1"] });

  const currentSave = await holdNextSave();
  await page.getByRole("button", { name: "Save new private deck", exact: true }).click();
  await currentSave.stored;
  const editedName = `Still editing ${test.info().project.name}`;
  try {
    await page.getByLabel("Deck name").fill(editedName);
    await page.getByRole("button", { name: /^Test Card 4, cost/ }).click();
  } finally { currentSave.release(); }
  await expect(page.getByRole("status").filter({ hasText: "Saved privately to your account" })).toBeVisible();
  await expect(page).toHaveURL(/\/decks\/builder\?private=/);
  await expect(page.getByLabel("Deck name")).toHaveValue(editedName);
  await expect(page.getByRole("button", { name: "Remove Test Card 4", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update selected deck", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue(editedName);
  await expect(page.getByRole("button", { name: "Remove Test Card 4", exact: true })).toBeVisible();
});
