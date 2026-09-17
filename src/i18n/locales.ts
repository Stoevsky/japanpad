/**
 * The languages the site ships, and nothing else.
 *
 * Separate from routing.ts because that module pulls in `createNavigation`,
 * which reaches for `next/navigation` and so only resolves inside a Next
 * runtime. The list of languages is plain data, and things that are not Next —
 * the catalogue parity test, and any script — need to read it without standing
 * up a framework to do so.
 *
 * Adding a language starts here, then needs a `messages/<code>/` directory with
 * one file per namespace. messages.test.ts fails until that directory matches
 * the default locale's, which is the intended way to find out what is missing.
 */
export const LOCALES = ["en", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
