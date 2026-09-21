import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DataFreshness } from "./data-freshness";

vi.mock("./relative-time", () => ({ useNow: () => Date.parse("2026-09-21T12:00:00Z"), RelativeTime: () => <span>earlier</span> }));
it("marks checks over three expected intervals old as delayed", () => {
  expect(renderToStaticMarkup(<DataFreshness checkedAt="2026-09-21T11:29:00Z" />)).toContain("Updates delayed");
  expect(renderToStaticMarkup(<DataFreshness checkedAt="2026-09-21T11:50:00Z" />)).toContain("Source checked");
});
it("distinguishes archived and unknown data from stale live data", () => {
  expect(renderToStaticMarkup(<DataFreshness checkedAt={null} />)).toContain("No successful source check");
  const archived = renderToStaticMarkup(<DataFreshness checkedAt="2020-01-01T00:00:00Z" archived />);
  expect(archived).toContain("Archived season");
  expect(archived).not.toContain("delayed");
});
