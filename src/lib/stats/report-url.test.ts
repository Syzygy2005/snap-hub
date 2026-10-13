import { afterEach, describe, expect, it } from "vitest";
import { trackerReportUrl } from "./tracker";

const NAME = "TRACKER_REPORT_DISCORD_URL";
afterEach(() => { delete process.env[NAME]; });

describe("tracker report link", () => {
  it("is absent until it is configured", () => {
    expect(trackerReportUrl()).toBeNull();
  });

  it("accepts an https Discord invite", () => {
    process.env[NAME] = "https://discord.gg/abc123";
    expect(trackerReportUrl()).toBe("https://discord.gg/abc123");
    process.env[NAME] = "https://discord.com/invite/abc123";
    expect(trackerReportUrl()).toBe("https://discord.com/invite/abc123");
  });

  it("drops anything that is not an https Discord address", () => {
    for (const bad of ["http://discord.gg/abc", "https://discord.gg.evil.example/abc", "https://notdiscord.com/x", "javascript:alert(1)", "discord.gg/abc"]) {
      process.env[NAME] = bad;
      expect(trackerReportUrl()).toBeNull();
    }
  });
});
