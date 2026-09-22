import { JSDOM } from "jsdom";
// Case is kept on purpose. Card names are proper nouns and patch notes capitalise them, so
// lowercasing everything made the card named "Random" match "draw a random card" and claim 55
// of 139 articles, more than Thanos. Armor, Storm, Wave and Hope had the same problem smaller.
// The cost is a name written in an all-caps heading no longer matching, which loses a link; a
// false mention puts wrong facts on a card page, so this trades the cheaper error for the
// dearer one, the same way rename detection does.
export const normalize = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, " ").trim();

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const DATE_RE = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(20\d{2})/i;

/**
 * The date written in the title, as a plain calendar date. Built field by field rather than
 * through Date.parse: "September 15 2026" is not an ISO string, so V8 reads it as local
 * midnight, and rendering that back through toISOString moved every patch a day earlier on any
 * machine east of Greenwich. The committed index only looked right because it was generated at
 * a negative offset. Round-tripping through Date.UTC rejects a day the month does not have,
 * which Date.parse would have rolled over into the next month instead.
 * @param {string} text
 */
export function patchDate(text) {
  const match = text.match(DATE_RE);
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase());
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 0 || !day) return null;
  const utc = new Date(Date.UTC(year, month, day));
  if (utc.getUTCMonth() !== month || utc.getUTCDate() !== day) return null;
  return utc.toISOString().slice(0, 10);
}

/** @param {string} html @param {string} url @param {{kind:string,id:string,name:string}[]} names @param {string|null} publishedAt */
export function parseOfficialArticle(html, url, names, publishedAt = null) {
    const dom = new JSDOM(html);
    const article = dom.window.document.querySelector("article.c-article > .c-article__content");
    const heading = article?.querySelector("header h1") ?? article?.querySelector("h1");
    const title = heading?.textContent?.trim();
    if (!article || !title) throw new Error("Unrecognized official article: " + url);
    // Only the post content: the outer article also contains a Latest sidebar.
    for (const block of article.querySelectorAll("p,li,h1,h2,h3,h4,div,br,td")) { block.before(" "); block.after(" "); }
    let content = " " + normalize(article.textContent ?? "") + " ";
    const mentions = [];
    for (const entry of names) {
      const phrase = " " + entry.name + " ";
      if (!content.includes(phrase)) continue;
      mentions.push({kind:entry.kind, id:entry.id});
      // Prefer complete names: She-Hulk must not also match Hulk.
      content = content.split(phrase).join(" ");
    }
    // The slug carries the date for titles that omit the year, and DATE_RE is case-insensitive.
    const date = patchDate(title + " " + url.replaceAll("-", " "));
    dom.window.close();
    return {title, url, date, publishedAt: publishedAt, mentions};
}
