import { describe, expect, test } from "vitest";
import { EXAMPLE_LAUNCHES } from "./examples";
import { examplesToShow } from "@/components/ExampleCard";
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

/**
 * How many placeholders appear next to real launches.
 *
 * The rule has one job: make the placeholders recede as the real thing arrives,
 * automatically. The alternative is a constant that somebody has to remember to
 * turn down, and nobody ever does — which is how a site ends up still showing
 * eight invented cards next to forty real ones.
 */
describe("examplesToShow", () => {
  test("shows two rows when there is nothing at all", () => {
    expect(examplesToShow(0)).toBe(8);
  });

  test("finishes the row the real launches started", () => {
    expect(examplesToShow(1)).toBe(3);
    expect(examplesToShow(2)).toBe(2);
    expect(examplesToShow(3)).toBe(1);
  });

  test("stops entirely once a full row of real launches exists", () => {
    // The page can carry itself from here, and a placeholder beside a populated
    // grid is all cost and no benefit.
    expect(examplesToShow(4)).toBe(0);
    expect(examplesToShow(12)).toBe(0);
    expect(examplesToShow(200)).toBe(0);
  });

  test("never asks for more placeholders than exist", () => {
    for (let real = 0; real <= 12; real++) {
      expect(examplesToShow(real)).toBeLessThanOrEqual(EXAMPLE_LAUNCHES.length);
      expect(examplesToShow(real)).toBeGreaterThanOrEqual(0);
    }
  });
});
