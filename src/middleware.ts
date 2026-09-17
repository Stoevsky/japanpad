import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

/**
 * Everything except the things that are not pages.
 *
 * `api` is excluded deliberately — /api/stocks serves the Robinhood Stock Token
 * registry to the launch form, and a JSON endpoint has no locale to negotiate.
 * Rewriting it under /ja would just 404 the picker in Japanese.
 *
 * The trailing pattern skips anything with a file extension so that fonts, the
 * hero image and the favicon are served rather than routed.
 */
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
