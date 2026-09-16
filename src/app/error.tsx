"use client";

import { useEffect } from "react";
import Link from "next/link";
import { logClientError } from "@/lib/report";

/**
 * A route that threw, said plainly.
 *
 * Almost everything on this site degrades to an honest "unavailable" state on
 * its own, so reaching this boundary means something genuinely unexpected got
 * out. The one thing that must not happen here is a reassuring message: a page
 * that failed to read the chain should never leave a reader thinking they are
 * looking at the chain.
 *
 * The error's own text is deliberately not rendered. Next replaces it with a
 * digest in production anyway, and on a page whose whole subject is money an
 * unexplained stack fragment reads as a claim about someone's funds.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError("route", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="font-display text-2xl">Something broke on this page</h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        This is a fault in JapanPad, not a transaction that went wrong. Nothing was
        signed and nothing was sent. No wallet action is ever taken by a page
        loading, so there is nothing here to undo.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 rounded-full border border-rule text-sm text-muted hover:border-vermilion hover:text-vermilion transition-colors"
        >
          Go home
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-xs text-muted/70">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
