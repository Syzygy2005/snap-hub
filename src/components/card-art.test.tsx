// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardArt } from "./cards";
import { RETRY_MS } from "./retry-image";

const card = { name: "Abomination", art: "https://marvelsnapzone.com/wp-content/themes/blocksy-child/assets/media/cards/a.webp?v=3" };
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

it("deck builder art goes through /art and gets one more try", () => {
  act(() => root.render(<CardArt card={card} className="h-5 w-5" />));
  expect(img()?.getAttribute("src")).toBe("/art/wp-content/themes/blocksy-child/assets/media/cards/a.webp?v=3");
  const first = img();
  fail();
  expect(img()).toBeNull();
  expect(host.querySelector('[aria-label="Abomination: artwork loading"]')).not.toBeNull();
  act(() => { vi.advanceTimersByTime(RETRY_MS); });
  expect(img()).not.toBe(first);
  expect(img()?.getAttribute("alt")).toBe("Abomination");
});

it("names the card when both tries fail, since a deck slot shows no name of its own", () => {
  act(() => root.render(<CardArt card={card} className="h-5 w-5" />));
  fail();
  act(() => { vi.advanceTimersByTime(RETRY_MS); });
  fail();
  const box = host.querySelector('[aria-label="Abomination: artwork unavailable"]');
  expect(box?.textContent).toBe("Abomination");
  // Keeps the caller's size so the deck grid does not reflow around a missing card.
  expect(box?.className).toContain("h-5 w-5");
});
