import { describe, expect, it } from "vitest";
import { decodeDeckInput, encodeDeck, gameClipboardText, shortToken } from "./code";

const cards = [
  { defId: "AntMan", name: "Ant Man", cost: 1 },
  { defId: "Sunspot", name: "Sunspot", cost: 1 },
  { defId: "MisterNegative", name: "Mister Negative", cost: 4 },
  { defId: "Thanos", name: "Thanos", cost: 6 },
];

describe("deck codes", () => {
  it("round-trips the long format with a name", () => {
    const code = encodeDeck(["AntMan", "Thanos"], "Björn’s deck");
    expect(decodeDeckInput(code, cards)).toEqual({
      name: "Björn’s deck",
      defIds: ["AntMan", "Thanos"],
      unresolved: [],
    });
  });

  it("decodes unpadded long codes and reports unknown cards", () => {
    const json = JSON.stringify({ Name: "Thanos", Cards: [{ CardDefId: "AntMan" }, { CardDefId: "Mystery" }] });
    const code = Buffer.from(json).toString("base64").replace(/=+$/, ""); // unpadded, as some sites share them
    expect(decodeDeckInput(code, cards)).toEqual({ name: "Thanos", defIds: ["AntMan"], unresolved: ["Mystery"] });
  });

  it("builds short tokens by dropping vowels and appending length", () => {
    expect(shortToken("Sunspot")).toBe("Snspt7");
  });

  it("decodes the short format", () => {
    const code = Buffer.from(["Snspt7", "MstrNgtv14", "Thns6"].join(",")).toString("base64");
    expect(decodeDeckInput(code, cards)?.defIds).toEqual(["Sunspot", "MisterNegative", "Thanos"]);
  });

  it("reads the game's clipboard text and plain card lists", () => {
    const text = gameClipboardText(cards, "Test");
    expect(text.split("\n")[0]).toBe("# (1) Ant Man");
    expect(decodeDeckInput(text, cards)?.defIds).toHaveLength(4);

    const list = "# (1) ant man\n# (6) THANOS\n# (3) Nobody";
    expect(decodeDeckInput(list, cards)).toEqual({ name: null, defIds: ["AntMan", "Thanos"], unresolved: ["Nobody"] });
  });

  it("rejects junk", () => {
    expect(decodeDeckInput("hello there", cards)).toBeNull();
  });
});
