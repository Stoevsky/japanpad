"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseEventLogs, type Address } from "viem";
import { CHAIN_NAME, txUrl } from "@/lib/chain";
import { formatEth, formatTokens } from "@/lib/format";
import { MAX_DESCRIPTION, MAX_NAME, MAX_SYMBOL } from "@/lib/metadata";
import { ponsV2FactoryAbi } from "@/lib/pons/abi";
import { LAUNCH_CONFIG_ID, NATIVE_QUOTE, PONS_FACTORY } from "@/lib/pons/deployment";
import { THEMES, getTheme } from "@/lib/themes";
import { txPhaseLabel, useTx } from "@/lib/tx";
import { prepareLaunch, type LaunchDraft, type LaunchPlan } from "@/app/launch/actions";
import { useWallet } from "./WalletProvider";
import { WalletButton } from "./WalletButton";
import { StockPicker } from "./StockPicker";

/**
 * Pick a theme, describe a token, sign once, get a coin on Pons.
 *
 * Three steps because three different things can go wrong and each deserves its
 * own answer. Choosing a theme is a browse; describing the token is form
 * validation; launching is a transaction that costs money. Collapsing them means
 * discovering a 17-character symbol at the wallet dialog.
 *
 * Nothing here decides what gets signed. `plan.params` is the exact tuple the
 * server built — including an economics digest it read from the factory moments
 * ago — and this component passes it through untouched.
 *
 * There is no buy-at-launch field, and that is not an omission. Pons's
 * `_launchToken` opens with `if (msg.value != launchFee) revert
 * LaunchFeeNotPaid()`, so a first buy cannot ride along in the launch
 * transaction. Pons does have an atomic launch-and-buy, but it is
 * `launchTokenFor`, gated on `msg.sender == launchForwarder`, and JapanPad is
 * not that forwarder. The honest replacement is the ordinary buy on the token
 * page — a separate transaction, and one that can be front-run — so the success
 * screen sends the creator there rather than promising something else.
 */

type Step = "theme" | "stock" | "details" | "review";

const EMPTY: LaunchDraft = {
  themeId: "",
  name: "",
  symbol: "",
  description: "",
  image: "",
  link: "",
  x: "",
  stockTicker: "",
};

export interface LaunchFlowProps {
  initialThemeId: string | null;
  /** False when Pons has paused launching. The button says so instead of reverting. */
  launchEnabled: boolean;
  /**
   * Pons's terms as strings, because bigints do not cross the server boundary.
   * Shown for context only — what actually gets signed is re-read on the server
   * inside `prepareLaunch`, since every one of these is owner-mutable.
   */
  launchFeeWei: string;
  supply: string;
  graduationThresholdWei: string;
  curveFeeBps: number;
}

