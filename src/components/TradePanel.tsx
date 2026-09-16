"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "viem";
import { CHAIN_NAME, VALUES_ARE_REAL, txUrl } from "@/lib/chain";
import { formatEth, formatTokens, parseAmount } from "@/lib/format";
import { ponsV2CurveAbi, ponsV2TokenAbi } from "@/lib/pons/abi";
import { publicClient } from "@/lib/pons/client";
import { minOut, quoteBuy, quoteSell, type Quote } from "@/lib/pons/quote";
import { txPhaseLabel, useTx } from "@/lib/tx";
import { useWallet } from "./WalletProvider";
import { WalletButton } from "./WalletButton";

/**
 * Buying and selling against the bonding curve.
 *
 * Every number shown here was produced by simulating the real call against the
 * live curve — see lib/pons/quote.ts for why that is a simulation rather than
 * arithmetic. Re-quoted on every edit and again after each fill, because a
 * trade moves the reserves: a quote is only true for the state it was read from.
 */

const SLIPPAGE_OPTIONS = [50, 100, 500] as const;
/** Typing pauses this long before the chain is asked. */
const QUOTE_DEBOUNCE_MS = 300;

type Side = "buy" | "sell";

export interface TradePanelProps {
  token: Address;
  curve: Address;
  symbol: string;
  /** Curve finished. Buys revert; the panel says so rather than offering one. */
  graduated: boolean;
  /**
   * Threshold crossed but the pool is not seeded yet. Pons closes *selling* in
   * this window too, so a sell here would revert — the panel has to know about
   * it separately from `graduated`.
   */
  readyToGraduate: boolean;
}

/**
 * An answer bundled with the question it answers.
 *
 * `key` identifies the exact side/amount/nonce the curve was asked about.
 * Rendering compares it against the current inputs and ignores any mismatch, so
 * a quote for one amount can never be displayed — or submitted as `minOut` —
 * against another.
 */
interface QuoteFor {
  key: string;
  quote: Quote | null;
  error: string | null;
}

/** Balances tagged with the account they were read for, so a wallet switch
 * cannot leave the previous account's numbers on screen. */
interface BalancesFor {
  owner: Address;
  eth: bigint;
  token: bigint;
  allowance: bigint;
}

