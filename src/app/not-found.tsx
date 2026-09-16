import Link from "next/link";
import { NATIVE_SYMBOL } from "@/lib/chain";

/**
 * A genuine 404, and only ever a genuine one.
 *
 * Worth being precise about what reaching this page means, because the token
 * route is careful to only call `notFound()` when the chain actually answered.
 * An unreadable RPC gets its own screen that says so instead — see
 * `Unreadable` in token/[address]/page.tsx. So the wording here can safely be
 * definite.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="font-display text-2xl">Nothing here</h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        This page does not exist. If you followed a token link, the address is
        either not a Pons token, not launched through JapanPad, or not one of the
        {NATIVE_SYMBOL}-quoted curves this site can price.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/explore"
          className="px-4 py-2 rounded-full bg-vermilion text-paper text-sm hover:bg-vermilion-soft transition-colors"
        >
          Browse launches
        </Link>
        <Link
          href="/"
          className="px-4 py-2 rounded-full border border-rule text-sm text-muted hover:border-vermilion hover:text-vermilion transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
