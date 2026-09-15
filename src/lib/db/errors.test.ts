import { describe, expect, it } from "vitest";
import { describeDbError } from "./errors";

describe("describeDbError", () => {
  it("explains common Supabase connection mistakes without echoing the connection string", () => {
    expect(describeDbError(Object.assign(new Error("getaddrinfo ENOTFOUND db.abc.supabase.co"), { code: "ENOTFOUND" }))).toMatch(
      /Transaction pooler/,
    );
    expect(describeDbError(Object.assign(new Error("password authentication failed for user"), { code: "28P01" }))).toMatch(
      /password in DATABASE_URL is wrong/,
    );
    expect(describeDbError(new Error("Tenant or user not found"))).toMatch(/postgres\.abcdefghij/);
    expect(describeDbError(new TypeError("Invalid URL"))).toMatch(/square brackets/);

    const leaked = describeDbError(new Error("boom postgresql://postgres.x:hunter2@host:6543/postgres"));
    expect(leaked).not.toContain("hunter2");
    expect(leaked).toContain("postgres://…");
  });
});
