import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * One file per namespace, per language.
 *
 * A single catalogue file would be one 700-line JSON object that every change
 * to any page has to edit, which makes conflicts the normal case rather than
 * the exception. Splitting by namespace means a change to the launch form
 * touches launch.json and nothing else.
 *
 * The list is spelled out rather than globbed because bundlers resolve
 * `import()` at build time: a directory read would work in dev and ship an
 * empty catalogue. Adding a namespace means adding a line here and two files.
 */
const NAMESPACES = [
  "meta",
  "nav",
  "footer",
  "common",
  "landing",
  "explore",
  "themes",
  "garden",
  "howItWorks",
  "launch",
  "token",
  "trade",
  "wallet",
  "errors",
] as const;

/**
 * Loads the message catalogue for whichever locale the request resolved to.
 *
 * `hasLocale` rather than a cast: the segment arrives from the URL, so a
 * visitor can type `/xx/explore` and it would otherwise be used as a filename.
 * Anything unrecognised falls back to English instead of failing the render.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const loaded = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );

  return { locale, messages: Object.fromEntries(loaded) };
});
