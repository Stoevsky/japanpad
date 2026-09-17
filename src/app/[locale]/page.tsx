import { Link } from "@/i18n/routing";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CHAIN_NAME, NATIVE_SYMBOL } from "@/lib/chain";
import { THEMES } from "@/lib/themes";
import { listLaunches } from "@/lib/pons/read";
import { readLaunchTerms } from "@/lib/pons/terms";
import { STOCK_CATALOG, isCatalogTicker } from "@/lib/stocks/catalog";
import { getStockQuote } from "@/lib/stocks/quotes";
import { formatEth, formatPercent, formatTokens } from "@/lib/format";
import { LaunchCard } from "@/components/LaunchCard";
import { ContractAddress } from "@/components/ContractAddress";
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
async function Hero() {
  const t = await getTranslations("landing");

  return (
    <section className="hero-surface relative min-h-[78vh] flex items-end">
      <div className="relative mx-auto w-full max-w-6xl px-5 pt-28 pb-14">
        <div className="max-w-2xl">
          <p className="rise label">{t("hero.eyebrow", { chain: CHAIN_NAME })}</p>

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
            {t("hero.tagline")}
          </p>

          <p
            className="rise mt-4 max-w-lg text-ivory/70 leading-relaxed"
            style={{ animationDelay: "200ms" }}
          >
            {t("hero.body", { chain: CHAIN_NAME })}
          </p>

          {/* Sits between the copy and the CTAs, so it is the middle of the
              hero block and is reachable on phones, where the header hides it. */}
          <div className="rise mt-7" style={{ animationDelay: "230ms" }}>
            <ContractAddress variant="hero" />
          </div>

          <div
            className="rise flex flex-wrap gap-3 mt-7"
            style={{ animationDelay: "260ms" }}
          >
            <Link
              href="/launch"
              className="px-6 py-3 rounded-full bg-vermilion text-paper hover:bg-vermilion-soft transition-colors"
            >
              {t("hero.ctaLaunch")}
            </Link>
            <Link
              href="/explore"
              className="px-6 py-3 rounded-full border border-ivory/30 text-ivory hover:bg-ivory/10 hover:border-ivory/60 transition-colors"
            >
              {t("hero.ctaExplore")}
            </Link>
          </div>

          {/*
            Three counts, all derived from source rather than written as copy —
            the catalog and the theme list are the same arrays the picker reads,
            so these numbers cannot drift from what the product actually offers.
          */}
          <div
            className="rise flex flex-wrap gap-2 mt-8"
            style={{ animationDelay: "320ms" }}
          >
            {[
              t("hero.statListings", { count: STOCK_CATALOG.length }),
              t("hero.statThemes", { count: THEMES.length }),
              t("hero.statSettles", { symbol: NATIVE_SYMBOL }),
            ].map((chip) => (
              <span
                key={chip}
                className="bubble text-ivory/80"
                style={{
                  borderColor: "rgba(247, 241, 231, 0.22)",
                  backgroundColor: "rgba(247, 241, 231, 0.08)",
                }}
              >
                {chip}
              </span>
            ))}
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
  const t = await getTranslations("landing");
  const terms = await readLaunchTerms();

  if (!terms) {
    return (
      <div className="border-b border-rule/70 bg-paper/60">
        <div className="mx-auto max-w-6xl px-5 py-4 text-xs text-muted">
          {t("terms.unavailable")}
        </div>
      </div>
    );
  }

  const items = [
    { label: t("terms.launchFee"), value: `${formatEth(terms.launchFeeWei, 6)} ${NATIVE_SYMBOL}` },
    { label: t("terms.supply"), value: formatTokens(terms.supply) },
    {
      label: t("terms.graduatesAt"),
      value: `${formatEth(terms.graduationThresholdWei, 4)} ${NATIVE_SYMBOL}`,
    },
    { label: t("terms.curveFee"), value: formatPercent(terms.curveFeeBps / 10_000, 2) },
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
async function Provenance() {
  const t = await getTranslations("landing");

  return (
    <section className="mx-auto max-w-6xl px-5 pt-14">
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="px-2.5 py-1 rounded-full border border-rule bg-paper">
          {t("provenance.theme")}
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
        {t("provenance.disclaimer")}
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

/**
 * Decorative colour behind a glass panel.
 *
 * Frosted glass over flat ivory is invisible — `backdrop-filter` needs
 * something worth blurring. These supply it. Purely presentational, so they are
 * hidden from assistive technology.
 */
function Orbs({
  spec,
}: {
  spec: Array<{ x: string; y: string; size: string; color: string; delay?: string }>;
}) {
  return (
    <div aria-hidden>
      {spec.map((o, i) => (
        <span
          key={i}
          className="orb"
          style={{
            left: o.x,
            top: o.y,
            width: o.size,
            height: o.size,
            backgroundColor: o.color,
            animationDelay: o.delay ?? "0s",
          }}
        />
      ))}
    </div>
  );
}

/** The four steps, as glass. */
async function Steps() {
  const t = await getTranslations("landing");

  const steps = [
    {
      n: "01",
      jp: "選ぶ",
      title: t("steps.one.title"),
      body: t("steps.one.body"),
    },
    {
      n: "02",
      jp: "測る",
      title: t("steps.two.title"),
      body: t("steps.two.body", { count: STOCK_CATALOG.length }),
    },
    {
      n: "03",
      jp: "発行",
      title: t("steps.three.title"),
      body: t("steps.three.body"),
    },
    {
      n: "04",
      jp: "卒業",
      title: t("steps.four.title"),
      body: t("steps.four.body", { symbol: NATIVE_SYMBOL }),
    },
  ];

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16">
      <Orbs
        spec={[
          { x: "4%", y: "12%", size: "260px", color: "rgba(168, 38, 50, 0.20)" },
          { x: "42%", y: "0%", size: "300px", color: "rgba(223, 166, 175, 0.30)", delay: "-4s" },
          { x: "76%", y: "34%", size: "280px", color: "rgba(200, 163, 93, 0.24)", delay: "-8s" },
        ]}
      />

      <SectionHead
        jp="仕組み"
        title={t("steps.heading")}
        sub={t("steps.sub")}
        href="/how-it-works"
        hrefLabel={t("steps.more")}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <div key={s.n} className="glass p-5">
            <div className="relative flex items-baseline justify-between">
              <span className="num text-xs text-vermilion/80">{s.n}</span>
              <span className="jp text-xs text-muted/70" aria-hidden>
                {s.jp}
              </span>
            </div>
            <h3 className="relative font-display text-lg font-semibold mt-3">
              {s.title}
            </h3>
            <p className="relative text-[13px] text-sumi/75 leading-relaxed mt-2">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * What a denomination is, and — at equal length — what it is not.
 *
 * The two columns are deliberately the same weight. Explaining the feature
 * without giving equal room to its limits is how a measurement starts sounding
 * like a backing, which is the one impression this product cannot afford.
 */
async function Denomination() {
  const t = await getTranslations("landing");

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-6">
      <Orbs
        spec={[
          { x: "10%", y: "20%", size: "340px", color: "rgba(124, 154, 109, 0.22)" },
          { x: "68%", y: "6%", size: "300px", color: "rgba(168, 38, 50, 0.18)", delay: "-6s" },
        ]}
      />

      <SectionHead
        jp="尺度"
        title={t("denomination.heading", { symbol: NATIVE_SYMBOL })}
        sub={t("denomination.sub")}
      />

      <div className="glass p-6 sm:p-8">
        <div className="relative grid md:grid-cols-2 gap-8">
          <div>
            <p className="label text-vermilion/80">{t("denomination.isLabel")}</p>
            <p className="mt-3 text-sm text-sumi/85 leading-relaxed">
              {t("denomination.isBodyOne", { count: STOCK_CATALOG.length })}
            </p>
            <p className="mt-3 text-sm text-sumi/85 leading-relaxed">
              {t("denomination.isBodyTwo")}
            </p>
          </div>

          <div className="md:border-l md:border-rule/80 md:pl-8">
            <p className="label text-vermilion/80">
              {t("denomination.isNotLabel")}
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-sumi/85 leading-relaxed">
              {[
                t("denomination.notBacking"),
                t("denomination.notOwnership"),
                t("denomination.notRedeemable"),
                t("denomination.notAffiliation"),
                t("denomination.notLinked", { symbol: NATIVE_SYMBOL }),
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className="text-vermilion/60 shrink-0" aria-hidden>
                    ·
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The four things JapanPad deliberately does not do. */
async function Assurances() {
  const t = await getTranslations("landing");

  const items = [
    {
      jp: "無管理",
      title: t("assurances.custody.title"),
      body: t("assurances.custody.body"),
    },
    {
      jp: "無手数料",
      title: t("assurances.fees.title"),
      body: t("assurances.fees.body"),
    },
    {
      jp: "実データ",
      title: t("assurances.data.title"),
      body: t("assurances.data.body"),
    },
    {
      jp: "無審査",
      title: t("assurances.vetting.title"),
      body: t("assurances.vetting.body"),
    },
  ];

  return (
    <section className="relative mx-auto max-w-6xl px-5 py-16">
      <Orbs
        spec={[
          { x: "22%", y: "10%", size: "300px", color: "rgba(200, 163, 93, 0.24)" },
          { x: "72%", y: "40%", size: "260px", color: "rgba(223, 166, 175, 0.28)", delay: "-5s" },
        ]}
      />

      <SectionHead
        jp="約束"
        title={t("assurances.heading")}
        sub={t("assurances.sub")}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it) => (
          <div key={it.title} className="glass p-5">
            <span className="relative jp text-sm text-vermilion/70" aria-hidden>
              {it.jp}
            </span>
            <h3 className="relative font-display text-base font-semibold mt-2">
              {it.title}
            </h3>
            <p className="relative text-[13px] text-sumi/75 leading-relaxed mt-2">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

async function RecentLaunches() {
  const t = await getTranslations("landing");
  const { launches, complete, readAt } = await listLaunches({ limit: 8 });

  if (!complete) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sumi/80">{t("launches.unavailableTitle")}</p>
        <p className="text-xs text-muted mt-1">
          {t("launches.unavailableBody", {
            readAt: new Date(readAt).toUTCString(),
          })}
        </p>
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-lg">{t("launches.emptyTitle")}</p>
        <p className="text-sm text-muted mt-1">
          {t("launches.emptyBody", { chain: CHAIN_NAME })}
        </p>
        <Link
          href="/launch"
          className="inline-block mt-4 px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
        >
          {t("launches.beFirst")}
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

// ---------------------------------------------------------------------------
// The closing band
// ---------------------------------------------------------------------------

/**
 * A sample of the catalog, shown at the foot of the page.
 *
 * Filtered through `isCatalogTicker` rather than trusted, so that removing a
 * listing from the catalog removes it from here too instead of leaving a chip
 * the picker can no longer honour.
 */
const FEATURED: readonly string[] = [
  "7203.T", "7974.T", "6758.T", "8035.T", "6954.T", "9984.T",
  "9983.T", "7267.T", "6861.T", "9432.T", "4063.T", "6501.T",
  "6752.T", "7751.T", "9602.T", "4816.T", "9697.T", "9684.T",
  "7832.T", "2502.T", "2914.T", "4911.T", "4502.T", "8306.T",
  "9020.T", "6098.T", "6367.T", "6301.T", "6981.T", "7951.T",
].filter(isCatalogTicker);

/**
 * The chips, with live company names where the feed answered.
 *
 * Only the thirty shown are fetched, not the whole catalog, and they share the
 * same sixty-second server cache the launch picker uses — so this is usually
 * zero upstream requests. A listing whose quote does not come back still gets a
 * chip, with the ticker alone. The ticker is a fact this repo can state; the
 * company name is not, so it is shown only when something told us what it is.
 */
async function TickerChips() {
  const quotes = await Promise.all(FEATURED.map((t) => getStockQuote(t)));

  return (
    <div className="flex flex-wrap gap-2">
      {FEATURED.map((ticker, i) => {
        const q = quotes[i];
        return (
          <span key={ticker} className="ticker-chip">
            {q ? (
              <>
                <span className="truncate max-w-[13rem]">{q.name}</span>
                <span className="num opacity-55">{ticker}</span>
              </>
            ) : (
              <span className="num">{ticker}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function TickerChipsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {FEATURED.map((t) => (
        <span key={t} className="ticker-chip num">
          {t}
        </span>
      ))}
    </div>
  );
}

/** Torii on the water, in one line. Sets the band off from the page above it. */
function BandCrest() {
  return (
    <svg
      viewBox="0 0 1200 90"
      preserveAspectRatio="none"
      className="w-full h-16 sm:h-20 block"
      aria-hidden
    >
      <path
        d="M0 90 V64 Q150 44 300 58 T600 52 T900 60 T1200 46 V90 Z"
        fill="rgba(247,241,231,0.06)"
      />
      <g stroke="rgba(223,166,175,0.45)" strokeWidth="2.5" fill="none">
        <path d="M542 30 h116" />
        <path d="M536 26 q60 -10 128 0" />
        <path d="M556 30 V74" />
        <path d="M644 30 V74" />
        <path d="M550 42 h100" />
      </g>
      <circle cx="600" cy="14" r="9" fill="rgba(168,38,50,0.55)" />
    </svg>
  );
}

/**
 * The colophon.
 *
 * Wordmark, the catalog it draws on, and the disclaimer — in that order,
 * because the disclaimer is the last thing a reader should have in mind and
 * burying it above the chips would make it decoration.
 */
async function TokyoBand() {
  const t = await getTranslations("landing");
  const shown = FEATURED.length;
  const rest = STOCK_CATALOG.length - shown;
  const byTheme = new Map<string, number>();
  for (const e of STOCK_CATALOG) {
    byTheme.set(e.themeId, (byTheme.get(e.themeId) ?? 0) + 1);
  }

  return (
    <section className="tokyo-band mt-16">
      <BandCrest />

      <div className="mx-auto max-w-6xl px-5 pb-14 -mt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-display text-3xl sm:text-4xl font-bold text-ivory">
              Japan<span className="text-sakura">Pad</span>
            </p>
            <p className="mt-2 text-sm text-ivory/70">{t("band.tagline")}</p>
            <p className="jp mt-1 text-xs tracking-[0.3em] text-ivory/40" aria-hidden>
              東京の 尺度で
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/launch"
              className="px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
            >
              {t("band.ctaLaunch")}
            </Link>
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full border border-ivory/25 text-ivory text-sm hover:bg-ivory/10 hover:border-ivory/50 transition-colors"
            >
              {t("band.ctaExplore")}
            </Link>
          </div>
        </div>

        <div className="h-px my-8 bg-gradient-to-r from-ivory/25 via-ivory/12 to-transparent" />

        <p className="label mb-4">{t("band.denominationsLabel")}</p>

        <Suspense fallback={<TickerChipsSkeleton />}>
          <TickerChips />
        </Suspense>

        {/*
          Rich text rather than three interpolations, because the figures keep
          their mono treatment and each language puts them in a different order
          — Japanese counts the themes before the listings.
        */}
        <p className="mt-5 text-xs text-ivory/55">
          {t.rich("band.counts", {
            rest,
            total: STOCK_CATALOG.length,
            themes: byTheme.size,
            num: (chunks) => <span className="num">{chunks}</span>,
          })}
        </p>

        <p className="mt-8 max-w-3xl text-[11px] leading-relaxed text-ivory/45">
          {t("band.disclaimer")}
        </p>
      </div>
    </section>
  );
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Opts the page into static rendering, which is what `revalidate` above is
  // for. Without it the first translation read below would make the route
  // dynamic and put the Pons launch scan on every visit.
  setRequestLocale(locale);

  const t = await getTranslations("landing");

  return (
    <>
      <Hero />

      <Suspense fallback={<TermsSkeleton />}>
        <TermsStrip />
      </Suspense>

      <Provenance />

      <Steps />

      <section className="mx-auto max-w-6xl px-5 pb-14">
        <SectionHead
          jp="発行"
          title={t("launches.heading")}
          sub={t("launches.sub", { chain: CHAIN_NAME })}
          href="/explore"
          hrefLabel={t("launches.more")}
        />
        <Suspense fallback={<LaunchesSkeleton />}>
          <RecentLaunches />
        </Suspense>
      </section>

      <Denomination />

      <section className="mx-auto max-w-6xl px-5 pt-16">
        <SectionHead
          jp="テーマ"
          title={t("themes.heading")}
          sub={t("themes.sub")}
          href="/themes"
          hrefLabel={t("themes.more")}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {THEMES.slice(0, 5).map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </section>

      <Assurances />

      <TokyoBand />
    </>
  );
}
