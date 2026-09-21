import { afterEach, describe, expect, it, vi } from "vitest";
import { cardHistory, parseCardHistory } from "./card-history";
const page = (rows: string) => `<section><h2>History</h2><table><thead><tr><th>Date</th><th>Cost</th><th>Power</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></section>`;
const row = '<tr><td>2025-12-18</td><td>6</td><td>▲ 14</td><td><i>HULK SMASH!</i></td></tr>';
afterEach(() => vi.unstubAllGlobals());
describe("source card history", () => {
  it("extracts stats and safe text, retaining unknown release dates", () => {
    expect(parseCardHistory(page(row + '<tr><td>Released —</td><td>6</td><td>11</td><td>No ability<script>alert(1)</script></td></tr>'))).toEqual([
      {date:"2025-12-18",label:"2025-12-18",cost:6,power:14,description:"HULK SMASH!"},
      {date:null,label:"Released —",cost:6,power:11,description:"No ability"},
    ]);
  });
  it("rejects unexpected markup, dates and stats", () => {
    expect(() => parseCardHistory("<p>Access denied</p>")).toThrow();
    expect(() => parseCardHistory(page(row.replace("2025-12-18","2025-02-30")))).toThrow();
    expect(() => parseCardHistory(page(row.replace("▲ 14","unknown")))).toThrow();
  });
  it("isolates source failures from the current reference", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("Unavailable", {status:503}));
    vi.stubGlobal("fetch",fetcher);
    expect(await cardHistory("Hulk")).toMatchObject({rows:null});
    expect(fetcher.mock.calls[0][1].next.revalidate).toBe(86400);
    expect(await cardHistory("../invalid")).toMatchObject({rows:null});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
