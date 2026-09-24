// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WikiArt } from "./wiki-art";
import { RETRY_MS } from "./retry-image";

const ART = "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/a.webp?v=3";
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const img = () => host.querySelector("img");
const fail = () => act(() => { img()!.dispatchEvent(new Event("error")); });

it("loads the art through /art", () => {
  act(() => root.render(<WikiArt name="Abomination" art={ART} />));
  expect(img()?.getAttribute("src")).toBe("/art/wp-content/themes/blocksy-child/assets/media/cards/a.webp?v=3");
});

it("tries once more after a pause, with a fresh image, before giving up", () => {
  act(() => root.render(<WikiArt name="Abomination" art={ART} />));
  const first = img();
  fail();
  // While it waits there is no broken image and no "unavailable" either.
  expect(img()).toBeNull();
  expect(host.textContent).not.toContain("Artwork unavailable");
  act(() => { vi.advanceTimersByTime(RETRY_MS); });
  // A new element, which is what makes the browser ask the server again.
  expect(img()).not.toBeNull();
  expect(img()).not.toBe(first);
  fail();
  expect(img()).toBeNull();
  expect(host.textContent).toContain("Artwork unavailable");
});

it("keeps the art when the second try loads", () => {
  act(() => root.render(<WikiArt name="Abomination" art={ART} />));
  fail();
  act(() => { vi.advanceTimersByTime(RETRY_MS); });
  expect(img()?.getAttribute("alt")).toBe("Abomination");
  expect(host.textContent).not.toContain("Artwork unavailable");
});

it("does not retry when there is no art at all", () => {
  act(() => root.render(<WikiArt name="Mother Mold" art="" />));
  expect(img()).toBeNull();
  expect(host.textContent).toContain("Artwork unavailable");
});
