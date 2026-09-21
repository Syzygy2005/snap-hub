import { describe, expect, it } from "vitest";
import { normalize, parseOfficialArticle } from "../../../scripts/lib/official-index.mjs";
const names = [
  {kind:"cards",id:"SheHulk",name:normalize("She-Hulk")},
  {kind:"cards",id:"Hulk",name:normalize("Hulk")},
  {kind:"locations",id:"Asgard",name:normalize("Asgard")},
];
describe("official patch index", () => {
  it("excludes the latest-news sidebar and prefers complete names", () => {
    const html = '<article class="c-article"><div class="c-article__content"><header><h1>Patch Notes - March 21, 2023</h1></header><p>She-Hulk: Power reduced.</p></div><aside><article>Asgard and Hulk</article></aside></article>';
    const result = parseOfficialArticle(html, "https://marvelsnap.com/patch-notes-march-21-2023/", names);
    expect(result.mentions).toEqual([{kind:"cards",id:"SheHulk"}]);
    expect(result.date).toBe("2023-03-21");
  });
  it("does not invent a patch year from publication metadata", () => {
    const html = '<article class="c-article"><div class="c-article__content"><h1>May 25th OTA</h1><p>Asgard</p></div></article>';
    const result = parseOfficialArticle(html, "https://marvelsnap.com/may-25th-ota/", names, "2023-05-25");
    expect(result.date).toBeNull();
    expect(result.publishedAt).toBe("2023-05-25");
  });
  it("rejects unexpected source markup", () => {
    expect(() => parseOfficialArticle("<html>Blocked</html>", "https://marvelsnap.com/test/", names)).toThrow("Unrecognized");
  });
});

