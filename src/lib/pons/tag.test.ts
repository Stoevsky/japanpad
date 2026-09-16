import { describe, expect, test } from "vitest";
import { parseStockTag, parseThemeTag, withThemeTag, withoutThemeTag } from "./tag";

/**
 * The tag is the only thing carrying a JapanPad coin's theme and denomination
 * through a launchpad that has no concept of either, and it is free text that
 * anyone can type. Two properties matter enough to pin down here.
 *
 * The first is that adding the stock suffix did not orphan the coins launched
 * before it existed. Every one of those carries a bare `theme:` tag, and if the
 * widened pattern stopped matching them they would silently vanish from Explore
 * — the indexer drops anything `parseThemeTag` returns null for.
 *
 * The second is that an unrecognised ticker is refused rather than echoed. The
 * tag is forgeable by design, which is tolerable while it asserts only a
 * category; the moment it can put an arbitrary company name on a coin page it
 * asserts something worth forging. Confining it to the catalog is what keeps it
 * cosmetic.
 */

describe("withThemeTag", () => {
  test("writes a bare theme tag when no stock is chosen", () => {
    expect(withThemeTag("A coin.", "gaming")).toBe("A coin.\n\n[JapanPad] theme:gaming");
  });

  test("writes the stock suffix when one is", () => {
    expect(withThemeTag("A coin.", "gaming", "7974.T")).toBe(
      "A coin.\n\n[JapanPad] theme:gaming stock:7974.T",
    );
  });

  test("drops a ticker outside the catalog rather than writing it", () => {
    // Refusing here matters more than refusing on read: this string is what
    // gets signed. A ticker we cannot quote would be written on chain forever.
    expect(withThemeTag("A coin.", "gaming", "9999.T")).toBe(
      "A coin.\n\n[JapanPad] theme:gaming",
    );
  });

  test("tags an empty description without leading blank lines", () => {
    expect(withThemeTag("", "food", "2502.T")).toBe("[JapanPad] theme:food stock:2502.T");
  });
});

describe("parseThemeTag", () => {
  test("still reads tags written before denominations existed", () => {
    expect(parseThemeTag("Old coin.\n\n[JapanPad] theme:tradition")).toBe("tradition");
  });

  test("reads the theme out of a tag that also carries a stock", () => {
    expect(parseThemeTag("New coin.\n\n[JapanPad] theme:tradition stock:7203.T")).toBe(
      "tradition",
    );
  });

  test("refuses a theme that does not exist", () => {
    expect(parseThemeTag("[JapanPad] theme:finance")).toBeNull();
  });

  test("is null when there is no tag at all", () => {
    expect(parseThemeTag("Just a description.")).toBeNull();
  });
});

describe("parseStockTag", () => {
  test("reads a catalog ticker", () => {
    expect(parseStockTag("[JapanPad] theme:automotive stock:7203.T")).toBe("7203.T");
  });

  test("is null when the tag carries no stock", () => {
    expect(parseStockTag("[JapanPad] theme:automotive")).toBeNull();
  });

  test("refuses a well-formed ticker that is not in the catalog", () => {
    // Shaped exactly like a real TSE code, so only the catalog check rejects it.
    // Without that check a launch could put any four digits on its own page.
    expect(parseStockTag("[JapanPad] theme:automotive stock:1234.T")).toBeNull();
  });

  test("refuses a US ticker, which this catalog does not quote", () => {
    expect(parseStockTag("[JapanPad] theme:automotive stock:TM")).toBeNull();
  });
});

describe("withoutThemeTag", () => {
  test("strips a tag carrying a stock, leaving the creator's words", () => {
    expect(withoutThemeTag("Mine.\n\n[JapanPad] theme:music stock:6758.T")).toBe("Mine.");
  });

  test("strips a bare tag too", () => {
    expect(withoutThemeTag("Mine.\n\n[JapanPad] theme:music")).toBe("Mine.");
  });
});
