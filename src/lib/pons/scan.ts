/**
 * When to stop walking back through Pons's launch history.
 *
 * Pure, and deliberately separate from read.ts — that module is `server-only`
 * because it holds the chain reads, and this rule is the part worth testing
 * without a network.
 *
 * The rule it replaces counted raw `TokenLaunched` logs: the scan stopped once
 * it held `limit * 4` of them. That is a budget denominated in Pons launches
 * spent on a search for JapanPad launches, and those populations differ by
 * three orders of magnitude. Measured on mainnet at block 64,921,134 there were
 * 6,068 Pons launches in the scan window and 5 of ours. At `limit = 48` the
 * budget ran out 9 launches before $MARIO and 402 before $TOYOTA — so Explore
 * displayed three of five coins and called the list complete.
 */

/**
 * The cap on how many launches the scan will read descriptions for.
 *
 * A JapanPad coin is only identifiable by reading its description off chain, so
 * "is this one of ours" costs a call per launch and the work is bounded by
 * Pons's volume rather than ours. This is the bound.
 *
 * It is set far above the history that exists inside JapanPad's own lifetime —
 * see SCAN_FLOOR in read.ts, which is what actually keeps the common case cheap
 * — so in practice it never binds. It is here so that a busy chain degrades to
 * an honest partial listing instead of an unbounded read.
 */
export const MAX_SCANNED = 12_000;

/**
 * Why a scan stopped, or null to keep going.
 *
 * The distinction that matters is between `end-of-history` and
 * `budget-exhausted`. The first means there is no more chain to read, so what
 * was found is all there is. The second means the scan gave up early, and what
 * was found is merely all it looked at. Rendering the second as though it were
 * the first is how a page tells a visitor there are three JapanPad coins when
 * there are five.
 */
export type ScanStop = "enough" | "end-of-history" | "budget-exhausted";

export function scanStop(args: {
  /** JapanPad launches confirmed so far. */
  found: number;
  /** How many the caller asked for. */
  wanted: number;
  /** Raw Pons launches whose descriptions have been read. */
  scanned: number;
  /** Whether the walk has reached the oldest block it will look at. */
  atFloor: boolean;
  maxScanned: number;
}): ScanStop | null {
  // Ordered so that the two reasons which leave a complete answer are checked
  // before the one that does not. On a final chunk that also spends the budget
  // every condition is true, and only the first two make the result whole.
  if (args.found >= args.wanted) return "enough";
  if (args.atFloor) return "end-of-history";
  if (args.scanned >= args.maxScanned) return "budget-exhausted";
  return null;
}

/** Whether a finished scan saw everything it claims to have seen. */
export function scanWasComplete(stop: ScanStop): boolean {
  return stop !== "budget-exhausted";
}
