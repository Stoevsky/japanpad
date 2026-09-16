import { parseEventLogs, type Address } from "viem";
import { describeTxError } from "../errors";
import { ponsV2CurveAbi, ponsV2TokenAbi } from "./abi";
import { publicClient } from "./client";

/**
 * What the curve will actually do, asked of the curve.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SIMULATION AND NOT ARITHMETIC
 * ---------------------------------------------------------------------------
 * PonsV2BondingCurve has no quoter. Read its source and the public surface is
 * `buy`, `sell`, `getReserves`, `realQuoteReserve`, `sellableTokens`,
 * `readyToGraduate` and a handful of constants — there is no `quoteBuy`, no
 * `getAmountOut`, nothing to ask. The pricing lives in
 * `PonsV2BondingCurveMath`, a library whose functions are internal and
 * therefore inlined into the curve's bytecode, so there is no deployed address
 * to call either.
 *
 * That leaves two options. One is to reimplement the constant-product formula
 * plus its fee legs plus its partial-fill clamp in TypeScript, and hope our
 * copy never drifts from the bytecode that actually executes. The other is to
 * run the real function against the real chain state and read what it returns.
 *
 * This module does the second. Every number it produces came out of Pons's own
 * code at the current block, including the fee, because the numbers are lifted
 * from the `CurveBuy`/`CurveSell` events the simulated call emitted. There is
 * no second implementation of the pricing to go out of step with the first.
 *
 * ---------------------------------------------------------------------------
 * THE PARTIAL FILL IS THE REASON THIS MATTERS
 * ---------------------------------------------------------------------------
 * `buy` does not revert when an order is larger than the curve has left. It
 * clamps the fill to the last sellable token, recomputes what that costs, and
 * refunds the difference. Measured against a live curve on chain 4663: an offer
 * of 500 ETH spent 4.2424 ETH and refunded 495.7576. A panel that displayed the
 * offered amount as the cost would be wrong by two orders of magnitude, and no
 * amount of local arithmetic would catch it without reimplementing the clamp.
 * The simulation gets it for free because it is the same code path.
 *
 * ---------------------------------------------------------------------------
 * ON THE BALANCE OVERRIDE
 * ---------------------------------------------------------------------------
 * `eth_call` enforces that the sender can cover `msg.value`, so quoting a buy
 * from an empty wallet fails with "insufficient funds" rather than a price.
 * That would make the price of a token a function of who is looking at it,
 * which it is not. So the simulation runs with the sender's balance overridden.
 *
 * This changes nothing real: it is a read-only call against a hypothetical
 * state, discarded when it returns. Whether the user can actually afford the
 * trade is a separate question, answered separately against their real balance
 * by the panel — and the transaction they eventually sign has no override on it
 * at all.
 */

/** Stands in for a visitor with no wallet, so browsing shows real prices. */
const ANONYMOUS: Address = `0x${"0".repeat(35)}beef1`;

/** Enough to quote any order this curve could absorb. Simulation only. */
const OVERRIDE_BALANCE = 10n ** 24n; // 1,000,000 ETH

export interface BuyQuote {
  side: "buy";
  /** What the curve takes. Less than offered when the order runs past the end. */
  spent: bigint;
  /** Handed straight back in the same transaction. Zero in the normal case. */
  refund: bigint;
  tokensOut: bigint;
  /** Pons's trade fee, in the quote asset. */
  fee: bigint;
  /** The creator's surcharge, if they set one. Zero on JapanPad launches. */
  tax: bigint;
  /** True when the order was clamped — it buys out the rest of the curve. */
  partial: boolean;
}

export interface SellQuote {
  side: "sell";
  tokensIn: bigint;
  /** ETH received, already net of fee and tax. */
  quoteOut: bigint;
  fee: bigint;
  tax: bigint;
}

export type Quote = BuyQuote | SellQuote;

export type QuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: string };

/**
 * What `quoteIn` wei of ETH buys on this curve, right now.
 *
 * `minTokensOut` is zero here on purpose: this is a question, not an order, and
 * a slippage bound would turn an answer into a revert. The bound is applied to
 * the real transaction, derived from the number this returns.
 */
