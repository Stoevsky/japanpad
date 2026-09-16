import { NextResponse } from "next/server";
import { getRates, listStockQuotes } from "@/lib/stocks/quotes";

/**
 * Live Tokyo listings for the launch form's denomination picker.
 *
 * This exists because the picker is a client component and the quote source is
 * an outbound HTTP call that should not happen from a browser: the upstream is
 * a public endpoint with no CORS contract, and routing it through the server
 * gives one shared cache instead of one per visitor.
 *
 * `complete` is passed through rather than smoothed over. A partial list is
 * shown as partial — the alternative is a picker that silently omits a company
 * because one request timed out, which reads to a creator as "not offered".
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const themeId = new URL(request.url).searchParams.get("theme") ?? undefined;

  const [result, rates] = await Promise.all([listStockQuotes(themeId), getRates()]);

  return NextResponse.json(
    {
      quotes: result.quotes,
      complete: result.complete,
      readAt: result.readAt,
      // Null when either leg of the conversion failed. The client renders no
      // converted figure at all in that case rather than reusing an old rate.
      rates,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
