import { describe, expect, it } from "vitest";
import { clip } from "./opengraph-image";

/**
 * Satori's ellipsis handling is patchy, so the string is cut rather than the layout trusted
 * to do it. A name that runs past the card is the one thing that breaks a share image
 * silently: it renders, it just pushes the rank change off the edge.
 */
describe("clip", () => {
  it("leaves a name that fits alone, trimmed", () => {
    expect(clip("Mox")).toBe("Mox");
    expect(clip("  PXL Rick  ")).toBe("PXL Rick");
    expect(clip("Exactly twenty-six chars!!")).toBe("Exactly twenty-six chars!!");
  });

  it("cuts a longer one and marks it", () => {
    const long = "A Very Long Marvel Snap Name Indeed";
    expect(clip(long)).toBe("A Very Long Marvel Snap N…");
    expect(clip(long)).toHaveLength(26);
  });

  it("handles the 40 characters the board actually allows", () => {
    expect(clip("x".repeat(40))).toHaveLength(26);
    expect(clip("")).toBe("");
  });
});
