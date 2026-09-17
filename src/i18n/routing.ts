import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

export type { Locale } from "./locales";

/**
 * The two languages the site is written in, and how they map onto URLs.
 *
 * `as-needed` is the load-bearing choice here. It keeps English on the paths
 * that already exist — `/explore` stays `/explore`, not `/en/explore` — so
 * every link already shared, indexed, or pasted into a chat keeps working, and
 * Japanese gets its own tree at `/ja/*`.
 *
 * The alternative most sites reach for is a locale cookie with one set of URLs.
 * That is the wrong trade for this site specifically: reading a cookie during
 * render opts a route out of static generation, and the pages that matter here
 * (Explore, Garden, Themes) are the ones that walk Pons's launch history over
 * RPC. They are cheap today only because ISR renders them a handful of times
 * per minute and everyone shares the result. Per-request rendering would put
 * that chain scan on the critical path of every visit.
 *
 * Locale-in-the-path costs nothing at render time and lets each language be
 * prerendered and revalidated on its own.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
});

/**
 * Locale-aware replacements for `next/link` and friends.
 *
 * Components import `Link` from here rather than from `next/link`, which is
 * what keeps a visitor reading Japanese inside `/ja/*` when they click through.
 * A plain `next/link` to `/explore` would silently drop them back into English.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
