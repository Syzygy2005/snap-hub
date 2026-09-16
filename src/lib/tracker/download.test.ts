import { describe, expect, it } from "vitest";
import { LAUNCHER_NAME, SCRIPT_NAME, trackerBundle } from "./download";

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

  it("checks for the script before calling PowerShell, and says what to do when it's absent", () => {
    // Windows runs a .cmd double-clicked from inside a zip out of a temp folder on its own,
    // so the guard has to come before the line that would otherwise fail with a temp path.
    const guard = launcher.indexOf(`if not exist "%~dp0${SCRIPT_NAME}" goto notunpacked`);
    const run = launcher.indexOf("powershell -NoProfile");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(run);
    expect(launcher).toContain("\r\n:notunpacked\r\n");
    expect(launcher).toContain("Extract All");
    // The guard branch must be reachable only by the goto, never fallen into.
    expect(launcher.slice(run, guard + launcher.slice(guard).indexOf(":notunpacked"))).toContain("exit /b");
  });

  it("warns that the folder carries a live key", () => {
    expect(launcher).toContain("could upload");
    expect(String(byName["README.txt"])).toContain("Do not send it to anyone");
  });
});
