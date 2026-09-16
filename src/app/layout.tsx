import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import Link from "next/link";
import "./globals.css";
import { assertChainConfig, CHAIN_NAME, VALUES_ARE_REAL } from "@/lib/chain";
import { WalletButton } from "@/components/WalletButton";
import { Logo, Wordmark, XMark } from "@/components/Logo";
import { WalletProvider } from "@/components/WalletProvider";

/**
 * Display face. A mincho with actual letterpress character, replacing Noto
 * Serif JP — which is what Google serves when a page asks for Japanese and
 * names nothing specific. Noto is a safety net rather than a choice, and it
 * made every heading here look like every other site's.
 *
 * Vendored rather than pulled through `next/font/google`, and not for taste.
 * Shippori is a CJK family: Google's stylesheet for it is 488 `@font-face`
 * rules, of which exactly 8 carry a `/* latin *\/` marker and the other 480
 * carry no subset comment at all. `next/font/google` filters by that comment,
 * so `subsets: ["latin"]` matches nothing to exclude and it tries to download
 * and self-host all 488 — several megabytes of kana and kanji, at build time,
 * over the network, to render English headings. Measured, not assumed; it is
 * also what made `next build` fail here.
 *
 * So the four Latin files are checked in: 113 KB total, no build-time
 * dependency on Google, and a build that works offline. Weights are the four
 * the site actually sets — Shippori ships an 800 that nothing here uses.
 *
 * Japanese glyphs were never coming from this font in the first place. They go
 * through the `.jp` stack in globals.css, which resolves to Hiragino Mincho on
 * macOS and Yu Mincho on Windows — both good, and both already on the machine.
 *
 * Licensed SIL OFL 1.1, which permits redistribution like this. The licence
 * travels with the files, at src/app/fonts/OFL.txt.
 */
const mincho = localFont({
  src: [
    { path: "./fonts/ShipporiMincho-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ShipporiMincho-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ShipporiMincho-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ShipporiMincho-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mincho",
  display: "swap",
  // Stops the serif fallback from reflowing headings when the real face lands.
  fallback: ["ui-serif", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "JapanPad — Japan comes onchain",
  description:
    "A Japan-themed token launchpad built on Pons and live on Robinhood Chain.",
};

const NAV = [
  { href: "/explore", label: "Explore", jp: "探す" },
  { href: "/themes", label: "Themes", jp: "テーマ" },
  { href: "/garden", label: "Garden", jp: "庭" },
  { href: "/how-it-works", label: "How it works", jp: "仕組み" },
];

/** JapanPad's account. Written once so the header and the footer cannot drift. */
const X_URL = "https://x.com/usejapanpad";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Refuses to boot when the server and client disagree about the network,
  // which is the one misconfiguration that would surface as a signature
  // request on the wrong chain.
  assertChainConfig();

  return (
    <html
      lang="en"
      className={`${mincho.variable} ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen flex flex-col antialiased">
        <WalletProvider>
        {!VALUES_ARE_REAL && (
          <div className="bg-sumi text-ivory text-center text-xs py-1.5 px-4">
            Test network — {CHAIN_NAME}. Balances and prices here are play money.
          </div>
        )}

        <header className="border-b border-rule/70 sticky top-0 z-40 bg-ivory/85 backdrop-blur-sm">
          <nav className="mx-auto max-w-6xl px-5 h-16 flex items-center gap-8">
            <Link href="/" className="shrink-0 group" aria-label="JapanPad home">
              <Wordmark />
            </Link>

            {/*
              Each nav item carries its Japanese reading underneath at a size
              that does not compete with the English. It is set in the system
              mincho stack rather than the Latin webfont, which has no kana.
            */}
            <div className="hidden md:flex items-baseline gap-7 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group/nav text-sumi/80 hover:text-vermilion transition-colors"
                >
                  {item.label}
                  <span className="jp ml-1.5 text-[10px] text-muted/70 tracking-[0.15em] group-hover/nav:text-vermilion/60 transition-colors">
                    {item.jp}
                  </span>
                </Link>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/*
                Sized to the 36px hit target the buttons beside it use, rather
                than to the 14px glyph inside it — an icon-only control that is
                only as big as its icon is the one thing on a header that is
                hard to hit on a phone.
              */}
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="JapanPad on X"
                title="JapanPad on X"
                className="size-9 grid place-items-center rounded-full border border-rule text-sumi/70 hover:text-vermilion hover:border-vermilion/50 transition-colors"
              >
                <XMark className="size-[15px]" />
              </a>
              <Link
                href="/launch"
                className="text-sm px-4 py-2 rounded-full bg-vermilion text-paper hover:bg-vermilion-soft transition-colors"
              >
                Launch
              </Link>
              <WalletButton />
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-rule/70 mt-20">
          <div className="mx-auto max-w-6xl px-5 py-12 text-sm text-muted space-y-8">
            <div className="wave-rule opacity-50" aria-hidden />

            <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <Logo className="w-9 h-7" />
                <p className="mt-3 text-xs leading-relaxed max-w-xs">
                  An interface to the Pons protocol. The launching, the pricing and
                  the liquidity are all Pons — this site is discovery and
                  presentation over the top of it.
                </p>
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-2 mt-4 text-[13px] hover:text-vermilion transition-colors"
                >
                  <XMark className="size-3.5" />
                  @usejapanpad
                </a>
              </div>

              <div className="space-y-2.5">
                <p className="label">Browse</p>
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block hover:text-vermilion transition-colors text-[13px]"
                  >
                    {item.label}{" "}
                    <span className="jp opacity-50 text-[11px]">{item.jp}</span>
                  </Link>
                ))}
              </div>

              <div className="space-y-2.5">
                <p className="label">Start</p>
                <Link
                  href="/launch"
                  className="block hover:text-vermilion transition-colors text-[13px]"
                >
                  Launch a token <span className="jp opacity-50 text-[11px]">発行</span>
                </Link>
                <Link
                  href="/how-it-works"
                  className="block hover:text-vermilion transition-colors text-[13px]"
                >
                  Read the terms <span className="jp opacity-50 text-[11px]">条件</span>
                </Link>
              </div>
            </div>

            <p className="max-w-3xl leading-relaxed text-xs border-t border-rule/70 pt-6">
              JapanPad launches are user-created crypto tokens themed around Japanese
              culture. They are not shares, are not affiliated with or endorsed by any
              company a creator may reference, and confer no ownership, dividends,
              voting rights, or claim on any business. Tokens are created and traded
              through the Pons protocol on {CHAIN_NAME}; JapanPad never takes custody
              of funds and every transaction is signed by your own wallet.
            </p>
            <p className="text-xs opacity-70">Built on Pons · {CHAIN_NAME}</p>
          </div>
        </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
