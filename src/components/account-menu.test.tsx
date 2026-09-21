// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";
import PageError from "@/app/error";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/stats/me", useRouter: () => ({ refresh }) }));
let host: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  refresh.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<AccountMenu enabled account={{ id: 1, discordId: "123", username: "Player", avatar: null }} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it.each(["http", "network"])("shows a %s sign-out failure and lets the user retry", async (failure) => {
  if (failure === "http") fetchMock.mockResolvedValueOnce({ ok: false });
  else fetchMock.mockRejectedValueOnce(new Error("Offline"));
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Couldn't sign out");
  expect(refresh).not.toHaveBeenCalled();
  expect(host.querySelector("button")!.disabled).toBe(false);
  fetchMock.mockResolvedValueOnce({ ok: true });
  await act(async () => host.querySelector("button")!.click());
  expect(refresh).toHaveBeenCalledOnce();
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("disables sign-out while the request is pending", async () => {
  let finish!: (value: { ok: boolean }) => void;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelector("button")!.disabled).toBe(true);
  expect(host.querySelector("button")!.textContent).toBe("Signing out…");
  await act(async () => finish({ ok: true }));
  expect(refresh).toHaveBeenCalledOnce();
});

it("offers page recovery without displaying internal error details", async () => {
  const retry = vi.fn();
  await act(async () => root.render(<PageError error={new Error("private database details")} retry={retry} />));
  expect(host.textContent).not.toContain("private database details");
  expect(host.querySelector('a')?.getAttribute("href")).toBe("/");
  await act(async () => host.querySelector("button")!.click());
  expect(retry).toHaveBeenCalledOnce();
});
