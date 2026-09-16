import { describe, expect, test } from "vitest";
import { EXAMPLE_LAUNCHES } from "./examples";
import { isThemeId } from "./themes";

/**
 * The placeholders are the one place in this codebase that renders something
 * which is not read off the chain, so they get the strictest rule in it.
 *
 * The failure mode is not that someone adds a fake coin on purpose. It is that
 * the cards look bare next to the real ones, and a later change "finishes" them
 * by filling in a raised amount and a graduation percentage to match — at which
 * point a site with a live trade panel is printing invented market figures, and
 * nothing in review would flag it as anything but a styling fix.
 *
 * So the shape is asserted rather than described in a comment: a placeholder
 * carries an identity and a theme, and no quantity of anything.
 */

describe("example launches", () => {
  test("carry no financial figures of any kind", () => {
    const FORBIDDEN = [
      "price",
      "raised",
      "marketCap",
      "progress",
      "graduationThreshold",
      "graduated",
      "volume",
      "holders",
      "supply",
      "liquidity",
    ];
    for (const example of EXAMPLE_LAUNCHES) {
      for (const field of FORBIDDEN) {
        expect(
          Object.hasOwn(example, field),
          `Example ${example.symbol} carries "${field}". A placeholder may not ` +
            `state a market figure — launch a real coin instead.`,
        ).toBe(false);
      }
    }
  });

  test("carry no address, so none can be mistaken for a contract", () => {
    for (const example of EXAMPLE_LAUNCHES) {
      for (const value of Object.values(example)) {
        expect(String(value)).not.toMatch(/0x[0-9a-fA-F]{6,}/);
      }
    }
  });

  test("each names a real theme", () => {
    // The card borrows the theme's accent, so an unknown id renders an
    // unstyled card rather than an obviously broken one.
    for (const example of EXAMPLE_LAUNCHES) {
      expect(isThemeId(example.themeId), `${example.symbol} → ${example.themeId}`).toBe(
        true,
      );
    }
  });

  test("have distinct tickers, since the ticker is the card's key", () => {
    const symbols = EXAMPLE_LAUNCHES.map((e) => e.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  test("fill the grid without a ragged last row", () => {
    // The grid is 4 across at lg, 2 at sm. A multiple of four sits flush in
    // both, which is the entire reason these exist.
    expect(EXAMPLE_LAUNCHES.length % 4).toBe(0);
    expect(EXAMPLE_LAUNCHES.length).toBeGreaterThan(0);
  });
});
