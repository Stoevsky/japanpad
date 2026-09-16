/**
 * Checks every ticker in the catalog against the live quote feed.
 *
 * The catalog hardcodes tickers and nothing else — names and prices are read at
 * request time — so the one thing that can rot in source is a ticker that stops
 * resolving: a delisting, a merger, a renumbering, or a typo that was never
 * caught because the picker silently omits anything that does not answer.
 *
 * That silence is the reason this exists. A stock dropping out of the picker
 * looks identical to a stock we chose not to list, so without this the catalog
 * could decay to half its length and nothing would say so.
 *
 * Run it before a deploy. It hits a public endpoint with no uptime contract, so
 * it can fail for reasons that have nothing to do with your change — read the
 * output rather than just the exit code.
 */

import { STOCK_CATALOG } from "../src/lib/stocks/catalog.ts";
import { THEMES } from "../src/lib/themes.ts";

const ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart";
/** Keeps a 96-ticker sweep polite rather than firing it all at once. */
const CONCURRENCY = 8;

interface Row {
  ticker: string;
  themeId: string;
  ok: boolean;
  name?: string;
  currency?: string;
  price?: number;
  reason?: string;
}

async function check(ticker: string, themeId: string): Promise<Row> {
  try {
    const res = await fetch(`${ENDPOINT}/${ticker}?interval=1d&range=1d`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return { ticker, themeId, ok: false, reason: `HTTP ${res.status}` };
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { ticker, themeId, ok: false, reason: "no meta in response" };
    const price = meta.regularMarketPrice;
    const name = meta.longName ?? meta.shortName;
    if (typeof price !== "number" || price <= 0) {
      return { ticker, themeId, ok: false, reason: "no usable price" };
    }
    if (typeof name !== "string" || !name) {
      return { ticker, themeId, ok: false, reason: "no company name" };
    }
    return { ticker, themeId, ok: true, name, currency: meta.currency, price };
  } catch (e) {
    return { ticker, themeId, ok: false, reason: e instanceof Error ? e.message : "threw" };
  }
}

async function main() {
  const themeIds = new Set(THEMES.map((t) => t.id));

  // A ticker filed under a theme that does not exist would vanish from the
  // picker's theme filters without ever failing a network check, so it is
  // caught here rather than left to a reader to notice.
  const badTheme = STOCK_CATALOG.filter((e) => !themeIds.has(e.themeId));
  const seen = new Set<string>();
  const dupes = STOCK_CATALOG.filter((e) => {
    if (seen.has(e.ticker)) return true;
    seen.add(e.ticker);
    return false;
  });

  console.log(`Checking ${STOCK_CATALOG.length} tickers against ${ENDPOINT}\n`);

  const rows: Row[] = [];
  for (let i = 0; i < STOCK_CATALOG.length; i += CONCURRENCY) {
    const batch = STOCK_CATALOG.slice(i, i + CONCURRENCY);
    rows.push(...(await Promise.all(batch.map((e) => check(e.ticker, e.themeId)))));
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, STOCK_CATALOG.length)}/${STOCK_CATALOG.length}\r`);
  }

  const failed = rows.filter((r) => !r.ok);
  const ok = rows.filter((r) => r.ok);

  console.log(`\nResolved ${ok.length}/${rows.length}\n`);

  const nonJpy = ok.filter((r) => r.currency !== "JPY");
  if (nonJpy.length > 0) {
    console.log("Not quoted in JPY — the picker renders a ¥ sign, so these would be mislabelled:");
    for (const r of nonJpy) console.log(`  ${r.ticker}  ${r.currency}  ${r.name}`);
    console.log();
  }

  if (dupes.length > 0) {
    console.log("Duplicate tickers:");
    for (const d of dupes) console.log(`  ${d.ticker}`);
    console.log();
  }

  if (badTheme.length > 0) {
    console.log("Tickers filed under a theme that does not exist:");
    for (const b of badTheme) console.log(`  ${b.ticker} -> ${b.themeId}`);
    console.log();
  }

  if (failed.length > 0) {
    console.log("Did not resolve:");
    for (const f of failed) console.log(`  ${f.ticker}  (${f.themeId})  ${f.reason}`);
    console.log();
  }

  const problems = failed.length + dupes.length + badTheme.length + nonJpy.length;
  if (problems > 0) {
    console.error(`FAIL — ${problems} problem(s) above.`);
    process.exit(1);
  }
  console.log("OK — every ticker resolves, is quoted in JPY, is unique, and has a real theme.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
