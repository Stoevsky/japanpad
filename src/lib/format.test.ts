import { describe, expect, test } from "vitest";
import { formatEth, formatPricePerMillion } from "./format";

/**
 * The magnitudes here are not invented. A Pons curve mints ~1e9 tokens against a
 * 4.2 ETH graduation threshold, so a single token costs on the order of a
 * billionth of an ETH for its entire life on the curve — measured on the live
 * curve 0x9382C4a8 on chain 4663, 0.01 ETH bought 5,858,334.81 tokens, which is
 * 1.707e-9 ETH each.
 *
 * That is the number the token page has to render. Any formatter whose smallest
 * representable value is 0.0001 ETH cannot render it, and will say the same
 * thing about a token at the start of its curve and one about to graduate.
 */

const ETH = 10n ** 18n;

describe("formatEth honours its maxDp argument", () => {
  test("renders a real spot price instead of collapsing it to a floor", () => {
    // 1.707e-9 ETH — the measured price on a live curve.
    expect(formatEth(1_707_000_000n, 12)).toBe("0.000000001707");
  });

  test("distinguishes a fresh curve from one near graduation", () => {
    const fresh = formatEth(1_000_000_000n, 12);
    const mature = formatEth(26_000_000_000n, 12);
    expect(fresh).not.toBe(mature);
  });

  test("renders the fee on the smallest buy preset", () => {
    // 0.005 ETH at the curve's 1% fee is 5e-5 ETH.
    expect(formatEth(50_000_000_000_000n, 6)).toBe("0.00005");
  });

  test("puts the floor at maxDp, not at a hardcoded 0.0001", () => {
    // Below what 6dp can express, so a floor marker is honest here.
    expect(formatEth(1n, 6)).toBe("<0.000001");
  });
});

describe("formatPricePerMillion puts a curve price in a readable range", () => {
  test("scales the measured live price into ordinary decimals", () => {
    // 1.707e-9 ETH per token is 0.001707 ETH per million tokens.
    expect(formatPricePerMillion(1_707_000_000n)).toBe("0.001707");
  });

  test("separates prices that per-token rendering would flatten together", () => {
    expect(formatPricePerMillion(1_000_000_000n)).toBe("0.001");
    expect(formatPricePerMillion(26_000_000_000n)).toBe("0.026");
  });

  test("an unreadable curve has no price rather than a zero one", () => {
    expect(formatPricePerMillion(0n)).toBeNull();
  });
});

describe("formatEth keeps its existing behaviour in the normal range", () => {
  test("zero is zero", () => {
    expect(formatEth(0n)).toBe("0");
  });

  test("trims insignificant trailing zeros", () => {
    expect(formatEth(ETH)).toBe("1");
    expect(formatEth(ETH / 50n)).toBe("0.02");
  });

  test("uses coarser precision as the magnitude grows", () => {
    expect(formatEth(1234n * ETH)).toBe("1234");
    expect(formatEth(ETH / 3n)).toBe("0.3333");
  });

  test("still shows a floor marker at the default precision", () => {
    expect(formatEth(1n)).toBe("<0.0001");
  });
});
