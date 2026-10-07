import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { normalize, parseOfficialArticle, patchDate } from "../../../scripts/lib/official-index.mjs";
const names = [
  {kind:"cards",id:"SheHulk",name:normalize("She-Hulk")},
  {kind:"cards",id:"Hulk",name:normalize("Hulk")},
  {kind:"cards",id:"Random",name:normalize("Random")},
  {kind:"locations",id:"Asgard",name:normalize("Asgard")},
];
const article = (body: string, title = "Patch Notes - March 21, 2023") =>
  `<article class="c-article"><div class="c-article__content"><header><h1>${title}</h1></header>${body}</div></article>`;
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
  it("does not read a card name out of an ordinary English word", () => {
    // The card named Random was credited with 55 of 139 official articles, more than Thanos,
    // because matching lowercased everything and every patch note says "random" somewhere.
    const prose = parseOfficialArticle(article("<p>Hulk now draws a random card.</p>"), "https://marvelsnap.com/p-march-21-2023/", names);
    expect(prose.mentions).toEqual([{kind:"cards",id:"Hulk"}]);
    // The card itself is still found when the article actually names it.
    const real = parseOfficialArticle(article("<p>Random: ability reworked.</p>"), "https://marvelsnap.com/p-march-21-2023/", names);
    expect(real.mentions).toEqual([{kind:"cards",id:"Random"}]);
  });

  it("reports names that only match with case ignored, without counting them as mentions", () => {
    const res = parseOfficialArticle(article("<p>Hulk now draws a random card. She-Hulk too.</p>"), "https://marvelsnap.com/p-march-21-2023/", names);
    expect(res.mentions).toEqual([{kind:"cards",id:"SheHulk"},{kind:"cards",id:"Hulk"}]);
    expect(res.caseOnly.map((c: {id: string}) => c.id)).toEqual(["Random"]);
    expect(res.caseOnly[0].text).toContain("draws a random card");
  });

  it("lets small words change case and accepts an all-caps heading, nothing else", () => {
    // Each of these lost a real link in the index run of 7 October 2026.
    const more = [
      {kind:"cards",id:"WerewolfByNight",name:normalize("Werewolf By Night")},
      {kind:"cards",id:"MorganLeFay",name:normalize("Morgan le Fay")},
      {kind:"cards",id:"SilverSamurai",name:normalize("Silver Samurai")},
      {kind:"cards",id:"Hood",name:normalize("The Hood")},
      ...names,
    ];
    const res = parseOfficialArticle(article(
      "<p>Destroyed cards like Morgan Le Fay. Werewolf by Night is back.</p><h3>SILVER SAMURAI</h3><p>Old 4/5. A big change under the hood, and a random card.</p>"),
      "https://marvelsnap.com/p-march-21-2023/", more);
    expect(res.mentions.map((m: {id: string}) => m.id)).toEqual(["WerewolfByNight", "MorganLeFay", "SilverSamurai"]);
    expect(res.lenient.map((m: {id: string}) => m.id)).toEqual(["WerewolfByNight", "MorganLeFay", "SilverSamurai"]);
    expect(res.lenient[1].text).toContain("Morgan Le Fay");
    // The words that carry a name keep their case, so these are still only case-insensitive hits.
    expect(res.caseOnly.map((c: {id: string}) => c.id)).toEqual(["Hood", "Random"]);
  });

  it("keeps the case of a leading The", () => {
    // Relaxing it linked The Collector to "the Collector's Vault", a menu screen, in 3 real
    // articles (index run of 7 October 2026).
    const more = [
      {kind:"cards",id:"TheCollector",name:normalize("The Collector")},
      {kind:"cards",id:"Uatu",name:normalize("Uatu the Watcher")},
    ];
    const res = parseOfficialArticle(article("<p>Repositioned the X on the Collector's Vault screen. Fixed Uatu The Watcher's effect.</p>"),
      "https://marvelsnap.com/p-march-21-2023/", more);
    // A "the" inside a name still relaxes.
    expect(res.mentions.map((m: {id: string}) => m.id)).toEqual(["Uatu"]);
    expect(res.caseOnly.map((c: {id: string}) => c.id)).toEqual(["TheCollector"]);
  });

  it("does not report an exact match as lenient", () => {
    const res = parseOfficialArticle(article("<p>She-Hulk and HULK.</p>"), "https://marvelsnap.com/p-march-21-2023/", names);
    expect(res.mentions.map((m: {id: string}) => m.id)).toEqual(["SheHulk", "Hulk"]);
    expect(res.lenient.map((m: {id: string}) => m.id)).toEqual(["Hulk"]);
  });

  it("reads the patch date without going through a local-time parse", () => {
    expect(patchDate("Patch Notes - September 15th, 2026")).toBe("2026-09-15");
    expect(patchDate("Patch Notes - March 21, 2023")).toBe("2023-03-21");
    // Date.parse would have rolled this into March; a date the month has not got is no date.
    expect(patchDate("Patch Notes - February 30, 2026")).toBeNull();
    expect(patchDate("May 25th OTA")).toBeNull();
    // CI and the machine this was generated on are both at or west of UTC, where reading
    // "September 15 2026" as local midnight still renders as the 15th. East of Greenwich it
    // rendered as the 14th, so the only check that can catch a regression runs in that zone.
    const east = execFileSync(process.execPath, ["-e",
      'import("./scripts/lib/official-index.mjs").then(m=>process.stdout.write(String(m.patchDate("Patch Notes - September 15th, 2026"))))',
    ], { env: { ...process.env, TZ: "Asia/Tokyo" }, encoding: "utf8" });
    expect(east).toBe("2026-09-15");
  });

  it("rejects unexpected source markup", () => {
    expect(() => parseOfficialArticle("<html>Blocked</html>", "https://marvelsnap.com/test/", names)).toThrow("Unrecognized");
  });
});

