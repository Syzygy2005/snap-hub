import { afterEach, describe, expect, it, vi } from "vitest";
import { locationRate, parseLocationRate } from "./location-rates";

// Public SnapVault /locations data-frame structure and sample, checked 2026-09-21.
// Unrelated reference text and artwork are omitted; both counts come from the same response.
const sourceRows = [
  { id: "Asgard", name: "Asgard", abilities: ["Move"], games30d: 11431 },
  { id: "Ego", name: "Ego", abilities: ["Play Hand"], games30d: 936 },
  { id: "DistrictX", name: "District X", abilities: ["Add Card to Deck", "Discard"], games30d: 0 },
];
const frame = (rows: unknown = sourceRows, total: unknown = 517969) => `37:${JSON.stringify(["$", "$L38", null, { data: { locations: rows, abilities: [], totalGames30d: total, cached: true } }])}\n`;
const script = (value: string) => `<script>self.__next_f.push(${JSON.stringify([1, value])})</script>`;
const sample = "<p>222 locations. Play rates come from 517,969 tracked ranked and Conquest games over the last 30 days.</p>";
const page = (data = frame()) => `<html><body>${sample}${script(data)}</body></html>`;
const response = (html: string, init: ResponseInit = {}) => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" }, ...init });

afterEach(() => vi.unstubAllGlobals());

describe("observed location appearance", () => {
  it("uses matching IDs and a consistent 30-day sample, retaining explicit zero counts", () => {
    expect(parseLocationRate(page(), "Asgard")).toEqual({ games: 11431, totalGames: 517969, percent: 11431 / 517969 * 100, url: "https://www.snapvault.app/locations/Asgard" });
    expect(parseLocationRate(page(), "Ego")?.games).toBe(936);
    expect(parseLocationRate(page(), "DistrictX")?.percent).toBe(0);
    expect(parseLocationRate(page(), "MissingLocation")).toBeNull();
    expect(parseLocationRate(page(), "asgard")).toBeNull();
  });

  it("accepts split JSON data frames without executing source scripts", () => {
    const data = frame();
    const html = `${sample}${script(data.slice(0, 90))}<script>throw new Error("never execute")</script>${script(data.slice(90))}`;
    expect(parseLocationRate(html, "Asgard")?.games).toBe(11431);
    expect(parseLocationRate(`${sample}<script>self.__next_f.push(alert("unsafe"))</script>`, "Asgard")).toBeNull();
  });

  it("hides rates when the window, denominator, counts, identities, or source structure cannot be verified", () => {
    const invalid = [
      page().replace("last 30 days", "last 7 days"),
      page().replace("ranked and Conquest", "Draft"),
      page().replace("517,969", "600,000"),
      page(frame(sourceRows, 0)),
      page(frame(sourceRows, "517969")),
      page(frame([...sourceRows, sourceRows[0]])),
      ...[-1, 1.2, 517970, null, "11431"].map(games30d => page(frame([{ id: "Asgard", games30d }]))),
      page(frame([{ id: "Asgard" }])),
      page(frame([{ id: "../Asgard", games30d: 1 }])),
      page('37:["malformed"\n'),
      "<p>Access denied</p>",
    ];
    for (const html of invalid) expect(parseLocationRate(html, "Asgard")).toBeNull();
  });

  it("loads only the public collection with hourly caching and a timeout", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page()));
    vi.stubGlobal("fetch", fetcher);
    expect(await locationRate("Asgard")).toMatchObject({ games: 11431, totalGames: 517969 });
    expect(fetcher).toHaveBeenCalledWith("https://www.snapvault.app/locations", expect.objectContaining({
      next: { revalidate: 3600 }, signal: expect.any(AbortSignal),
      headers: { "User-Agent": "SnapHub location reference (+https://snap-hub.app/credits)" },
    }));
    expect(await locationRate("../Asgard")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("isolates source errors and rejects oversized responses", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response("Unavailable", { status: 503 }))
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce(new Response(page(), { headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(response(" ".repeat(2_000_001)))
      .mockResolvedValueOnce(response(page(), { headers: { "content-type": "text/html", "content-length": "2000001" } }));
    vi.stubGlobal("fetch", fetcher);
    for (let attempt = 0; attempt < 5; attempt++) expect(await locationRate("Asgard")).toBeNull();
  });
});
