import { describe, expect, it } from "vitest";
import { formatLastMoved } from "./relative-time";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatLastMoved", () => {
  it("stays vague inside the first hour, because the board only refreshes twice an hour", () => {
    expect(formatLastMoved(ago(0), NOW)).toBe("under an hour ago");
    expect(formatLastMoved(ago(31 * MINUTE), NOW)).toBe("under an hour ago");
    expect(formatLastMoved(ago(HOUR - 1), NOW)).toBe("under an hour ago");
  });

  it("counts whole hours up to a day", () => {
    expect(formatLastMoved(ago(HOUR), NOW)).toBe("over an hour ago");
    expect(formatLastMoved(ago(HOUR + 59 * MINUTE), NOW)).toBe("over an hour ago");
    expect(formatLastMoved(ago(2 * HOUR), NOW)).toBe("over 2 hours ago");
    expect(formatLastMoved(ago(23 * HOUR), NOW)).toBe("over 23 hours ago");
  });

  it("counts whole days up to a week", () => {
    expect(formatLastMoved(ago(DAY), NOW)).toBe("over a day ago");
    expect(formatLastMoved(ago(DAY + 23 * HOUR), NOW)).toBe("over a day ago");
    expect(formatLastMoved(ago(2 * DAY), NOW)).toBe("over 2 days ago");
    expect(formatLastMoved(ago(6 * DAY), NOW)).toBe("over 6 days ago");
  });

  it("counts whole weeks after that", () => {
    expect(formatLastMoved(ago(7 * DAY), NOW)).toBe("over a week ago");
    expect(formatLastMoved(ago(13 * DAY), NOW)).toBe("over a week ago");
    expect(formatLastMoved(ago(14 * DAY), NOW)).toBe("over 2 weeks ago");
    expect(formatLastMoved(ago(365 * DAY), NOW)).toBe("over 52 weeks ago");
  });

  it("does not go negative if a timestamp is slightly ahead of the clock", () => {
    expect(formatLastMoved(new Date(NOW + 5 * MINUTE).toISOString(), NOW)).toBe("under an hour ago");
  });
});
