import { afterEach, describe, expect, it } from "vitest";
import { cleanEnv } from "./env";

const zeroWidthSpace = String.fromCharCode(0x200b);
const nbsp = String.fromCharCode(0xa0);

afterEach(() => {
  delete process.env.SNAPHUB_TEST_VALUE;
});

describe("cleanEnv", () => {
  it("drops spaces, line breaks and invisible characters picked up when pasting", () => {
    process.env.SNAPHUB_TEST_VALUE = ` https://snap-hub.vercel.app${nbsp}${zeroWidthSpace}\r\n`;
    expect(cleanEnv("SNAPHUB_TEST_VALUE")).toBe("https://snap-hub.vercel.app");
  });

  it("returns undefined for missing or blank values", () => {
    expect(cleanEnv("SNAPHUB_TEST_VALUE")).toBeUndefined();
    process.env.SNAPHUB_TEST_VALUE = " \n";
    expect(cleanEnv("SNAPHUB_TEST_VALUE")).toBeUndefined();
  });
});
