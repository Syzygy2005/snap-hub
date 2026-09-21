import { describe, expect, it } from "vitest";
import { parseVariants } from "./variants";

// Actual canonical feed fields for Hulk's first variant; no copied article text.
const hulk = {
  cid: 101, vid: 4831,
  art: "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/101_166025444242.webp?v=1090",
  variant_order: "01", status: "Released", rarity: "Rare", sketcher: "G-Angle",
  inker: "", colorist: "G-Angle", ReleaseDate: 1651950000, CollectorsQualityDefId: "",
};

describe("variant feed normalization", () => {
  it("preserves provider IDs, artist roles and metadata without guessing a category", () => {
    expect(parseVariants([hulk], 101)).toEqual([{
      id: "4831", art: hulk.art, order: "01", status: "released", rarity: "Rare",
      artists: [{ role: "Sketch", name: "G-Angle" }, { role: "Color", name: "G-Angle" }],
      releaseDate: "2022-05-07", collectorQuality: null,
    }]);
    expect(parseVariants(undefined)).toEqual([]);
    expect(parseVariants([])).toEqual([]);
  });

  it("retains unreleased status and preserves unknown dates instead of publishing 2038", () => {
    for (const ReleaseDate of ["", null, undefined, 0, "0", 2147483647, "2147483647"]) {
      const [variant] = parseVariants([{ ...hulk, status: "Unreleased", ReleaseDate }], 101);
      expect(variant.status).toBe("unreleased");
      expect(variant.releaseDate).toBeNull();
    }
    // Future dates are source metadata, not evidence that a variant is released.
    const [future] = parseVariants([{ ...hulk, status: "Unreleased", ReleaseDate: 1924992000 }], 101);
    expect(future.releaseDate).toBe("2031-01-01");
    expect(future.status).toBe("unreleased");
  });

  it("accepts exact duplicates but refuses conflicting IDs and wrong-parent records", () => {
    expect(parseVariants([hulk, { ...hulk }], 101)).toHaveLength(1);
    expect(() => parseVariants([hulk, { ...hulk, rarity: "Bundle" }], 101)).toThrow("Conflicting");
    expect(() => parseVariants([hulk], 102)).toThrow("identity");
    expect(() => parseVariants([{ ...hulk, vid: "4831" }], 101)).toThrow("identity");
    expect(() => parseVariants([hulk], NaN)).toThrow("parent");
  });

  it("rejects unsafe image URLs and malformed metadata before a sync can overwrite good data", () => {
    for (const art of ["javascript:alert(1)", "http://marvelsnapzone.com/card.webp", "https://evil.test/a.webp",
      hulk.art.replace("marvelsnapzone.com", "marvelsnapzone.com.evil.test"),
      "https://user:password@marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/a.webp",
      "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/../private.webp"]) {
      expect(() => parseVariants([{ ...hulk, art }], 101)).toThrow("artwork");
    }
    for (const invalid of [null, {}, "variants", new Array(501).fill(hulk)])
      expect(() => parseVariants(invalid)).toThrow("list");
    for (const fields of [{ status: "Soon" }, { sketcher: "<script>bad</script>" },
      { rarity: 123 }, { ReleaseDate: "unknown" }, { ReleaseDate: -1 }, { ReleaseDate: 1.2 }])
      expect(() => parseVariants([{ ...hulk, ...fields }], 101)).toThrow();
  });
});
