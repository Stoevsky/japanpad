import { getTheme } from "@/lib/themes";
import type { ExampleLaunch } from "@/lib/examples";

/**
 * A placeholder shaped like a LaunchCard, marked so it cannot be read as one.
 *
 * Structurally a `div` rather than a `Link` — not styled to look unclickable,
 * actually unclickable, with no token page or trade panel behind it. The badge
 * is inside the card because a single disclaimer above a grid is read once and
 * then scrolled past, while the cards themselves get screenshotted and shared
 * on their own.
 *
 * Where LaunchCard prints a curve bar and a raised figure, this prints a dashed
 * rule and a dash. See lib/examples.ts for why there is no number there.
 */
export function ExampleCard({ example }: { example: ExampleLaunch }) {
  const theme = getTheme(example.themeId);

  return (
    <div
      className="card p-4 flex flex-col gap-3 opacity-75 border-dashed select-none"
      aria-label={`Example card: ${example.name}. Not a real listing.`}
    >
      <div className="flex items-start gap-3">
        <div
          className="size-11 rounded-lg shrink-0 overflow-hidden border border-dashed border-rule bg-ivory flex items-center justify-center"
          style={theme ? { borderColor: `${theme.accent}44` } : undefined}
        >
          <span className="jp text-sm opacity-60" style={{ color: theme?.accent }}>
            {theme?.japaneseName.slice(0, 1) ?? "・"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display font-semibold truncate text-sumi/70">
              {example.name}
            </h3>
            <span className="num text-xs text-muted shrink-0">${example.symbol}</span>
          </div>
          <p className="text-[11px] text-muted truncate">not launched</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {theme && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full border border-dashed"
            style={{
              color: theme.accent,
              borderColor: `${theme.accent}55`,
            }}
          >
            {theme.name} <span className="jp opacity-70">{theme.japaneseName}</span>
          </span>
        )}
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="h-1.5 rounded-full border border-dashed border-rule" aria-hidden />
        <div className="flex justify-between text-[11px] text-muted">
          <span>Example</span>
          <span aria-hidden>—</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The grid of placeholders, with the claim stated once above it as well.
 *
 * Rendered only where a live read has already succeeded and come back empty, so
 * this never stands in for data that failed to load — that case has its own
 * "unavailable" panel, and conflating the two would turn an outage into a page
 * that looks populated.
 */
export function ExampleGrid({ examples }: { examples: readonly ExampleLaunch[] }) {
  return (
    <section aria-label="Example cards">
      <div className="card p-4 mb-4 border-dashed">
        <p className="text-sm">
          <span className="text-[10px] align-middle mr-2 px-2 py-0.5 rounded-full border border-dashed border-vermilion/50 text-vermilion uppercase tracking-wide">
            Examples
          </span>
          Nothing has launched through JapanPad yet.
        </p>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          The cards below are placeholders showing what a launch looks like here. They are
          not tokens, they carry no price and no contract, and they cannot be traded. They
          disappear the moment a real launch exists.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
        {examples.map((e) => (
          <ExampleCard key={e.symbol} example={e} />
        ))}
      </div>
    </section>
  );
}
