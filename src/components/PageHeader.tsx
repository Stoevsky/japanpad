/**
 * The masthead every page below the homepage wears.
 *
 * Each page used to roll its own — three of them happened to converge on a
 * display title with a Japanese word beside it, two did not, and the gap read
 * as carelessness rather than variety. One component means the rhythm is the
 * same everywhere: title, its Japanese reading, then a lede.
 *
 * It now carries the hero photograph as a band. The homepage hero establishes
 * where this site is, and a page that drops straight onto paper reads as
 * somewhere else — the same logo on a different site. The band is full-bleed,
 * so it has to break out of the centred column its callers sit inside: the
 * negative margins undo their `px-5 py-12`, and the inner div re-establishes
 * the same `max-w-6xl` so the title still lines up with the content beneath it.
 *
 * The seigaiha hairline that used to close this header is gone. It existed to
 * separate the heading from the page; the band's own edge does that now, and
 * keeping both gave two separators in a row.
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
    <header className="hero-band -mx-5 -mt-12 mb-10 px-5 pt-14 pb-10 sm:pt-16 sm:pb-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-ivory">
            {title}
          </h1>
          <span className="jp text-xl tracking-[0.2em] text-ivory/55" aria-hidden>
            {jp}
          </span>
        </div>

        {children ? (
          <p className="text-ivory/75 mt-2.5 max-w-2xl leading-relaxed">{children}</p>
        ) : null}
      </div>
    </header>
  );
}
