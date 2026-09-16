/**
 * The masthead every page below the homepage wears.
 *
 * Each page used to roll its own — three of them happened to converge on a
 * display title with a Japanese word beside it, two did not, and the gap read
 * as carelessness rather than variety. One component means the rhythm is the
 * same everywhere: title, its Japanese reading, a lede, then the seigaiha
 * hairline that separates a heading from the page it heads.
 *
 * The Japanese is marked `aria-hidden` because it is the same word said twice.
 * A screen reader announcing "Explore 探す" is reading decoration aloud.
 */
export function PageHeader({
  jp,
  title,
  children,
}: {
  jp: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
          {title}
        </h1>
        <span className="jp text-xl text-muted/70 tracking-[0.2em]" aria-hidden>
          {jp}
        </span>
      </div>

      {children ? (
        <p className="text-muted mt-2.5 max-w-2xl leading-relaxed">{children}</p>
      ) : null}

      <div className="wave-rule opacity-40 mt-6" aria-hidden />
    </header>
  );
}
