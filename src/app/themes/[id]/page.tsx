import Link from "next/link";
import { notFound } from "next/navigation";
import { CHAIN_NAME } from "@/lib/chain";
import { THEMES, getTheme, themeMetadata } from "@/lib/themes";
import { listLaunches } from "@/lib/pons/read";
import { LaunchCard } from "@/components/LaunchCard";

export const revalidate = 30;

export function generateStaticParams() {
  return THEMES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return themeMetadata(id);
}

export default async function ThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const theme = getTheme(id);
  if (!theme) notFound();

  const { launches, complete } = await listLaunches({ limit: 48, themeId: id });

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <Link href="/themes" className="text-sm text-muted hover:text-vermilion">
        ← All themes
      </Link>

      <header className="mt-6 mb-10">
        <div className="flex items-start gap-5">
          <span
            className="jp text-5xl leading-none shrink-0"
            style={{ color: theme.accent }}
          >
            {theme.japaneseName}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
              {theme.name}
            </h1>
            <p className="text-muted mt-2 max-w-xl leading-relaxed">
              {theme.description}
            </p>
          </div>
        </div>
        <div className="wave-rule opacity-40 mt-6" aria-hidden />
      </header>

      {!complete ? (
        <div className="card p-10 text-center text-sumi/80">
          Launch data is unavailable right now.
        </div>
      ) : launches.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-display text-lg">Nothing here yet.</p>
          <p className="text-sm text-muted mt-1">
            No JapanPad token on {CHAIN_NAME} has filed itself under {theme.name}.
          </p>
          <Link
            href={`/launch?theme=${theme.id}`}
            className="inline-block mt-4 px-5 py-2.5 rounded-full text-paper text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: theme.accent }}
          >
            Launch in {theme.name}
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {launches.map((l) => (
            <LaunchCard key={l.token} launch={l} />
          ))}
        </div>
      )}
    </div>
  );
}
