/**
 * Placeholder cards for an Explore page with nothing on it yet.
 *
 * ---------------------------------------------------------------------------
 * WHAT THESE ARE ALLOWED TO CONTAIN, AND WHY IT MATTERS
 * ---------------------------------------------------------------------------
 * These are not launches. They carry a name, a ticker and a theme, and that is
 * the entire list — deliberately. There is no price here, no amount raised, no
 * market cap, no graduation progress, and no deployer address, because those
 * are the fields a visitor reads as a claim about a market. A card showing
 * "0.8 ETH raised · 19% to graduation" for a coin that does not exist is a
 * fabricated financial figure on a site with a live trade panel, and someone
 * will act on it.
 *
 * A name and a theme claim nothing. They show what the grid looks like when it
 * fills up, which is the honest version of the thing an empty page needs.
 *
 * Consequently:
 *   - every card is badged, in the card, not in a footnote
 *   - no card is a link; there is no token page and no trade panel behind it
 *   - they render only when a real read succeeded and returned nothing, so the
 *     first genuine launch removes them with no code change
 *
 * If a figure is ever wanted on one of these, the answer is to launch a real
 * coin — mainnet Pons works and the launch fee is 0.0005 ETH — not to invent
 * the figure.
 */

export interface ExampleLaunch {
  /** Ticker, shown as $SYMBOL exactly like a real card. */
  symbol: string;
  name: string;
  /** Must be a real theme id; the card borrows that theme's accent. */
  themeId: string;
}

export const EXAMPLE_LAUNCHES: readonly ExampleLaunch[] = [
  { symbol: "SAKURA", name: "Sakura Season", themeId: "nature" },
  { symbol: "RAMEN", name: "Midnight Ramen", themeId: "food" },
  { symbol: "MECHA", name: "Mecha Garden", themeId: "robotics" },
  { symbol: "NEON", name: "Neon Alley", themeId: "street" },
  { symbol: "ARCADE", name: "Arcade Ward", themeId: "gaming" },
  { symbol: "KOTO", name: "Koto Strings", themeId: "music" },
  { symbol: "AIZOME", name: "Indigo Dye", themeId: "tradition" },
  { symbol: "CEL", name: "Cel Shaded", themeId: "anime" },
] as const;
