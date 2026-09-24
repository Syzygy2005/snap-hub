// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ScrollToHash } from "./scroll-to-hash";

let host: HTMLDivElement;
let root: Root;
let scrolled: string[];

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id); };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); history.replaceState(null, "", "/"); vi.unstubAllGlobals(); });

// jsdom lays nothing out, so every element reads as sitting at the top of the viewport.
const offscreen = (el: Element) => { el.getBoundingClientRect = () => ({ top: 5000 } as DOMRect); };

it("scrolls to a variant that streamed in after the browser looked for it", () => {
  history.replaceState(null, "", "/wiki/cards/X#variant-4831");
  host.innerHTML = '<article id="variant-4831"></article>';
  offscreen(host.firstElementChild!);
  const mount = document.createElement("div");
  host.append(mount);
  act(() => { createRoot(mount).render(<ScrollToHash prefix="variant-" />); });
  expect(scrolled).toEqual(["variant-4831"]);
});

it("finds an id that was percent-encoded in the link", () => {
  history.replaceState(null, "", "/wiki/cards/X#variant-a%20b");
  const el = document.createElement("article");
  el.id = "variant-a b";
  offscreen(el);
  document.body.append(el);
  act(() => root.render(<ScrollToHash prefix="variant-" />));
  expect(scrolled).toEqual(["variant-a b"]);
  el.remove();
});

it("opens the unreleased disclosure when the target is inside it", () => {
  history.replaceState(null, "", "/wiki/cards/X#variant-9");
  host.innerHTML = '<details><summary>Unreleased</summary><article id="variant-9"></article></details>';
  const mount = document.createElement("div");
  host.append(mount);
  act(() => { createRoot(mount).render(<ScrollToHash prefix="variant-" />); });
  expect(host.querySelector("details")!.open).toBe(true);
  expect(scrolled).toEqual(["variant-9"]);
});

it("leaves the page alone when the target is already on screen, or the hash is not a variant", () => {
  history.replaceState(null, "", "/wiki/cards/X#variant-1");
  host.innerHTML = '<article id="variant-1"></article>';
  const mount = document.createElement("div");
  host.append(mount);
  act(() => { createRoot(mount).render(<ScrollToHash prefix="variant-" />); });
  history.replaceState(null, "", "/wiki/terminology#priority");
  const other = document.createElement("div");
  host.append(other);
  act(() => { createRoot(other).render(<ScrollToHash prefix="variant-" />); });
  expect(scrolled).toEqual([]);
});
