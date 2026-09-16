import { describe, expect, it } from "vitest";
import { LAUNCHER_NAME, SCRIPT_NAME, siteOrigin, trackerBundle } from "./download";

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

describe("trackerBundle", () => {
  const files = trackerBundle({
    site: "https://snap-hub.test",
    key: "shk_abc123",
    name: "Noah",
    script: Buffer.from("Write-Host 'tracker'\r\n"),
  });
  const byName = Object.fromEntries(files.map((f) => [f.name, f.content]));
  const launcher = String(byName[LAUNCHER_NAME]);

  it("ships the script, a launcher and a readme", () => {
    expect(files.map((f) => f.name)).toEqual([SCRIPT_NAME, LAUNCHER_NAME, "README.txt"]);
  });

  it("puts the site and key in the launcher so nothing has to be pasted", () => {
    expect(launcher).toContain('-Site "https://snap-hub.test"');
    expect(launcher).toContain('-Key "shk_abc123"');
  });

  it("resolves the script next to itself, so the folder can be moved", () => {
    expect(launcher).toContain(`"%~dp0${SCRIPT_NAME}"`);
  });

  it("writes CRLF and plain ASCII, which is what cmd and Notepad expect", () => {
    for (const name of [LAUNCHER_NAME, "README.txt"]) {
      const text = String(byName[name]);
      expect(text.split("\n").length).toBe(text.split("\r\n").length);
      expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text)).toBe(true);
    }
  });

  it("warns that the folder carries a live key", () => {
    expect(launcher).toContain("could upload");
    expect(String(byName["README.txt"])).toContain("Do not send it to anyone");
  });
});
