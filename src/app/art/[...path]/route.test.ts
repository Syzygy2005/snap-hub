import { afterEach, expect, it, vi } from "vitest";
import { artPause } from "@/lib/art";
import { GET } from "./route";

const path = ["wp-content", "themes", "blocksy-child", "assets", "media", "cards", "a.webp"];
const call = (query = "?v=7", segments = path) =>
  GET(new Request(`https://snap-hub.test/art/${segments.join("/")}${query}`), { params: Promise.resolve({ path: segments }) });
const image = (type = "image/webp") => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": type } });

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("passes the image through and lets the CDN keep a versioned one", async () => {
  const fetcher = vi.fn().mockResolvedValue(image());
  vi.stubGlobal("fetch", fetcher);
  const res = await call();
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/webp");
  expect(res.headers.get("cache-control")).toContain("s-maxage=31536000");
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  expect(fetcher.mock.calls[0][0]).toBe(`https://marvelsnapzone.com/${path.join("/")}?v=7`);
});

it("asks once more after a refusal, and never caches a failure", async () => {
  // The refusals visitors were seeing: 403s from the source on some loads and not others.
  const wait = vi.spyOn(artPause, "wait").mockResolvedValue();
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("no", { status: 403 })).mockResolvedValueOnce(image());
  vi.stubGlobal("fetch", fetcher);
  expect((await call()).status).toBe(200);
  expect(wait).toHaveBeenCalledTimes(1);

  fetcher.mockReset().mockResolvedValue(new Response("no", { status: 403 }));
  const refused = await call();
  expect(refused.status).toBe(502);
  expect(refused.headers.get("cache-control")).toBe("no-store");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not retry a missing file", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("gone", { status: 404 }));
  vi.stubGlobal("fetch", fetcher);
  const res = await call();
  expect(res.status).toBe(404);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("refuses anything that is not a bitmap, including SVG, which could carry script", async () => {
  vi.spyOn(artPause, "wait").mockResolvedValue();
  for (const type of ["image/svg+xml", "text/html"]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(image(type)));
    expect((await call()).status).toBe(502);
  }
});

it("fetches nothing for a path outside the art directory", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect((await call("", ["wp-content", "uploads", "a.webp"])).status).toBe(404);
  expect((await call("?url=https://evil.test")).status).toBe(404);
  expect(fetcher).not.toHaveBeenCalled();
});
