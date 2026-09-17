import { afterEach, describe, expect, it, vi } from "vitest";
import { adminIds, isAdmin } from "./admin";

const account = (discordId: string) => ({ discordId });

afterEach(() => vi.unstubAllEnvs());

describe("isAdmin", () => {
  it("nobody is an admin when the variable is unset or empty", () => {
    expect(isAdmin(account("1"))).toBe(false);
    vi.stubEnv("ADMIN_DISCORD_IDS", "");
    expect(isAdmin(account("1"))).toBe(false);
    expect(adminIds()).toEqual([]);
  });

  it("matches an id in the list and nobody else", () => {
    vi.stubEnv("ADMIN_DISCORD_IDS", "111,222");
    expect(isAdmin(account("111"))).toBe(true);
    expect(isAdmin(account("222"))).toBe(true);
    expect(isAdmin(account("333"))).toBe(false);
  });

  it("copes with spacing around the commas", () => {
    vi.stubEnv("ADMIN_DISCORD_IDS", " 111 , 222 ");
    expect(adminIds()).toEqual(["111", "222"]);
    expect(isAdmin(account("222"))).toBe(true);
  });

  it("is false for a signed-out visitor", () => {
    vi.stubEnv("ADMIN_DISCORD_IDS", "111");
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("does not match on a prefix or a partial id", () => {
    vi.stubEnv("ADMIN_DISCORD_IDS", "1112223334445556");
    expect(isAdmin(account("111"))).toBe(false);
    expect(isAdmin(account("1112223334445556"))).toBe(true);
  });
});
