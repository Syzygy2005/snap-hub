import { test, expect, type Page } from "@playwright/test";

// Opening a deck from a link (a browser save, a shared deck, a pasted code) used to load the
// link's original on every load, and the autosave then wrote that original over the draft, so
// a reload threw unsaved edits away. Phones reload a tab they put to sleep, so switching to the
// game to try a deck counts as a reload.

const inDeck = (page: Page, n: number) => page.getByRole("button", { name: `Remove Test Card ${n}`, exact: true });
const restored = (page: Page) => page.getByText("Restored your unsaved edits", { exact: false });
const code = (n: number) => encodeURIComponent(Buffer.from(JSON.stringify({ Cards: [{ CardDefId: `TestCard${n}` }] })).toString("base64"));

interface Start { name: string; cards: number[] }

/** Renames the deck and toggles one card (removed if the original has it, added if not), then reloads. */
async function editAndReload(page: Page, original: Start, toggle: number) {
  const removing = original.cards.includes(toggle);
  await expect(page.getByLabel("Deck name")).toHaveValue(original.name);
  for (const n of original.cards) await expect(inDeck(page, n)).toBeVisible();
  await page.getByLabel("Deck name").fill("Edited name");
  if (removing) await inDeck(page, toggle).click();
  else await page.getByRole("button", { name: new RegExp(`^Test Card ${toggle}, cost`) }).click();
  await expect(inDeck(page, toggle)).toHaveCount(removing ? 0 : 1);
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue("Edited name");
  await expect(inDeck(page, toggle)).toHaveCount(removing ? 0 : 1);
  await expect(restored(page)).toBeVisible();
}

async function discardEdits(page: Page, original: Start, toggle: number) {
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Discard edits", exact: true }).click();
  await expect(page.getByLabel("Deck name")).toHaveValue(original.name);
  for (const n of original.cards) await expect(inDeck(page, n)).toBeVisible();
  if (!original.cards.includes(toggle)) await expect(inDeck(page, toggle)).toHaveCount(0);
  // Discarding is a real choice: another reload opens the original, not the edits.
  await page.reload();
  await expect(page.getByLabel("Deck name")).toHaveValue(original.name);
  await expect(restored(page)).toHaveCount(0);
}

async function saveToBrowser(page: Page, name: string, card: number) {
  await page.goto("/decks/builder");
  await page.getByRole("button", { name: new RegExp(`^Test Card ${card}, cost`) }).click();
  await page.getByLabel("Deck name").fill(name);
  await page.getByRole("button", { name: "Save to browser", exact: true }).click();
  return page.evaluate((n) => (JSON.parse(localStorage.getItem("snaphub:decks")!) as { id: string; name: string }[]).find((d) => d.name === n)!.id, name);
}

test("a reload keeps unsaved edits to a deck saved in this browser", async ({ page }) => {
  const id = await saveToBrowser(page, "Saved name", 1);
  await page.goto(`/decks/builder?local=${id}`);
  const original = { name: "Saved name", cards: [1] };
  await editAndReload(page, original, 5);
  // The saved copy itself is untouched until the person saves.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("snaphub:decks")!)[0].name)).toBe("Saved name");
  await discardEdits(page, original, 5);
});

test("saving to the browser makes a reload reopen that save", async ({ page }) => {
  const id = await saveToBrowser(page, "Reopened after save", 2);
  await expect(page).toHaveURL(new RegExp(`local=${id}`));
});

test("a reload keeps unsaved edits to a shared deck or a pasted code", async ({ page }) => {
  // A shared deck is a full one; the edit takes a card out.
  const name = `Shared start ${test.info().project.name}`;
  const cards = Array.from({ length: 12 }, (_, i) => i + 1);
  const shared = await page.request.post("/api/decks", { data: { name, cards: cards.map((n) => `TestCard${n}`), listed: false } });
  expect(shared.ok()).toBe(true);
  const { id } = await shared.json();
  await page.goto(`/decks/builder?deck=${id}`);
  await editAndReload(page, { name, cards }, 12);
  await discardEdits(page, { name, cards }, 12);

  await page.goto(`/decks/builder?code=${code(3)}`);
  await editAndReload(page, { name: "", cards: [3] }, 5);
});

test("opening a different link still starts from that link, not the last draft", async ({ page }) => {
  await page.goto(`/decks/builder?code=${code(3)}`);
  await page.getByRole("button", { name: /^Test Card 5, cost/ }).click();
  await page.goto(`/decks/builder?code=${code(4)}`);
  await expect(inDeck(page, 4)).toBeVisible();
  await expect(inDeck(page, 5)).toHaveCount(0);
  await expect(restored(page)).toHaveCount(0);
});

test("saving in two tabs keeps both decks", async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  // Both open before either saves, so each starts from the same empty list.
  await first.goto("/decks/builder");
  await second.goto("/decks/builder");

  await first.getByRole("button", { name: /^Test Card 1, cost/ }).click();
  await first.getByLabel("Deck name").fill("Deck from tab one");
  await first.getByRole("button", { name: "Save to browser", exact: true }).click();

  await second.getByRole("button", { name: /^Test Card 2, cost/ }).click();
  await second.getByLabel("Deck name").fill("Deck from tab two");
  await second.getByRole("button", { name: "Save to browser", exact: true }).click();

  const names = await second.evaluate(() => (JSON.parse(localStorage.getItem("snaphub:decks")!) as { name: string }[]).map((d) => d.name).sort());
  expect(names).toEqual(["Deck from tab one", "Deck from tab two"]);
  // The other tab's list catches up without a reload.
  await first.getByRole("button", { name: /^Browser decks/ }).click();
  await expect(first.getByRole("button", { name: "Delete Deck from tab two", exact: true })).toBeVisible();
});