export async function quoteBuy(args: {
  curve: Address;
  quoteIn: bigint;
  /** The eventual buyer, or nobody. Only affects who the simulation pretends to be. */
  account?: Address | null;
}): Promise<QuoteResult> {
  const account = args.account ?? ANONYMOUS;
  if (args.quoteIn <= 0n) return { ok: false, error: "Enter an amount." };

  try {
    const { results } = await publicClient.simulateCalls({
      account,
      stateOverrides: [{ address: account, balance: OVERRIDE_BALANCE }],
      calls: [
        {
          to: args.curve,
          abi: ponsV2CurveAbi,
          functionName: "buy",
          args: [args.quoteIn, 0n, account],
          value: args.quoteIn,
        },
      ],
    });

    const result = results[0];
    if (!result || result.status !== "success") {
      return { ok: false, error: quoteError(result?.error) };
    }

    // The return value is the token amount; the fee split and the true cost are
    // only in the events, so they are read from there rather than inferred.
    const logs = result.logs ?? [];
    const [filled] = parseEventLogs({
      abi: ponsV2CurveAbi,
      eventName: "CurveBuy",
      logs,
    });
    const [refunded] = parseEventLogs({
      abi: ponsV2CurveAbi,
      eventName: "CurveBuyRefunded",
      logs,
    });

    const tokensOut = result.result as bigint;
    const spent = filled?.args.quoteIn ?? args.quoteIn;
    const refund = refunded?.args.amount ?? 0n;

    return {
      ok: true,
      quote: {
        side: "buy",
        spent,
        refund,
        tokensOut,
        fee: filled?.args.fee ?? 0n,
        tax: filled?.args.tax ?? 0n,
        partial: refund > 0n,
      },
    };
  } catch (e) {
    return { ok: false, error: quoteError(e) };
  }
}

/**
 * What `tokensIn` sells for, right now.
 *
 * The approval is bundled into the simulation rather than demanded before the
 * quote. Selling requires the curve to pull tokens with `transferFrom`, so a
 * bare `sell` simulation from an unapproved holder reverts on the allowance and
 * never reaches the pricing — which would mean a user had to sign an approval
 * just to find out what their tokens are worth. Simulating [approve, sell]
 * together answers the question first and leaves the approval to be signed only
 * if they decide to go ahead.
 */
export async function quoteSell(args: {
  token: Address;
  curve: Address;
  tokensIn: bigint;
  /** Required: a sell is priced from tokens this account actually holds. */
  account: Address;
}): Promise<QuoteResult> {
  if (args.tokensIn <= 0n) return { ok: false, error: "Enter an amount." };

  try {
    const { results } = await publicClient.simulateCalls({
      account: args.account,
      calls: [
        {
          to: args.token,
          abi: ponsV2TokenAbi,
          functionName: "approve",
          args: [args.curve, args.tokensIn],
        },
        {
          to: args.curve,
          abi: ponsV2CurveAbi,
          functionName: "sell",
          args: [args.tokensIn, 0n, args.account],
        },
      ],
    });

    const sold = results[1];
    if (!sold || sold.status !== "success") {
      return { ok: false, error: quoteError(sold?.error) };
    }

    const [event] = parseEventLogs({
      abi: ponsV2CurveAbi,
      eventName: "CurveSell",
      logs: sold.logs ?? [],
    });

    return {
      ok: true,
      quote: {
        side: "sell",
        tokensIn: args.tokensIn,
        quoteOut: sold.result as bigint,
        fee: event?.args.fee ?? 0n,
        tax: event?.args.tax ?? 0n,
      },
    };
  } catch (e) {
    return { ok: false, error: quoteError(e) };
  }
}

/**
 * A failed quote, explained.
 *
 * Falls back to a message about reachability rather than about the trade,
 * because the common cause of an undecodable failure here is the RPC, not the
 * curve — and telling someone their trade is invalid when the node simply did
 * not answer is worse than saying nothing.
 */
function quoteError(e: unknown): string {
  return (
    describeTxError(e) ??
    "The curve did not answer. Check your connection and try again."
  );
}

/**
 * The slippage floor to send with a trade.
 *
 * Derived from a quote that came from the curve, so the bound is expressed in
 * the same units the curve will measure it in. Rounded down, so rounding can
 * only ever loosen the bound and never reject a fill the user would have taken.
 */
export function minOut(out: bigint, slippageBps: number): bigint {
  return (out * BigInt(10_000 - slippageBps)) / 10_000n;
}
