import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-origin";

const req = (headers: Record<string, string> = {}, url = "http://localhost:3100/api/tracker/download") =>
  new Request(url, { headers });

describe("siteOrigin", () => {
  it("prefers the address the proxy says the visitor used", () => {
    expect(siteOrigin(req({ "x-forwarded-host": "snap-hub.vercel.app", "x-forwarded-proto": "https" }))).toBe(
      "https://snap-hub.vercel.app",
    );
  });

  it("falls back to the Host header, then to the request itself", () => {
    expect(siteOrigin(req({ host: "snap-hub.vercel.app" }))).toBe("http://snap-hub.vercel.app");
    expect(siteOrigin(req())).toBe("http://localhost:3100");
  });

  it("takes the first hop when a header was chained", () => {
    expect(siteOrigin(req({ "x-forwarded-host": "snap-hub.vercel.app, inner", "x-forwarded-proto": "https,http" }))).toBe(
      "https://snap-hub.vercel.app",
    );
  });

  it("ignores a host that could break out of the quoted batch argument", () => {
    for (const host of ['evil.com" & calc.exe & "', "evil.com/path", "evil com", ""]) {
      expect(siteOrigin(req({ "x-forwarded-host": host }))).toBe("http://localhost:3100");
    }
  });

  it("ignores a scheme that isn't http or https", () => {
    expect(siteOrigin(req({ "x-forwarded-host": "snap-hub.test", "x-forwarded-proto": "javascript" }))).toBe(
      "http://localhost:3100",
    );
  });
});
