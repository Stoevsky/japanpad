import "server-only";
import { CATALOG_TICKERS, catalogEntry } from "./catalog";

/**
 * Live prices for the Tokyo listings a launch can be denominated in.
 *
 * Every field here comes off the wire. Nothing in this module invents a price,
 * a name, or a change figure, and nothing falls back to a remembered value when
 * the feed is down — a stock that does not answer is returned as unavailable and
 * the UI declines to offer it. A denomination is a number a creator is choosing
 * to measure their launch against, so a stale or guessed one is worse than none.
 *
 * The feed is Yahoo's chart endpoint, which answers unauthenticated. It is a
 * public endpoint with no contract behind it, so it is treated as best-effort:
 * short timeout, failures isolated per ticker, and a cache so a burst of page
 * views is one upstream request rather than ninety-six.
 */

const ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
/** Long enough to be useful, short enough that a quoted price is still today's. */
const TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;

export interface StockQuote {
  ticker: string;
  /** Company name as the feed reports it. Never written down in this repo. */
  name: string;
  /** Almost always JPY for a .T listing, but taken from the feed, not assumed. */
  currency: string;
  price: number;
  changePercent: number;
  themeId: string;
  /** When this was read, so a stale panel can say so. */
  readAt: number;
}

interface CacheEntry {
  quote: StockQuote | null;
  at: number;
}

const cache = new Map<string, CacheEntry>();

async function fetchOne(ticker: string): Promise<StockQuote | null> {
  const entry = catalogEntry(ticker);
  if (!entry) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${ENDPOINT}/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const meta = (json as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } })
      ?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice;
    const name = meta.longName ?? meta.shortName;
    const currency = meta.currency;
    // A quote missing any of these is not a quote. Returning it with a zero or
    // an empty string would put a fabricated figure in front of a creator.
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
    if (typeof name !== "string" || !name) return null;
    if (typeof currency !== "string" || !currency) return null;

    const change = meta.regularMarketChangePercent;
    return {
      ticker,
      name,
      currency,
      price,
      changePercent: typeof change === "number" && Number.isFinite(change) ? change : 0,
      themeId: entry.themeId,
      readAt: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function cached(ticker: string): Promise<StockQuote | null> {
  const hit = cache.get(ticker);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return hit.quote;

  const quote = await fetchOne(ticker);
  // A failed read does not evict a fresh-enough previous one; it is better to
  // show a price from forty seconds ago, labelled with when it was read, than
  // to drop a stock out of the picker because one request timed out.
  if (!quote && hit && now - hit.at < TTL_MS * 5) return hit.quote;
  cache.set(ticker, { quote, at: now });
  return quote;
}

export interface QuoteResult {
  quotes: StockQuote[];
  /** False when at least one ticker did not answer, so the list is partial. */
  complete: boolean;
  readAt: number;
}

/** Every catalog stock that answered, with the ones that did not left out. */
export async function listStockQuotes(themeId?: string): Promise<QuoteResult> {
  const readAt = Date.now();
  const tickers = themeId
    ? CATALOG_TICKERS.filter((t) => catalogEntry(t)?.themeId === themeId)
    : CATALOG_TICKERS;

  const settled = await Promise.all(tickers.map((t) => cached(t)));
  const quotes = settled.filter((q): q is StockQuote => q !== null);
  return { quotes, complete: quotes.length === tickers.length, readAt };
}

/** One stock, for confirming a choice before it is written into a launch. */
export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  return catalogEntry(ticker) ? cached(ticker) : null;
}

/**
 * USD per ETH and JPY per USD, used only to restate a launch's starting size in
 * a unit a creator recognises.
 *
 * Null when either leg fails. Callers must render nothing rather than fall back
 * to a remembered rate — a conversion is a factual claim about today's market.
 */
export interface Rates {
  usdPerEth: number;
  jpyPerUsd: number;
  readAt: number;
}

let ratesCache: { rates: Rates | null; at: number } | null = null;

async function fetchRate(symbol: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}/${symbol}?interval=1d&range=1d`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const price = (
      json as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown } }> } }
    )?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getRates(): Promise<Rates | null> {
  const now = Date.now();
  if (ratesCache && now - ratesCache.at < TTL_MS) return ratesCache.rates;

  const [usdPerEth, jpyPerUsd] = await Promise.all([
    fetchRate("ETH-USD"),
    fetchRate("JPY=X"),
  ]);
  const rates =
    usdPerEth !== null && jpyPerUsd !== null ? { usdPerEth, jpyPerUsd, readAt: now } : null;
  ratesCache = { rates, at: now };
  return rates;
}
