// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyStats } from "./my-stats";

vi.mock("@/lib/stats/client-key", () => ({
  loadTrackerKey: () => "shk_test-key",
  saveTrackerKey: vi.fn(),
  forgetTrackerKey: vi.fn(),
}));
vi.mock("./relative-time", () => ({ useNow: () => null, formatRelative: () => "just now" }));

let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const loaded = {
  ok: true,
  signedIn: true,
  trackers: [],
  heldKeyLinked: false,
  stats: { window: "30d", tracker: { name: "Player" }, summary: { games: 0, wins: 0, losses: 0, ties: 0, winRate: 0 } },
};
const click = async (label: string) => {
  const button = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === label);
  expect(button).toBeDefined();
  await act(async () => button!.click());
};

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(response(loaded));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<MyStats />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("errors after stats have loaded", () => {
  it("shows linking conflicts without hiding the existing stats", async () => {
    fetchMock.mockResolvedValueOnce(response({ ok: false, error: "That key is already on another account." }, 409));
    await click("Add to my account");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("already on another account");
    expect(host.textContent).toContain("No games yet");
  });

  it("keeps the displayed time range accurate after a failed refresh and allows retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection lost"));
    await click("7 days");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Connection lost");
    expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe("30 days");
    fetchMock.mockResolvedValueOnce(response({ ...loaded, stats: { ...loaded.stats, window: "7d" } }));
    await click("Refresh stats");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe("7 days");
  });

  it("shows network failures during deletion", async () => {
    vi.stubGlobal("confirm", () => true);
    fetchMock.mockRejectedValueOnce(new Error("Offline"));
    await click("Delete my key and all my games");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Couldn't delete your data");
  });
});
