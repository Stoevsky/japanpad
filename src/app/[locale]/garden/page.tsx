import { Link } from "@/i18n/routing";
import { CHAIN_NAME, NATIVE_SYMBOL } from "@/lib/chain";
import { formatEth, formatPercent } from "@/lib/format";
import { listLaunches, type LaunchSummary } from "@/lib/pons/read";
import { THEMES, type Theme } from "@/lib/themes";
import { PageHeader } from "@/components/PageHeader";
import { ExampleGrid, examplesToShow } from "@/components/ExampleCard";
import { EXAMPLE_LAUNCHES } from "@/lib/examples";

/**
 * The Garden — every JapanPad launch at once, arranged by theme.
 *
 * A garden rather than a leaderboard, and that is the whole point. A ranked list
 * reads as a recommendation no matter how it is captioned, and JapanPad reviews
 * nothing and endorses nothing. So the only thing encoded here is where a token
 * sits on its bonding curve, which is a fact the chain will confirm.
 *
 * The three stages are chain state and nothing else: a seed has taken no ETH, a
 * sprout has taken some, a blossom has graduated to a Uniswap pool. None of that
 * says a token is good, safe, or going anywhere — a well-funded curve and an
 * abandoned one look the same from the outside. The page says so out loud rather
 * than leaving the metaphor to imply otherwise.
 */

export const revalidate = 30;

export const metadata = {
  title: "Garden — JapanPad",
  description:
    "Every JapanPad launch arranged by theme and curve stage. Not a ranking.",
};

type Stage = "seed" | "sprout" | "blossom";

const STAGES: Record<Stage, { label: string; jp: string; glyph: string; meaning: string }> = {
  seed: {
    label: "Seed",
    jp: "種",
    glyph: "・",
    meaning: "Launched, with nothing bought on its curve yet.",
  },
  sprout: {
    label: "Sprout",
    jp: "芽",
    glyph: "٭",
    meaning: "Trading on its curve, somewhere short of graduation.",
  },
  blossom: {
    label: "Blossom",
    jp: "花",
    glyph: "✿",
    meaning: "Graduated. Its liquidity has moved to a locked Uniswap v4 pool.",
  },
};

/** Purely a reading of the curve. Nothing here is a judgement about a token. */
function stageOf(launch: LaunchSummary): Stage {
  if (launch.graduated) return "blossom";
  return launch.raised > 0n ? "sprout" : "seed";
}

