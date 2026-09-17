import { Link } from "@/i18n/routing";
import type { Theme } from "@/lib/themes";

export function ThemeCard({ theme, count }: { theme: Theme; count?: number }) {
  return (
    <Link
      href={`/themes/${theme.id}`}
      className="card card-link p-5 flex flex-col gap-2 group"
    >
      <div className="flex items-baseline justify-between">
        {/*
          Set in the `.jp` stack, not `font-display`. Shippori Mincho is loaded
          latin-only, so these glyphs were already falling through to a system
          face — this names the one they land on instead of leaving it to chance.
        */}
        <span className="jp text-2xl leading-none" style={{ color: theme.accent }}>
          {theme.japaneseName}
        </span>
        {count !== undefined && (
          <span className="text-xs text-muted">
            <span className="num">{count}</span>{" "}
            {count === 1 ? "launch" : "launches"}
          </span>
        )}
      </div>
      <h3 className="font-display font-semibold group-hover:text-vermilion transition-colors">
        {theme.name}
      </h3>
      <p className="text-xs text-muted leading-relaxed">{theme.description}</p>
    </Link>
  );
}
