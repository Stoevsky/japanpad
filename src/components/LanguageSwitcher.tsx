"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter, routing, type Locale } from "@/i18n/routing";

/**
 * Each language written in itself, which is the one labelling rule that works
 * without already knowing the language. A visitor who cannot read "Japanese"
 * can still recognise 日本語.
 */
const NAMES: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
};

/**
 * Switches language without leaving the page.
 *
 * `usePathname` here is next-intl's, so it returns the route without the locale
 * segment — `/explore` whether the visitor is at `/explore` or `/ja/explore`.
 * Handing that to `router.replace` with a locale rebuilds the other side's URL,
 * so reading a token page in English and switching to Japanese lands on the
 * same token rather than back at the home page.
 *
 * The transition keeps the old text on screen while the new locale's route
 * loads. Without it the control would flicker through an empty state on every
 * switch, since these pages are server-rendered.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-rule overflow-hidden text-[11px] ${className}`}
      // A group of related controls, named so a screen reader announces what
      // the two buttons are choosing between rather than just reading "EN".
      role="group"
      aria-label="Language"
    >
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            disabled={active || isPending}
            // Tells assistive tech which one is the current language, rather
            // than leaving it to be inferred from the colour.
            aria-current={active ? "true" : undefined}
            lang={code}
            onClick={() =>
              startTransition(() => {
                router.replace(pathname, { locale: code });
              })
            }
            className={[
              "px-2.5 py-1.5 transition-colors",
              code === "ja" ? "jp" : "tracking-[0.1em]",
              active
                ? "bg-sumi text-ivory"
                : "text-sumi/60 hover:text-vermilion disabled:opacity-50",
            ].join(" ")}
          >
            {NAMES[code]}
          </button>
        );
      })}
    </div>
  );
}