export function LaunchFlow(props: LaunchFlowProps) {
  const [step, setStep] = useState<Step>(props.initialThemeId ? "details" : "theme");
  const [draft, setDraft] = useState<LaunchDraft>({
    ...EMPTY,
    themeId: props.initialThemeId ?? "",
  });
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const tx = useTx();
  const { address, chainId, ready, switchChain } = useWallet();

  const theme = draft.themeId ? getTheme(draft.themeId) : null;
  const supply = BigInt(props.supply);

  function edit(patch: Partial<LaunchDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    // Any edit invalidates a plan the server built from the previous values.
    setPlan(null);
    setProblem(null);
    tx.reset();
  }

  async function review() {
    setPreparing(true);
    setProblem(null);
    try {
      const result = await prepareLaunch(draft);
      if (!result.ok) {
        setProblem(result.error);
        return;
      }
      setPlan(result.plan);
      setStep("review");
    } catch {
      setProblem("Could not reach the server to prepare this launch. Try again.");
    } finally {
      setPreparing(false);
    }
  }

  async function launch() {
    if (!plan || !PONS_FACTORY) return;
    await tx.send({
      address: PONS_FACTORY,
      abi: ponsV2FactoryAbi,
      functionName: "launchToken",
      // Passed through exactly as the server built it. `expectedEconomics` is a
      // digest of Pons's own owner-mutable terms; if any moved since
      // prepareLaunch read them this reverts with LaunchEconomicsMismatch
      // rather than launching on terms nobody quoted.
      args: [plan.params, LAUNCH_CONFIG_ID, NATIVE_QUOTE],
      // Exact, not a maximum. A wei over fails the same way a wei under does.
      value: BigInt(plan.launchFeeWei),
    });
  }

  // The addresses that were actually created, taken from the receipt rather than
  // from the simulation. Pons deploys a token and its curve together and names
  // both in one event.
  const launched = useMemo((): { token: Address; curve: Address } | null => {
    if (!tx.receipt) return null;
    const [event] = parseEventLogs({
      abi: ponsV2FactoryAbi,
      eventName: "TokenLaunched",
      logs: tx.receipt.logs,
    });
    return event ? { token: event.args.token, curve: event.args.curve } : null;
  }, [tx.receipt]);

  if (tx.phase === "success" && launched) {
    return <Launched token={launched.token} plan={plan} hash={tx.hash} />;
  }

  const wrongChain = Boolean(address) && !ready && chainId !== null;

  return (
    <div className="space-y-4">
      <Section
        index={1}
        title="Pick a theme"
        open={step === "theme"}
        summary={theme ? theme.name : null}
        onOpen={() => setStep("theme")}
      >
        <p className="text-sm text-muted mb-4 leading-relaxed">
          A theme is how your token files itself for discovery. It is cultural, not
          financial — it references no company and carries no market linkage.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const active = draft.themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  edit({ themeId: t.id });
                  setStep("stock");
                }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-transparent text-paper"
                    : "border-rule bg-paper hover:border-vermilion/60"
                }`}
                style={active ? { backgroundColor: t.accent } : undefined}
              >
                <span
                  className="jp text-xl leading-none shrink-0"
                  style={active ? undefined : { color: t.accent }}
                >
                  {t.japaneseName}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span
                    className={`block text-xs truncate ${active ? "text-paper/75" : "text-muted"}`}
                  >
                    {t.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        index={2}
        title="Measure it against a Tokyo listing"
        open={step === "stock"}
        summary={draft.stockTicker || (draft.themeId ? "ETH only" : null)}
        onOpen={() => (draft.themeId ? setStep("stock") : undefined)}
        disabled={!draft.themeId}
      >
        <p className="text-sm text-muted mb-4 leading-relaxed">
          Optional. This sets the unit your market cap is quoted in, the way a fund
          quotes itself against an index. Your curve still trades in ETH, the token
          is not backed by or affiliated with the company, and nothing here is
          redeemable for a share. It is a yardstick, not a claim.
        </p>
        <StockPicker
          selected={draft.stockTicker || null}
          themeId={draft.themeId || undefined}
          onSelect={(ticker) => {
            edit({ stockTicker: ticker ?? "" });
            setStep("details");
          }}
        />
      </Section>

      <Section
        index={3}
        title="Describe your token"
        open={step === "details"}
        summary={draft.name && draft.symbol ? `${draft.name} (${draft.symbol})` : null}
        onOpen={() => (draft.themeId ? setStep("details") : undefined)}
        disabled={!draft.themeId}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Token name" hint={`${draft.name.length}/${MAX_NAME}`}>
            <input
              className="field"
              maxLength={MAX_NAME}
              value={draft.name}
              placeholder="Neon Alley"
              onChange={(e) => edit({ name: e.target.value })}
            />
          </Field>
          <Field label="Symbol" hint={`${draft.symbol.length}/${MAX_SYMBOL}`}>
            <input
              className="field font-mono uppercase"
              maxLength={MAX_SYMBOL}
              value={draft.symbol}
              placeholder="NEON"
              onChange={(e) => edit({ symbol: e.target.value.toUpperCase() })}
            />
          </Field>
        </div>

        <Field
          label="Description"
          hint={`${draft.description.length}/${MAX_DESCRIPTION}`}
          className="mt-4"
        >
          <textarea
            className="field h-24 py-2 resize-none"
            maxLength={MAX_DESCRIPTION}
            value={draft.description}
            placeholder="What is this token about?"
            onChange={(e) => edit({ description: e.target.value })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 mt-4">
          <Field label="Image URL" hint="optional">
            <input
              className="field"
              value={draft.image}
              placeholder="https:// or ipfs://"
              onChange={(e) => edit({ image: e.target.value })}
            />
          </Field>
          <Field label="Link" hint="optional">
            <input
              className="field"
              value={draft.link}
              placeholder="https://"
              onChange={(e) => edit({ link: e.target.value })}
            />
          </Field>
        </div>

        <Field label="X profile" hint="optional" className="mt-4">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">@</span>
            <input
              className="field"
              maxLength={15}
              value={draft.x}
              placeholder="handle"
              onChange={(e) => edit({ x: e.target.value })}
            />
          </div>
        </Field>

        <div className="mt-6 pt-5 border-t border-rule">
          <p className="label mb-2">What Pons creates</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Term label="Supply">
              {formatTokens(supply)} {draft.symbol || "tokens"}
            </Term>
            <Term label="Trade fee">{(props.curveFeeBps / 100).toFixed(2)}%</Term>
          </dl>
          <p className="mt-3 text-xs text-muted leading-relaxed">
            The curve graduates into a permanently locked Uniswap v4 pool once it has taken{" "}
            <span className="num">
              {formatEth(BigInt(props.graduationThresholdWei))} ETH
            </span>
            . Until then every buy and
            sell happens on the curve, quoted in ETH.
          </p>
        </div>

        {problem ? <Problem>{problem}</Problem> : null}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            className="px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors disabled:opacity-50"
            disabled={preparing || !draft.name.trim() || !draft.symbol.trim()}
            onClick={review}
          >
            {preparing ? "Checking…" : "Review launch"}
          </button>
          <span className="text-xs text-muted">Nothing is signed yet.</span>
        </div>
      </Section>

      <Section
        index={4}
        title="Review and launch"
        open={step === "review"}
        summary={null}
        onOpen={() => (plan ? setStep("review") : undefined)}
        disabled={!plan}
      >
        {plan ? (
          <div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Row label="Token">
                {plan.params.name}{" "}
                <span className="num text-muted">({plan.params.symbol})</span>
              </Row>
              <Row label="Theme">{plan.themeName}</Row>
              <Row label="Total supply">
                <span className="num">
                  {formatTokens(BigInt(plan.supply))} {plan.params.symbol}
                </span>
              </Row>
              <Row label="Trades in">ETH on {CHAIN_NAME}</Row>
              {/*
                Deliberately two separate rows. "Trades in" is what the curve
                actually settles in and is a fact about the contract; "Measured
                against" is a label the creator chose. Collapsing them into one
                "paired with" line is exactly the conflation this product refuses
                to make, so they never share a row even when both are set.
              */}
              {plan.stock && (
                <Row label="Measured against">
                  {plan.stock.name}{" "}
                  <span className="num text-muted">
                    ({plan.stock.ticker} · {plan.stock.currency}{" "}
                    {plan.stock.price.toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    })}
                    )
                  </span>
                </Row>
              )}
            </dl>

            {plan.stock && (
              <p className="mt-3 text-xs text-muted leading-relaxed">
                {plan.stock.name} is a unit of account for this launch and nothing
                more. The token is not issued by, backed by, or affiliated with the
                company, carries no claim on it, and is not redeemable for its
                shares. The price above was read from the Tokyo Stock Exchange when
                this screen was built and moves independently of your curve.
              </p>
            )}

            <div className="mt-5 card p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted">Pons launch fee</span>
                <span className="num">{formatEth(BigInt(plan.launchFeeWei), 6)} ETH</span>
              </div>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Plus gas, and nothing else — JapanPad charges no fee of its own. This amount
                is exact: Pons rejects the launch if the transaction carries any other value,
                which is also why no first buy can ride along with it.
              </p>
            </div>

            <p className="mt-4 text-xs text-muted leading-relaxed">
              Your description is stored on chain with a line naming the {plan.themeName}{" "}
              theme. Neither it nor the name, symbol or image can be edited after launch.
            </p>

            {tx.error ? <Problem>{tx.error}</Problem> : problem ? <Problem>{problem}</Problem> : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!props.launchEnabled ? (
                <span className="text-sm text-sumi/80 bg-sakura/15 border border-sakura/40 rounded-lg px-3 py-2">
                  Pons has launching paused. No token can be created until it is re-enabled.
                </span>
              ) : !address ? (
                <>
                  <WalletButton />
                  <span className="text-sm text-muted">Connect a wallet to sign this.</span>
                </>
              ) : wrongChain ? (
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
                  onClick={switchChain}
                >
                  Switch to {CHAIN_NAME}
                </button>
              ) : (
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors disabled:opacity-50"
                  disabled={tx.busy}
                  onClick={launch}
                >
                  {tx.busy ? txPhaseLabel(tx.phase) : "Launch token"}
                </button>
              )}
              <button
                type="button"
                className="px-4 py-2.5 rounded-full border border-rule text-sm text-muted hover:border-vermilion hover:text-vermilion transition-colors disabled:opacity-50"
                disabled={tx.busy}
                onClick={() => setStep("details")}
              >
                Back
              </button>
            </div>

            {tx.hash ? (
              <p className="mt-3 text-xs text-muted">
                <a
                  className="underline hover:text-vermilion"
                  href={txUrl(tx.hash)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View transaction ↗
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

// ------------------------------------------------------------------- success

function Launched({
  token,
  plan,
  hash,
}: {
  token: Address;
  plan: LaunchPlan | null;
  hash: `0x${string}` | null;
}) {
  return (
    <div className="card p-8 text-center">
      <div className="size-10 rounded-full bg-vermilion/10 grid place-items-center mx-auto">
        <span className="size-2.5 rounded-full bg-vermilion" aria-hidden />
      </div>
      <h2 className="font-display text-xl mt-4">
        {plan ? `${plan.params.name} is live` : "Your token is live"}
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pons deployed the token and its curve. Trading is open — nobody has bought yet.
      </p>
      <p className="num mt-3 text-xs text-muted break-all">{token}</p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/token/${token}`}
          className="px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
        >
          Make the first buy
        </Link>
        {hash ? (
          <a
            href={txUrl(hash)}
            target="_blank"
            rel="noreferrer noopener"
            className="px-5 py-2.5 rounded-full border border-rule text-sm text-muted hover:border-vermilion hover:text-vermilion transition-colors"
          >
            View transaction ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- parts

function Section({
  index,
  title,
  open,
  summary,
  onOpen,
  disabled = false,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  summary: string | null;
  onOpen: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`card ${open ? "" : "bg-ivory/60"}`}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled || open}
        className="w-full flex items-center gap-3 px-5 py-4 text-left disabled:cursor-default"
      >
        <span
          className={`size-6 shrink-0 rounded-full grid place-items-center text-xs ${
            open ? "bg-sumi text-ivory" : "bg-ivory text-muted border border-rule"
          }`}
        >
          {index}
        </span>
        <span className={`font-medium ${disabled ? "text-muted/60" : ""}`}>{title}</span>
        {!open && summary ? (
          <span className="ml-auto text-sm text-muted truncate max-w-[50%]">{summary}</span>
        ) : null}
      </button>
      {open ? <div className="px-5 pb-5">{children}</div> : null}
    </section>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-baseline justify-between mb-1.5">
        <span className="label">{label}</span>
        {hint ? <span className="text-xs text-muted/70">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label mb-1">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-4 text-sm text-vermilion bg-vermilion/8 border border-vermilion/25 rounded-lg px-3 py-2"
    >
      {children}
    </p>
  );
}
