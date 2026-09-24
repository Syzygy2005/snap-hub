import { describe, expect, it } from "vitest";
import { artSource, artSrc } from "./art";

const card = "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/101_166025444242.webp?v=1090";
const local = "/art/wp-content/themes/blocksy-child/assets/media/cards/101_166025444242.webp?v=1090";
const back = (src: string) => {
  const url = new URL(src, "https://snap-hub.test");
  return artSource(url.pathname.split("/").slice(2).map(decodeURIComponent), url.searchParams);
};

describe("artSrc", () => {
  it("serves Snap Zone card art through /art, and the route maps it back to the same file", () => {
    expect(artSrc(card)).toBe(local);
    expect(back(local)).toBe(card);
    const unversioned = card.replace("?v=1090", "");
    expect(back(artSrc(unversioned))).toBe(unversioned);
  });

  it("leaves anything outside the art directory as it was", () => {
    for (const art of [
      "", "/brand/emblem.svg", "https://example.com/art.webp",
      "https://marvelsnapzone.com/getinfo/?searchtype=cards",
      "https://marvelsnapzone.com/wp-content/uploads/art.webp",
      "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/a.svg",
      "http://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/a.webp",
      "https://marvelsnapzone.com:8443/wp-content/themes/blocksy-child/assets/media/cards/a.webp",
      "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/a.webp?v=1&x=2",
    ]) expect(artSrc(art)).toBe(art);
  });
});

describe("artSource refuses to fetch anything else", () => {
  const media = ["wp-content", "themes", "blocksy-child", "assets", "media"];
  const none = new URLSearchParams();
  it.each([
    [["wp-content", "uploads", "a.webp"]],
    [[...media]],
    [[...media, "cards", "a.svg"]],
    [[...media, "cards", "a.html"]],
    [[...media, "..", "..", "a.webp"]],
    [[...media, "cards", ".hidden.webp"]],
    [[...media, "cards", "a b.webp"]],
    [[...media, "cards", "a%2F..%2Fb.webp"]],
  ])("%j", (segments) => {
    expect(artSource(segments, none)).toBeNull();
  });
  it("takes no query but a single version", () => {
    const ok = [...media, "cards", "a.webp"];
    expect(artSource(ok, new URLSearchParams("v=12"))).toContain("a.webp?v=12");
    expect(artSource(ok, new URLSearchParams("x=1"))).toBeNull();
    expect(artSource(ok, new URLSearchParams("v=1&v=2"))).toBeNull();
    expect(artSource(ok, new URLSearchParams("v=<script>"))).toBeNull();
  });
});
