import { Link } from "@/i18n/routing";
import { CHAIN_NAME } from "@/lib/chain";
import { THEMES, getTheme } from "@/lib/themes";
import { listLaunches } from "@/lib/pons/read";
import { LaunchCard } from "@/components/LaunchCard";
import { ExampleGrid, examplesToShow } from "@/components/ExampleCard";
import { EXAMPLE_LAUNCHES } from "@/lib/examples";
import { PageHeader } from "@/components/PageHeader";

export const revalidate = 20;

export const metadata = {
  title: "Explore — JapanPad",
  description: "Tokens launched through JapanPad.",
};

type SortKey = "new" | "progress" | "raised";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "new", label: "Newest" },
  { key: "progress", label: "Closest to graduation" },
  { key: "raised", label: "Most raised" },
];

export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const themeId = params.theme && getTheme(params.theme) ? params.theme : undefined;
  const sort: SortKey =
    params.sort === "progress" || params.sort === "raised" ? params.sort : "new";

  const { launches, complete, readAt } = await listLaunches({ limit: 48, themeId });

  const sorted = [...launches].sort((a, b) => {
    if (sort === "progress") return b.progress - a.progress;
    if (sort === "raised") return b.raised > a.raised ? 1 : b.raised < a.raised ? -1 : 0;
    return b.blockNumber > a.blockNumber ? 1 : -1;
  });

  const activeTheme = themeId ? getTheme(themeId) : null;

  // Placeholders finish the row the real launches started, and only on the
  // unfiltered view. See examplesToShow.
  const padding = activeTheme ? 0 : examplesToShow(sorted.length);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <PageHeader jp="探す" title="Explore">
        Tokens launched through JapanPad, read live from Pons on {CHAIN_NAME}.
      </PageHeader>

      <p className="label mb-2">Theme</p>
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill href="/explore" active={!themeId} label="All" />
        {THEMES.map((t) => (
          <FilterPill
            key={t.id}
            href={`/explore?theme=${t.id}${sort !== "new" ? `&sort=${sort}` : ""}`}
            active={themeId === t.id}
            label={t.name}
            accent={t.accent}
          />
        ))}
      </div>

      <p className="label mb-2">Sort</p>
      <div className="flex flex-wrap gap-2 mb-8 text-xs">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={`/explore?${themeId ? `theme=${themeId}&` : ""}sort=${s.key}`}
            /*
              Sort is the secondary control on this page: the theme pills above
              carry each theme's own accent, and a solid sumi fill here read as
              heavier than them, which put the emphasis on the wrong row. Same
              selected/unselected structure, a quieter fill.
            */
            className={
              sort === s.key
                ? "px-3 py-1 rounded-full border border-sumi/25 bg-sumi/8 text-sumi"
                : "px-3 py-1 rounded-full border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
            }
            aria-current={sort === s.key ? "true" : undefined}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {!complete ? (
        <div className="card p-10 text-center">
          <p className="text-sumi/80">Launch data is unavailable right now.</p>
          <p className="text-xs text-muted mt-1">
            The chain could not be read at {new Date(readAt).toUTCString()}. Nothing is
            shown rather than a stale or invented list.
          </p>
        </div>
      ) : sorted.length === 0 && activeTheme ? (
        /*
          Under a theme filter the honest answer is that this theme is empty.
          Padding it with placeholders drawn from other themes would answer a
          question nobody asked.
        */
        <div className="card p-10 text-center">
          <p className="font-display text-lg">Nothing in {activeTheme.name} yet.</p>
          <p className="text-sm text-muted mt-1">
            No JapanPad token has been filed under this theme so far.
          </p>
          <Link
            href="/launch"
            className="inline-block mt-4 px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
          >
            Launch one
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {sorted.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {sorted.map((l) => (
                <LaunchCard key={l.token} launch={l} />
              ))}
            </div>
          )}

          {padding > 0 && (
            <ExampleGrid
              examples={EXAMPLE_LAUNCHES.slice(0, padding)}
              hasRealLaunches={sorted.length > 0}
            />
          )}

          <div className="text-center">
            <Link
              href="/launch"
              className="inline-block px-5 py-2.5 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
            >
              {sorted.length === 0
                ? `Launch the first on ${CHAIN_NAME}`
                : `Launch one on ${CHAIN_NAME}`}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  accent,
}: {
  href: string;
  active: boolean;
  label: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "px-3 py-1.5 rounded-full text-sm text-paper"
          : "px-3 py-1.5 rounded-full text-sm border border-rule bg-paper text-sumi/75 hover:border-vermilion hover:text-vermilion transition-colors"
      }
      style={active ? { backgroundColor: accent ?? "var(--color-vermilion)" } : undefined}
      aria-current={active ? "true" : undefined}
    >
      {label}
    </Link>
  );
}
