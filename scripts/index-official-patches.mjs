// Run with downloaded canonical source envelopes; no article bodies are redistributed.
// node scripts/index-official-patches.mjs cards.json locations.json
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { JSDOM } from "jsdom";
const [cardsPath, locationsPath] = process.argv.slice(2);
if (!cardsPath || !locationsPath) throw new Error("Pass card and location reference JSON files");
import { normalize, parseOfficialArticle } from "./lib/official-index.mjs";
const names = [];
for (const [kind, path] of [["cards", cardsPath], ["locations", locationsPath]]) {
  const feed = JSON.parse(await readFile(path, "utf8")).success.cards;
  for (const row of feed) {
    const id = row.carddefid || (kind === "locations" ? "SnapZoneLocation_" + row.cid : "");
    if (id && row.name && row.status === "released") names.push({ kind, id, name: normalize(row.name) });
  }
}
names.sort((a,b) => b.name.length - a.name.length);
async function get(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "SnapHub reference index (+https://snap-hub.app/credits)" } });
    if (r.ok) return r.text();
    if (r.status < 500 || attempt) throw new Error(url + ": HTTP " + r.status);
  }
}
const sitemap = await get("https://marvelsnap.com/wp-sitemap-posts-post-1.xml");
const urls = [...sitemap.matchAll(/<loc>(https:\/\/marvelsnap\.com\/[^<]+)<\/loc>/g)].map(m => m[1]).filter(url => /patch|balance|ota-/i.test(url));
if (urls.length < 50) throw new Error("Incomplete official sitemap");
// RSS publication dates are shown as publication dates, never guessed patch dates.
const publicationDates = new Map();
for (let page = 1; page <= 100; page++) {
  const response = await fetch("https://marvelsnap.com/feed/?paged=" + page, { signal: AbortSignal.timeout(15000) });
  if (response.status === 404) break;
  if (!response.ok) throw new Error("Official RSS: HTTP " + response.status);
  const rss = new JSDOM(await response.text(), {contentType:"text/xml"});
  const items = [...rss.window.document.querySelectorAll("item")];
  if (!items.length) { rss.window.close(); break; }
  let added = 0;
  for (const item of items) {
    const url = item.querySelector("link")?.textContent?.trim();
    const raw = item.querySelector("pubDate")?.textContent?.trim();
    const date = raw ? Date.parse(raw) : NaN;
    if (url && Number.isFinite(date) && !publicationDates.has(url)) {
      publicationDates.set(url, new Date(date).toISOString().slice(0,10)); added++;
    }
  }
  rss.window.close();
  if (!added) break;
  if (page % 10 === 0) console.log("Indexed RSS pages:", page);
  await new Promise(r => setTimeout(r,200));
}
const notes = [];
for (let offset = 0; offset < urls.length; offset += 2) {
  for (const note of await Promise.all(urls.slice(offset, offset + 2).map(async url => {
    return parseOfficialArticle(await get(url), url, names, publicationDates.get(url) ?? null);
  }))) notes.push(note);
  if (offset % 20 === 0) console.log("Indexed", notes.length, "/", urls.length);
  await new Promise(r => setTimeout(r,250));
}
notes.sort((a,b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title));
await mkdir("src/lib/wiki/data", {recursive:true});
await writeFile("src/lib/wiki/data/official-patches.json", JSON.stringify({ indexedAt: new Date().toISOString(), articleCount: notes.length, notes }) + "\n");
console.log("Complete:",notes.length,"articles;",notes.filter(n=>!n.date).length,"without an explicit year/date");
// Print the most-mentioned names so a match on an ordinary English word is visible before the
// file is trusted. The card named Random once led this list with 55 of 139 articles, ahead of
// Thanos, and nothing in the run said so.
const counts = new Map();
for (const note of notes) for (const m of note.mentions) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
console.log("Most mentioned:", [...counts].sort((a,b) => b[1]-a[1]).slice(0,10)
  .map(([id,n]) => `${id} ${n} (${Math.round(100*n/notes.length)}%)`).join(", "));
