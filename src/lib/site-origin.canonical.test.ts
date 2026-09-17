import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalOrigin } from "./site-origin";

const req = (headers: Record<string, string> = {}) =>
  new Request("http://localhost:3100/api/auth/discord", { headers });

afterEach(() => vi.unstubAllEnvs());

describe("canonicalOrigin", () => {
  it("uses SITE_URL above everything else", () => {
    vi.stubEnv("SITE_URL", "https://snap-hub.app");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "snap-hub.vercel.app");
    expect(canonicalOrigin(req({ "x-forwarded-host": "www.snap-hub.app", "x-forwarded-proto": "https" }))).toBe(
      "https://snap-hub.app",
    );
  });

  it("falls back to the production domain Vercel names, which carries no scheme", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "snap-hub.app");
    expect(canonicalOrigin(req())).toBe("https://snap-hub.app");
  });

  it("keeps only the origin, dropping any path or query pasted in by mistake", () => {
    vi.stubEnv("SITE_URL", "https://snap-hub.app/decks?x=1");
    expect(canonicalOrigin(req())).toBe("https://snap-hub.app");
  });

  it("drops a trailing slash", () => {
    vi.stubEnv("SITE_URL", "https://snap-hub.app/");
    expect(canonicalOrigin(req())).toBe("https://snap-hub.app");
  });

  it("keeps a port when one is given, which is how a local override works", () => {
    vi.stubEnv("SITE_URL", "http://localhost:3100");
    expect(canonicalOrigin(req())).toBe("http://localhost:3100");
  });

  it("ignores a value that isn't a usable http origin", () => {
    // "not a url" reaches here as "notaurl", because cleanEnv strips the spaces out.
    for (const bad of ["javascript:alert(1)", "javascript://alert(1)", "not a url", "ftp://snap-hub.app", "snap-hub"]) {
      vi.stubEnv("SITE_URL", bad);
      expect(canonicalOrigin(req({ host: "snap-hub.app" }))).toBe("http://snap-hub.app");
    }
  });

  it("falls back to the address the request arrived on when nothing is configured", () => {
    expect(canonicalOrigin(req({ "x-forwarded-host": "www.snap-hub.app", "x-forwarded-proto": "https" }))).toBe(
      "https://www.snap-hub.app",
    );
  });
});
