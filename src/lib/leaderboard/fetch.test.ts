import { afterEach, expect, it, vi } from "vitest";
import { fetchBoard } from "./fetch";

afterEach(() => vi.unstubAllGlobals());
const ref = { year: 2026, month: 10 };

it("reports HTTP and non-JSON upstream failures as errors rather than absent seasons", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ playerName: "Alpha", rank: 0, score: 9000 }] }), { status: 503 }))
    .mockResolvedValueOnce(new Response("<html>PHP warning</html>"));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchBoard(ref, "global")).toMatchObject({ ok: false, reason: "error", detail: "Source returned HTTP 503" });
  expect(await fetchBoard(ref, "global")).toMatchObject({ ok: false, reason: "error", detail: "Non-JSON response (200)" });
});

it("keeps an empty or unpublished new season distinct from a failed source", async () => {
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [] }))
    .mockResolvedValueOnce(Response.json({ code: "invalid_month" }, { status: 400 })));
  expect(await fetchBoard(ref, "global")).toMatchObject({ ok: false, reason: "unavailable", detail: "Empty board" });
  expect(await fetchBoard(ref, "global")).toMatchObject({ ok: false, reason: "unavailable", detail: "invalid_month" });
});

it("fails the whole board on any malformed row instead of dropping it", async () => {
  const good = { rank: 0, playerName: "Alpha", score: 9000 };
  const cases: [unknown, string][] = [
    [{ ...good, rank: 1, score: "8990" }, 'row 1 has score "8990"'],
    // Read as a number this would have been rank "101": "10" + 1.
    [{ ...good, rank: "10" }, 'row 1 has rank "10"'],
    [{ ...good, rank: 1.5 }, "row 1 has rank 1.5"],
    [{ rank: 1, score: 8990 }, "row 1 has playerName undefined"],
    [null, "row 1 is null"],
  ];
  for (const [row, detail] of cases) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ total: 2, results: [good, row] })));
    expect(await fetchBoard(ref, "global")).toEqual({ ok: false, reason: "error", detail: `Malformed board: 1 of 2 rows, first ${detail}` });
  }
});

it("reads a well-formed board as 1-based ranks in order", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ total: 2, results: [
    { rank: 1, playerName: "Bravo", score: 8990 },
    { rank: 0, playerName: "Alpha", score: 9000 },
  ] })));
  expect(await fetchBoard(ref, "global")).toEqual({ ok: true, total: 2, entries: [
    { rank: 1, name: "Alpha", score: 9000 },
    { rank: 2, name: "Bravo", score: 8990 },
  ] });
});