export default async function GardenPage() {
  const { launches, complete, readAt } = await listLaunches({ limit: 200 });

  const beds = THEMES.map((theme) => ({
    theme,
    plants: launches.filter((l) => l.themeId === theme.id),
  })).filter((bed) => bed.plants.length > 0);

  const padding = examplesToShow(launches.length);

  const counts = launches.reduce(
    (acc, l) => {
      acc[stageOf(l)] += 1;
      return acc;
    },
    { seed: 0, sprout: 0, blossom: 0 } as Record<Stage, number>,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader jp="庭" title="Garden">
        Every JapanPad token, planted in its theme. How far along a plant is
        describes its bonding curve and nothing else.
      </PageHeader>

      <div className="card p-5 mb-8">
        <div className="grid sm:grid-cols-3 gap-5">
          {(Object.keys(STAGES) as Stage[]).map((stage) => (
            <div key={stage} className="flex items-start gap-3">
              <span
                className="font-display text-xl leading-none mt-0.5 text-vermilion/70 shrink-0"
                aria-hidden
              >
                {STAGES[stage].glyph}
              </span>
              <div>
                <p className="text-sm">
                  {STAGES[stage].label}{" "}
                  <span className="jp text-muted opacity-70">{STAGES[stage].jp}</span>
                  {complete ? (
                    <span className="text-muted"> · <span className="num">{counts[stage]}</span></span>
                  ) : null}
                </p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {STAGES[stage].meaning}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted/90 mt-5 pt-4 border-t border-rule leading-relaxed">
          This is not a ranking and not a quality signal. A blossom is a curve that filled
          up, which can happen to anything; a seed may be a week old or an hour old. Nothing
          on JapanPad is reviewed, vetted, or endorsed — read a token&rsquo;s own page and
          its contract before you trade it.
        </p>
      </div>

      {!complete ? (
        <div className="card p-10 text-center">
          <p className="text-sumi/80">The garden is unavailable right now.</p>
          <p className="text-xs text-muted mt-1">
            {CHAIN_NAME} could not be read at {new Date(readAt).toUTCString()}. Nothing is
            shown rather than a stale or invented one.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {beds.length > 0 && (
            <div className="space-y-4">
              {beds.map((bed) => (
                <Bed key={bed.theme.id} theme={bed.theme} plants={bed.plants} />
              ))}
            </div>
          )}

          {padding > 0 && (
            <ExampleGrid
              examples={EXAMPLE_LAUNCHES.slice(0, padding)}
              hasRealLaunches={launches.length > 0}
            />
          )}

          <div className="text-center">
            <Link
              href="/launch"
              className="inline-block px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
            >
              {launches.length === 0
                ? `Plant the first on ${CHAIN_NAME}`
                : `Plant one on ${CHAIN_NAME}`}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Bed({ theme, plants }: { theme: Theme; plants: LaunchSummary[] }) {
  // Furthest along first, so a bed reads left to right like it grew that way.
  const sorted = [...plants].sort((a, b) => b.progress - a.progress);

  return (
    <section
      className="card p-5"
      style={{ borderColor: `${theme.accent}33` }}
      aria-label={`${theme.name} bed`}
    >
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <Link href={`/themes/${theme.id}`} className="flex items-baseline gap-2 group">
          <span className="jp text-lg" style={{ color: theme.accent }}>
            {theme.japaneseName}
          </span>
          <h2 className="font-display font-semibold group-hover:text-vermilion transition-colors">
            {theme.name}
          </h2>
        </Link>
        <span className="text-xs text-muted shrink-0">
          <span className="num">{plants.length}</span>{" "}
          {plants.length === 1 ? "token" : "tokens"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sorted.map((plant) => (
          <Plant key={plant.token} launch={plant} accent={theme.accent} />
        ))}
      </div>
    </section>
  );
}

/**
 * One token as one plant.
 *
 * The stem's height is the curve's progress, so the row is readable at a glance,
 * but the exact number is in the tooltip and on the card — a bar is a summary
 * and should not be the only place a figure appears.
 */
function Plant({ launch, accent }: { launch: LaunchSummary; accent: string }) {
  const stage = stageOf(launch);
  const { glyph, label } = STAGES[stage];
  // Floored so even an untouched curve draws something; a zero-height stem would
  // read as a rendering failure rather than as a seed.
  const stemPct = Math.max(8, Math.min(100, launch.progress * 100));

  return (
    <Link
      href={`/token/${launch.token}`}
      title={`${launch.name || "Untitled"} ($${launch.symbol}) — ${label}, ${formatPercent(
        launch.progress,
        0,
      )} to graduation, ${formatEth(launch.raised)} ${NATIVE_SYMBOL} raised`}
      className="group flex flex-col items-center gap-1 w-20 rounded-lg px-1 py-2 hover:bg-ivory transition-colors"
    >
      <span
        className="font-display text-base leading-none transition-transform group-hover:-translate-y-0.5"
        style={{ color: stage === "seed" ? "var(--color-muted)" : accent }}
        aria-hidden
      >
        {glyph}
      </span>

      <span
        className="w-0.5 rounded-full bg-rule/70 relative overflow-hidden"
        style={{ height: 28 }}
        aria-hidden
      >
        <span
          className="absolute bottom-0 left-0 w-full rounded-full"
          style={{ height: `${stemPct}%`, backgroundColor: accent }}
        />
      </span>

      <span className="num text-[10px] text-muted truncate w-full text-center">
        ${launch.symbol || "?"}
      </span>
    </Link>
  );
}
