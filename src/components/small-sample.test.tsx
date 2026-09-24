import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LOW_SAMPLE, SmallSample } from "./stats-ui";

it("tags a count under the shared threshold and nothing at or above it", () => {
  // The cream palette stopped fading small-sample rows, so the count carries the warning.
  expect(renderToStaticMarkup(<SmallSample games={LOW_SAMPLE - 1} />)).toContain("small sample");
  expect(renderToStaticMarkup(<SmallSample games={LOW_SAMPLE} />)).toBe("");
});
