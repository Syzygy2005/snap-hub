import { expect, it } from "vitest";
import { WIKI_GROUPS, WIKI_SECTIONS, wikiSectionPath } from "./sections";

it("groups each canonical wiki section exactly once", () => {
  const grouped = WIKI_GROUPS.flatMap((g) => g.hrefs);
  expect(new Set(grouped).size).toBe(grouped.length);
  expect([...grouped].sort()).toEqual(WIKI_SECTIONS.map((s) => s.href).sort());
});

it("recognizes detail routes without confusing similarly named paths", () => {
  expect(wikiSectionPath("/wiki/cards/TestCard1")).toBe("/wiki/cards");
  expect(wikiSectionPath("/wiki/artists/Test%20Artist")).toBe("/wiki/artists");
  expect(wikiSectionPath("/wiki/archetypes/destroy")).toBe("/wiki/archetypes");
  expect(wikiSectionPath("/wiki/cards-extra")).toBe("/wiki");
});
