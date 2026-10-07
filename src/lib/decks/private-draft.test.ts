import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readPrivateDraft, writePrivateDraft } from "./private-draft";

let storage: Map<string, string>;
const draft = { name: "Unsaved private plan", deck: ["AntMan"], sourceUpdatedAt: "2026-10-07T12:00:00.000Z" };
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("recovers only the matching account and private deck without touching generic autosave", () => {
  localStorage.setItem("snaphub:deck-draft", "unrelated browser work");
  expect(writePrivateDraft(1, "deck-a", draft)).toBe(true);
  expect(readPrivateDraft(1, "deck-a")).toEqual(draft);
  expect(readPrivateDraft(2, "deck-a")).toBeNull();
  expect(readPrivateDraft(1, "deck-b")).toBeNull();
  expect(localStorage.getItem("snaphub:deck-draft")).toBe("unrelated browser work");
});

it("clears saved recovery without deleting another deck's unsaved work", () => {
  writePrivateDraft(1, "deck-a", draft);
  writePrivateDraft(1, "deck-b", { ...draft, name: "Other work" });
  expect(writePrivateDraft(1, "deck-a", null)).toBe(true);
  expect(readPrivateDraft(1, "deck-a")).toBeNull();
  expect(readPrivateDraft(1, "deck-b")?.name).toBe("Other work");
});

it("tolerates corrupt recovery and reports blocked storage so reload can be guarded", () => {
  for (const value of ["bad json", "null", '{"name":"x","deck":[1],"sourceUpdatedAt":"now"}']) {
    localStorage.setItem("snaphub:private-draft:1:deck-a", value);
    expect(readPrivateDraft(1, "deck-a")).toBeNull();
  }
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } });
  expect(readPrivateDraft(1, "deck-a")).toBeNull();
  expect(writePrivateDraft(1, "deck-a", draft)).toBe(false);
});
