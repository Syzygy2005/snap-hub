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
