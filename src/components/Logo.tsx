/**
 * The JapanPad mark: Mount Fuji against a rising sun.
 *
 * Drawn rather than imported so it inherits colour from CSS and stays sharp at
 * every size. Three decisions keep it from reading as the generic crypto-Japan
 * mountain:
 *
 * - The sun sits off-centre and behind the right slope, so the composition is
 *   asymmetric. A centred sun behind a centred peak is the shape everyone
 *   draws.
 * - Fuji's lower slopes flare concave, which is what the actual mountain does
 *   and what a plain triangle misses.
 * - The snow cap is cut as negative space in the paper colour, not painted on
 *   in white, so it works on any background the mark is placed against.
 *
 * `detail` drops the water line and the cap notch for small sizes — below about
 * 20px they turn to mush. The favicon at app/icon.svg is the same drawing with
 * detail off and fixed colours.
 */
export function Logo({
  className = "",
  detail = true,
}: {
  className?: string;
  detail?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 40 32"
      className={className}
      role="img"
      aria-label="JapanPad"
      fill="none"
    >
      {/* Rising sun, behind the mountain and off to the right. */}
      <circle cx="26.5" cy="11.5" r="6.75" className="fill-gold/55" />

      {/* Fuji. Straight upper slopes, concave flare into the base. */}
      <path
        d="M2.5 28.4C9 27.6 13.4 19.2 17.15 12.4L20 7.1L22.85 12.4C26.6 19.2 31 27.6 37.5 28.4Z"
        className="fill-vermilion"
      />

      {/* Snow cap, cut in the paper colour so it reads as negative space. */}
      {detail ? (
        <path
          d="M17.15 12.4L20 7.1L22.85 12.4L21.5 11.5L20.3 12.9L19.05 11.6L18.1 12.8Z"
          className="fill-paper"
        />
      ) : null}

      {/* Seigaiha hint: the water the mountain stands over. */}
      {detail ? (
        <g className="stroke-vermilion/35" strokeWidth="1.4" strokeLinecap="round">
          <path d="M4 30.8h9" />
          <path d="M16.5 30.8h7" />
          <path d="M27 30.8h9" />
        </g>
      ) : null}
    </svg>
  );
}

/**
 * Mark plus wordmark, as used in the header and footer.
 *
 * "Pad" takes the vermilion so the eye lands on the Japanese half first, and
 * 日本 rides alongside at a small size as a reading aid rather than decoration.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo className="w-7 h-[22px] shrink-0" />
      <span className="font-display text-xl font-bold tracking-tight leading-none">
        Japan<span className="text-vermilion">Pad</span>
      </span>
      <span className="hidden sm:inline text-[10px] text-muted tracking-[0.25em] leading-none jp">
        日本
      </span>
    </span>
  );
}