export function TradePanel(props: TradePanelProps) {
  const router = useRouter();
  const { address, ready, switchChain } = useWallet();

  const [side, setSide] = useState<Side>(props.graduated ? "sell" : "buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [quoted, setQuoted] = useState<QuoteFor | null>(null);
  const [balances, setBalances] = useState<BalancesFor | null>(null);
  // Bumped after a fill so balances and the quote are re-read against the curve
  // as it now stands rather than as it stood when the form was filled in.
  const [nonce, setNonce] = useState(0);

  const approveTx = useTx();
  const tradeTx = useTx();

  const closed = props.graduated || props.readyToGraduate;
  const input = parseAmount(amount);
  const amountIn = input !== null && input > 0n ? input : null;

  // Null whenever there is nothing worth asking the curve. That does double
  // duty: it guards the effect below, and it names the answer being waited for.
  // A sell also needs an account, because a sell is priced from tokens someone
  // actually holds.
  const quoteKey =
    amountIn !== null && !closed && (side === "buy" || address)
      ? `${props.curve}|${side}|${amountIn}|${address ?? "anon"}|${nonce}`
      : null;

  // Everything rendered is derived from whether the stored answer still matches
  // the current question, rather than from an effect racing to clear stale
  // state — which would leave the submit button live with the previous
  // amount's bound during a re-quote.
  const live = quoteKey !== null && quoted?.key === quoteKey ? quoted : null;
  const quote = live?.quote ?? null;
  const quoteError = live?.error ?? null;
  const quoting = quoteKey !== null && live === null;

  const mine = balances && balances.owner === address ? balances : null;

  useEffect(() => {
    if (!address) return;
    let alive = true;
    void (async () => {
      try {
        const [eth, balance, allowance] = await Promise.all([
          publicClient.getBalance({ address }),
          publicClient.readContract({
            address: props.token,
            abi: ponsV2TokenAbi,
            functionName: "balanceOf",
            args: [address],
          }),
          publicClient.readContract({
            address: props.token,
            abi: ponsV2TokenAbi,
            functionName: "allowance",
            args: [address, props.curve],
          }),
        ]);
        if (!alive) return;
        setBalances({ owner: address, eth, token: balance, allowance });
      } catch {
        // Balances are a convenience. The contract enforces the real limits.
        if (alive) setBalances(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, props.token, props.curve, nonce]);

  useEffect(() => {
    if (quoteKey === null || amountIn === null) return;
    let alive = true;
    const timer = setTimeout(() => {
      void (async () => {
        const result =
          side === "buy"
            ? await quoteBuy({ curve: props.curve, quoteIn: amountIn, account: address })
            : await quoteSell({
                token: props.token,
                curve: props.curve,
                tokensIn: amountIn,
                account: address as Address,
              });
        if (!alive) return;
        setQuoted(
          result.ok
            ? { key: quoteKey, quote: result.quote, error: null }
            : { key: quoteKey, quote: null, error: result.error },
        );
      })();
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [quoteKey, amountIn, side, address, props.curve, props.token]);

  const out = quote ? (quote.side === "buy" ? quote.tokensOut : quote.quoteOut) : 0n;
  const bound = quote ? minOut(out, slippageBps) : 0n;
  // `mine !== null` rather than a zero default, because an unread allowance is
  // not a zero allowance. Defaulting to "needs approval" made a failed balance
  // read pin a seller on the Approve button and charge them gas for an approval
  // they already had. Failing the other way costs nothing: an unapproved sell
  // is caught by the pre-flight simulation in useTx, before any signature.
  const needsApproval =
    side === "sell" && amountIn !== null && mine !== null && mine.allowance < amountIn;

  const settle = useCallback(() => {
    // Clearing the amount and bumping the nonce both change `quoteKey`, which
    // is what drops the filled quote — there is no separate copy to reset.
    setAmount("");
    setNonce((n) => n + 1);
    // The page is a server component reading the chain, so the header stats
    // come back correct without a client cache to reconcile.
    router.refresh();
  }, [router]);

  const approve = useCallback(async () => {
    if (!amountIn) return;
    // Exactly what this sale needs. An unlimited allowance would outlive the
    // trade and leave the curve able to move these tokens forever.
    const hash = await approveTx.send({
      address: props.token,
      abi: ponsV2TokenAbi,
      functionName: "approve",
      args: [props.curve, amountIn],
    });
    if (hash) setNonce((n) => n + 1);
  }, [amountIn, approveTx, props.curve, props.token]);

  const trade = useCallback(async () => {
    if (!amountIn || !quote || !address) return;
    const hash =
      side === "buy"
        ? await tradeTx.send({
            address: props.curve,
            abi: ponsV2CurveAbi,
            functionName: "buy",
            // `quoteIn` and msg.value must match to the wei — Pons reverts with
            // NativeValueMismatch otherwise.
            args: [amountIn, bound, address],
            value: amountIn,
          })
        : await tradeTx.send({
            address: props.curve,
            abi: ponsV2CurveAbi,
            functionName: "sell",
            args: [amountIn, bound, address],
          });
    if (hash) {
      settle();
      return;
    }
    // A trade that did not land still moved the world: the revert may well have
    // been SlippageExceeded, meaning someone else's trade repriced the curve.
    // Bumping the nonce changes `quoteKey`, which drops the filled-in quote and
    // its `bound` and asks the curve again — otherwise the panel would sit
    // there advising "re-quote and try again" while showing, and offering to
    // resubmit, exactly the stale numbers that just failed.
    setNonce((n) => n + 1);
  }, [address, amountIn, bound, props.curve, quote, settle, side, tradeTx]);

  if (props.graduated) {
    return (
      <div className="card p-5">
        <h2 className="font-display text-base">Trading has moved</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          This token graduated. Its liquidity is now in a permanently locked Uniswap v4
          pool, so the bonding curve no longer prices it — trade it on a DEX instead.
        </p>
      </div>
    );
  }

  if (props.readyToGraduate) {
    return (
      <div className="card p-5">
        <h2 className="font-display text-base">Graduating</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          This curve has taken its full graduation amount and is settling into a Uniswap
          pool. Pons closes both buying and selling during that window. Anyone can trigger
          the graduation, and trading reopens on the pool once it is seeded.
        </p>
      </div>
    );
  }

  const busy = tradeTx.busy || approveTx.busy;
  const short =
    side === "buy"
      ? amountIn !== null && mine !== null && amountIn > mine.eth
      : amountIn !== null && mine !== null && amountIn > mine.token;
  const txError = tradeTx.error ?? approveTx.error;
  const activeHash = tradeTx.hash ?? approveTx.hash;

  return (
    <div className="card p-5">
      <div className="flex gap-1 p-1 bg-ivory rounded-lg" role="tablist">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={side === value}
            onClick={() => {
              setSide(value);
              setAmount("");
            }}
            className={`flex-1 py-1.5 rounded-md text-sm capitalize transition-colors ${
              side === value ? "bg-paper text-sumi shadow-sm" : "text-muted hover:text-sumi"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <label className="block mt-4">
        <span className="flex items-baseline justify-between mb-1.5">
          <span className="label">{side === "buy" ? "You pay" : "You sell"}</span>
          {mine ? (
            side === "sell" ? (
              // Only sells get a max button. "All my ETH" is never the right buy:
              // it leaves nothing for gas, so the transaction it fills in cannot
              // be sent. Tokens have no such problem — selling all of them is a
              // normal thing to want.
              <button
                type="button"
                className="text-xs text-muted hover:text-vermilion transition-colors"
                onClick={() => setAmount(formatTokensExact(mine.token))}
              >
                Balance: <span className="num">{formatTokens(mine.token)} {props.symbol}</span>
              </button>
            ) : (
              <span className="text-xs text-muted">
                Balance: <span className="num">{formatEth(mine.eth)} ETH</span>
              </span>
            )
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            placeholder="0.0"
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="num text-sm text-muted shrink-0 w-16 truncate">
            {side === "buy" ? "ETH" : props.symbol}
          </span>
        </div>
      </label>

      {side === "buy" ? (
        <div className="flex gap-2 mt-2">
          {["0.005", "0.01", "0.05", "0.1"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setAmount(v)}
              className="num px-2.5 py-1 rounded-full border border-rule text-xs text-muted hover:border-vermilion hover:text-vermilion transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 pt-4 border-t border-rule text-sm">
        {quoting ? (
          <p className="text-muted">Asking the curve…</p>
        ) : quoteError ? (
          <p role="alert" className="text-vermilion">
            {quoteError}
          </p>
        ) : quote ? (
          <dl className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted">You receive</dt>
              <dd className="num">
                {quote.side === "buy"
                  ? `${formatTokens(quote.tokensOut)} ${props.symbol}`
                  : `${formatEth(quote.quoteOut, 6)} ETH`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <dt className="text-muted">Fee</dt>
              <dd className="num text-muted">
                {formatEth(quote.fee + quote.tax, 6)} ETH
              </dd>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <dt className="text-muted">Minimum after slippage</dt>
              <dd className="num text-muted">
                {quote.side === "buy"
                  ? `${formatTokens(bound)} ${props.symbol}`
                  : `${formatEth(bound, 6)} ETH`}
              </dd>
            </div>
            {quote.side === "buy" && quote.partial ? (
              <p className="text-xs text-sumi/80 bg-sakura/15 border border-sakura/40 rounded-lg px-3 py-2 mt-2 leading-relaxed">
                This buys out the rest of the curve. Only{" "}
                <span className="num">{formatEth(quote.spent, 6)} ETH</span> is
                spent and{" "}
                <span className="num">{formatEth(quote.refund, 6)} ETH</span>{" "}
                comes straight back in the same transaction — after which the
                token graduates.
              </p>
            ) : null}
          </dl>
        ) : (
          <p className="text-muted">
            {side === "sell" && !address
              ? "Connect a wallet to price a sale of your tokens."
              : "Enter an amount to see what the curve gives you."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs">
        <span className="text-muted">Slippage</span>
        {SLIPPAGE_OPTIONS.map((bps) => (
          <button
            key={bps}
            type="button"
            onClick={() => setSlippageBps(bps)}
            className={`px-2 py-0.5 rounded-full transition-colors ${
              slippageBps === bps
                ? "bg-sumi text-ivory"
                : "border border-rule text-muted hover:border-vermilion hover:text-vermilion"
            }`}
          >
            {bps / 100}%
          </button>
        ))}
      </div>

      {short ? (
        <p className="mt-3 text-xs text-vermilion">
          That is more than your {side === "buy" ? "ETH" : props.symbol} balance.
        </p>
      ) : null}

      {txError ? (
        <p role="alert" className="mt-3 text-sm text-vermilion">
          {txError}
        </p>
      ) : null}

      <div className="mt-4">
        {!address ? (
          <WalletButton />
        ) : !ready ? (
          <button
            type="button"
            className="w-full py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
            onClick={switchChain}
          >
            Switch to {CHAIN_NAME}
          </button>
        ) : needsApproval ? (
          <button
            type="button"
            className="w-full py-2.5 rounded-full bg-sumi text-ivory text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            disabled={busy || !amountIn}
            onClick={approve}
          >
            {approveTx.busy
              ? txPhaseLabel(approveTx.phase)
              : `Approve ${props.symbol} to sell`}
          </button>
        ) : (
          <button
            type="button"
            className="w-full py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors disabled:opacity-50"
            disabled={busy || !quote || short}
            onClick={trade}
          >
            {tradeTx.busy
              ? txPhaseLabel(tradeTx.phase)
              : side === "buy"
                ? "Buy"
                : "Sell"}
          </button>
        )}
      </div>

      {activeHash ? (
        <p className="mt-2 text-xs text-muted text-center">
          <a
            className="underline hover:text-vermilion"
            href={txUrl(activeHash)}
            target="_blank"
            rel="noreferrer noopener"
          >
            View transaction ↗
          </a>
        </p>
      ) : null}

      <p className="mt-4 text-xs text-muted/90 leading-relaxed">
        {VALUES_ARE_REAL
          ? "Quoted by the curve itself at the current block. The price moves with every trade, including ones that land before yours."
          : `This is ${CHAIN_NAME}. These amounts are test values and carry no worth.`}
      </p>
    </div>
  );
}

/**
 * A token balance as a full decimal string, for putting into the input.
 *
 * `formatTokens` abbreviates to "5.86M", which is right for reading and wrong
 * for a field whose contents get parsed back into wei — so "max" needs its own
 * exact rendering. Truncated rather than rounded, since rounding up would
 * produce an amount larger than the balance it came from.
 */
function formatTokensExact(raw: bigint, decimals = 18): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
