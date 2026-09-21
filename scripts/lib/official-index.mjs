import { JSDOM } from "jsdom";
export const normalize = s => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    const dateText = (title + " " + url.replaceAll("-", " ")).match(/(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}/i)?.[0];
    const parsed = dateText ? Date.parse(dateText.replace(/(\d)(st|nd|rd|th)/g, "$1")) : NaN;
    const date = Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0,10) : null;
    dom.window.close();
    return {title, url, date, publishedAt: publishedAt, mentions};
}
