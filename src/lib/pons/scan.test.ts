import { describe, expect, test } from "vitest";
import { MAX_SCANNED, scanStop } from "./scan";

/**
 * When to stop walking back through Pons's launch history.
 *
 * This is the rule that decided a JapanPad coin existed or not, and it was
 * counting the wrong thing. The scan collected raw `TokenLaunched` logs and
 * stopped once it held `limit * 4` of them — a budget denominated in Pons
 * launches, applied to a search for JapanPad launches.
 *
 * Those are not the same population and not remotely the same size. Measured on
 * mainnet at block 64,921,134: 6,068 Pons launches in the scan window, of which
 * 5 were JapanPad's. At `limit = 48` the budget of 192 raw launches ran out 9
 * launches before $MARIO and 402 before $TOYOTA, so Explore showed three of the
 * five coins and reported the list complete.
 *
 * Two things follow, and both are tested here. The budget has to count what the
 * caller actually asked for, and running out of budget has to be distinguishable
 * from running out of history — because one of them means "that is all of them"
 * and the other means "that is all I looked at", and a listing that confuses the
 * two is making a claim about the chain that it has not checked.
 */

const base = { found: 0, wanted: 48, scanned: 0, atFloor: false, maxScanned: MAX_SCANNED };

describe("scanStop", () => {
  test("keeps going while Pons launches pile up and JapanPad's have not", () => {
    // The regression. Three found, 192 raw launches read, budget nowhere near
    // spent: the old rule stopped exactly here and lost $MARIO and $TOYOTA.
    expect(scanStop({ ...base, found: 3, scanned: 192 })).toBeNull();
  });

  test("keeps going deep into a busy feed, because 0.08% is the real ratio", () => {
    expect(scanStop({ ...base, found: 5, scanned: 6_000 })).toBeNull();
  });

  test("stops once it has what the caller asked for", () => {
    expect(scanStop({ ...base, found: 48, scanned: 500 })).toBe("enough");
    expect(scanStop({ ...base, found: 49, scanned: 500 })).toBe("enough");
  });

  test("stops at the end of history, having genuinely seen everything", () => {
    expect(scanStop({ ...base, found: 5, scanned: 6_068, atFloor: true })).toBe(
      "end-of-history",
    );
  });

  test("stops when the work budget runs out, which is a different thing", () => {
    expect(scanStop({ ...base, found: 5, scanned: MAX_SCANNED })).toBe("budget-exhausted");
  });

  test("prefers 'enough' over the budget, since the answer is complete either way", () => {
    expect(scanStop({ ...base, found: 48, scanned: MAX_SCANNED })).toBe("enough");
  });

  test("prefers the end of history over the budget on the last chunk", () => {
    // Both are true on a final chunk that exhausts the budget. Only one of them
    // is the reason the answer is trustworthy.
    expect(scanStop({ ...base, found: 2, scanned: MAX_SCANNED, atFloor: true })).toBe(
      "end-of-history",
    );
  });

  test("never stops a search that has found nothing and has budget left", () => {
    expect(scanStop({ ...base, found: 0, scanned: 1 })).toBeNull();
  });

  test("budgets enough work to clear the history that actually exists", () => {
    // 6,068 raw launches sat in the 400k-block window when this was measured.
    // A budget under that would truncate the real listing on day one.
    expect(MAX_SCANNED).toBeGreaterThanOrEqual(6_068);
  });
});

/**
 * Only one of the stop reasons leaves the listing incomplete.
 *
 * "enough" and "end-of-history" both mean the answer is whole: the first
 * because the caller got the page it asked for, the second because there is no
 * more chain to read. "budget-exhausted" means the scan gave up early, and a
 * page that renders that result as though it were the full set is telling the
 * visitor there are three JapanPad coins when there are five.
 */
describe("scanStop reasons that leave a listing incomplete", () => {
  test("a spent budget is the only one", () => {
    expect(scanStop({ ...base, found: 48 })).toBe("enough");
    expect(scanStop({ ...base, atFloor: true })).toBe("end-of-history");
    expect(scanStop({ ...base, scanned: MAX_SCANNED })).toBe("budget-exhausted");
  });
});
