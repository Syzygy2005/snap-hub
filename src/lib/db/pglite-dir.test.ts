import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * With no DATABASE_URL, PGlite wants a directory. A serverless deployment has no writable
 * one, so a preview built after DATABASE_URL was scoped away from it would have died on the
 * mkdir on every request. It falls back to memory instead, loudly.
 */

const load = async () => (await import("./index")).__test.pgliteDir();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("where PGlite stores its files", () => {
  it("passes a URL-shaped value straight through, without touching the disk", async () => {
    for (const value of ["memory://", "idb://snaphub"]) {
      vi.stubEnv("PGLITE_DIR", value);
      expect(await load()).toBe(value);
    }
  });

  it("uses a writable directory and creates it", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = join(mkdtempSync(join(tmpdir(), "snaphub-")), "pglite");
    vi.stubEnv("PGLITE_DIR", dir);
    expect(await load()).toBe(dir);
    const { existsSync } = await import("node:fs");
    expect(existsSync(dir)).toBe(true);
  });

  it("falls back to memory and warns when the directory cannot be made", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // /dev/null is not a directory, so mkdir fails immediately with ENOTDIR. A path under a
    // read-only mount would do as well, but not every box this runs on has the same ones, and
    // /proc turned out to hang rather than fail in at least one container.
    vi.stubEnv("PGLITE_DIR", "/dev/null/snaphub/pglite");
    expect(await load()).toBe("memory://");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("in-memory");
  });
});
