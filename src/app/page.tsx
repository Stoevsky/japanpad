import Link from "next/link";
import { Suspense } from "react";
import { CHAIN_NAME } from "@/lib/chain";
import { THEMES } from "@/lib/themes";
import { listLaunches } from "@/lib/pons/read";
import { readLaunchTerms } from "@/lib/pons/terms";
import { formatEth, formatPercent, formatTokens } from "@/lib/format";
import { LaunchCard } from "@/components/LaunchCard";
import { ThemeCard } from "@/components/ThemeCard";

// Launches are read from chain on request. Revalidate keeps the homepage cheap
// without letting it drift far from the curve state it is describing.
export const revalidate = 30;

/**
 * The hero.
 *
 * Full-bleed photograph with the copy held to the left third, where the scrim
 * in `.hero-surface` is heaviest. The type is large because the mincho earns
 * it at size and disappears at small sizes; the eyebrow is mono because it is
 * a label, and the site sets every label in mono.
 */
function Hero() {
  return (
    <section className="hero-surface relative min-h-[78vh] flex items-end">
      <div className="relative mx-auto w-full max-w-6xl px-5 pt-28 pb-14">
        <div className="max-w-2xl">
          <p className="rise label">Built on Pons · {CHAIN_NAME}</p>

          <h1
            className="rise font-display text-6xl sm:text-8xl font-bold tracking-tight mt-4 text-ivory leading-[0.95]"
            style={{ animationDelay: "60ms" }}
          >
            Japan<span className="text-sakura">Pad</span>
          </h1>

          <p
            className="rise jp mt-4 text-lg tracking-[0.4em] text-ivory/55"
            style={{ animationDelay: "120ms" }}
            aria-hidden
          >
            日本が オンチェーンへ
          </p>

          <p
            className="rise font-display text-2xl sm:text-3xl mt-5 text-ivory/90"
            style={{ animationDelay: "160ms" }}
          >
            Japan comes onchain.
          </p>

          <p
            className="rise mt-4 max-w-lg text-ivory/70 leading-relaxed"
            style={{ animationDelay: "200ms" }}
          >
            Pick a theme, create your token, and launch it through Pons on{" "}
            {CHAIN_NAME}. Your wallet signs everything; JapanPad never holds your
            funds.
          </p>

          <div
            className="rise flex flex-wrap gap-3 mt-9"
            style={{ animationDelay: "260ms" }}
          >
            <Link
              href="/launch"
              className="px-6 py-3 rounded-full bg-vermilion text-paper hover:bg-vermilion-soft transition-colors"
            >
              Launch a token
            </Link>
            <Link
              href="/explore"
              className="px-6 py-3 rounded-full border border-ivory/30 text-ivory hover:bg-ivory/10 hover:border-ivory/60 transition-colors"
            >
              Explore launches
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The terms, read from Pons at render.
 *
 * Sits immediately under the hero because these four numbers are the whole
 * offer, and a launchpad that makes you click through to find its fee is
 * hiding it. Every one of them is owner-mutable on Pons, so nothing here is
 * hardcoded and the strip says "unavailable" rather than guessing.
 */
async function TermsStrip() {
  const terms = await readLaunchTerms();

  if (!terms) {
    return (
      <div className="border-b border-rule/70 bg-paper/60">
        <div className="mx-auto max-w-6xl px-5 py-4 text-xs text-muted">
          Pons terms are unavailable right now — the chain could not be read.
          Nothing is shown rather than a guessed fee.
        </div>
      </div>
    );
  }

  const items = [
    { label: "Launch fee", value: `${formatEth(terms.launchFeeWei, 6)} ETH` },
    { label: "Supply", value: formatTokens(terms.supply) },
    {
      label: "Graduates at",
      value: `${formatEth(terms.graduationThresholdWei, 4)} ETH`,
    },
    { label: "Curve fee", value: formatPercent(terms.curveFeeBps / 10_000, 2) },
  ];

  return (
    <div className="border-b border-rule/70 bg-paper/60">
      <div className="mx-auto max-w-6xl px-5 py-5 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
        {items.map((it) => (
          <div key={it.label}>
            <p className="label">{it.label}</p>
            <p className="num text-lg mt-1">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TermsSkeleton() {
  return (
    <div className="border-b border-rule/70 bg-paper/60">
      <div className="mx-auto max-w-6xl px-5 py-5 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse opacity-50">
            <div className="h-2 w-16 bg-rule rounded" />
            <div className="h-4 w-24 bg-rule rounded mt-2.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Theme → JapanPad → Robinhood Chain, drawn as one quiet line. */
function Provenance() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-14">
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="px-2.5 py-1 rounded-full border border-rule bg-paper">
          Theme
        </span>
        <span className="h-px flex-1 max-w-14 bg-gradient-to-r from-rule to-vermilion/50" />
        <span className="px-2.5 py-1 rounded-full border border-vermilion/40 bg-paper text-vermilion">
          JapanPad
        </span>
        <span className="h-px flex-1 max-w-14 bg-gradient-to-r from-vermilion/50 to-rule" />
        <span className="px-2.5 py-1 rounded-full border border-rule bg-paper">
          {CHAIN_NAME}
        </span>
      </div>

      <p className="mt-8 max-w-2xl text-xs text-muted/90 leading-relaxed border-l-2 border-rule pl-4">
        JapanPad launches are user-created crypto tokens themed around Japanese
        culture. They are not shares in any company, are not affiliated with or
        endorsed by any company a creator may reference, and confer no ownership,
        dividends, voting rights, or claim on any business.
      </p>
    </section>
  );
}

/** Section heading: vertical Japanese marker, English title, trailing rule. */
function SectionHead({
  jp,
  title,
  sub,
  href,
  hrefLabel,
}: {
  jp: string;
  title: string;
  sub?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex items-start gap-4 mb-7">
      <span
        className="jp tate text-[11px] text-vermilion/70 leading-none pt-1 shrink-0"
        aria-hidden
      >
        {jp}
      </span>
      <div className="flex-1 min-w-0">
        <div className="section-head">
          <h2 className="font-display text-2xl font-semibold shrink-0">{title}</h2>
        </div>
        {sub ? <p className="text-sm text-muted mt-1">{sub}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="text-sm text-vermilion hover:underline shrink-0 pt-1.5"
        >
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}

async function RecentLaunches() {
  const { launches, complete, readAt } = await listLaunches({ limit: 8 });

  if (!complete) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sumi/80">Launch data is unavailable right now.</p>
        <p className="text-xs text-muted mt-1">
          The chain could not be read at {new Date(readAt).toUTCString()}. Nothing is
          shown rather than a stale or invented list.
        </p>
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg">No launches yet.</p>
        <p className="text-sm text-muted mt-1">
          Nothing has been launched through JapanPad on {CHAIN_NAME} so far.
        </p>
        <Link
          href="/launch"
          className="inline-block mt-4 px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
        >
          Be the first
        </Link>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {launches.map((l) => (
        <LaunchCard key={l.token} launch={l} />
      ))}
    </div>
  );
}

function LaunchesSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 h-40 animate-pulse opacity-60" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Hero />

      <Suspense fallback={<TermsSkeleton />}>
        <TermsStrip />
      </Suspense>

      <Provenance />

      <section className="mx-auto max-w-6xl px-5 py-14">
        <SectionHead
          jp="発行"
          title="Recent launches"
          sub={`Read live from Pons on ${CHAIN_NAME}.`}
          href="/explore"
          hrefLabel="See all"
        />
        <Suspense fallback={<LaunchesSkeleton />}>
          <RecentLaunches />
        </Suspense>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8">
        <SectionHead
          jp="テーマ"
          title="Themes"
          sub="Ten corners of Japanese culture to launch under."
          href="/themes"
          hrefLabel="All themes"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {THEMES.slice(0, 5).map((t) => (
            <ThemeCard key={t.id} theme={t} />
          ))}
        </div>
      </section>
    </>
  );
}
