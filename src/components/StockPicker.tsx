"use client";

import { useEffect, useMemo, useState } from "react";
import { THEMES } from "@/lib/themes";

/**
 * Picks the Tokyo listing a launch is measured against.
 *
 * Every row is a live quote. There is no placeholder row, no "—" price, and no
 * company that is listed but unpriced: a stock the feed did not answer for is
 * absent, because offering a denomination we cannot currently quote would let a
 * creator pick a number that does not exist.
 *
 * The wording throughout is "measured in", never "backed by" or "paired with a
 * share". The curve trades in ETH; the stock is a unit of account the creator
 * chose. Conflating those two is the single most damaging thing this screen
 * could do, so the distinction is repeated rather than stated once.
 */

export interface StockQuote {
  ticker: string;
  name: string;
  currency: string;
  price: number;
  changePercent: number;
  themeId: string;
  readAt: number;
}

export interface Rates {
  usdPerEth: number;
  jpyPerUsd: number;
  readAt: number;
}

interface Payload {
  quotes: StockQuote[];
  complete: boolean;
  readAt: number;
  rates: Rates | null;
}

export interface StockPickerProps {
  selected: string | null;
  onSelect: (ticker: string | null) => void;
  /** Pre-filters the list, but the creator can still widen it to all themes. */
  themeId?: string;
}

export function StockPicker({ selected, onSelect, themeId }: StockPickerProps) {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [themeFilter, setThemeFilter] = useState<string | null>(themeId ?? null);

  useEffect(() => {
    let live = true;
    setData(null);
    setFailed(false);
    fetch("/api/stocks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Payload) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.quotes.filter((s) => {
      if (themeFilter && s.themeId !== themeFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q);
    });
  }, [data, query, themeFilter]);

  if (failed) {
    return (
      <div className="card p-6">
        <p className="text-sm text-sumi/80">Tokyo prices are unavailable right now.</p>
        <p className="text-xs text-muted mt-1">
          A denomination has to be a real price, so none are offered rather than
          showing a stale one. You can launch measured in ETH alone and add this later.
        </p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted">Reading Tokyo prices…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => setThemeFilter(null)}
          className={
            themeFilter === null
              ? "px-3 py-1 rounded-full text-xs border border-sumi/25 bg-sumi/8 text-sumi"
              : "px-3 py-1 rounded-full text-xs border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
          }
        >
          All {data.quotes.length}
        </button>
        {THEMES.map((t) => {
          const n = data.quotes.filter((s) => s.themeId === t.id).length;
          if (n === 0) return null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setThemeFilter(t.id)}
              className={
                themeFilter === t.id
                  ? "px-3 py-1 rounded-full text-xs text-paper"
                  : "px-3 py-1 rounded-full text-xs border border-rule text-muted hover:border-vermilion hover:text-vermilion transition-colors"
              }
              style={themeFilter === t.id ? { backgroundColor: t.accent } : undefined}
            >
              {t.name} {n}
            </button>
          );
        })}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${data.quotes.length} Tokyo-listed companies by name or code`}
        className="w-full px-4 py-2.5 rounded-xl border border-rule bg-paper text-sm mb-3 focus:outline-none focus:border-vermilion transition-colors"
      />

      {!data.complete && (
        <p className="text-xs text-muted mb-3">
          Some listings did not answer and are left out rather than shown unpriced.
        </p>
      )}

      <div className="max-h-80 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={
            selected === null
              ? "text-left px-4 py-3 rounded-xl border border-vermilion bg-vermilion/8"
              : "text-left px-4 py-3 rounded-xl border border-rule bg-paper hover:border-vermilion transition-colors"
          }
        >
          <p className="text-sm font-medium">ETH only</p>
          <p className="text-xs text-muted">No stock denomination.</p>
        </button>

        {shown.map((s) => {
          const active = selected === s.ticker;
          const up = s.changePercent >= 0;
          return (
            <button
              key={s.ticker}
              type="button"
              onClick={() => onSelect(s.ticker)}
              className={
                active
                  ? "text-left px-4 py-3 rounded-xl border border-vermilion bg-vermilion/8"
                  : "text-left px-4 py-3 rounded-xl border border-rule bg-paper hover:border-vermilion transition-colors"
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <span className={`text-xs tabular-nums ${up ? "text-green-700" : "text-vermilion"}`}>
                  {up ? "+" : ""}
                  {s.changePercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <span className="text-xs text-muted font-mono">{s.ticker}</span>
                <span className="text-xs tabular-nums text-sumi/75">
                  ¥{s.price.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && query && (
        <p className="text-sm text-muted mt-3">Nothing matches “{query}”.</p>
      )}

      <p className="text-xs text-muted mt-3">
        Prices read from the Tokyo Stock Exchange at{" "}
        {new Date(data.readAt).toLocaleTimeString()}. A denomination sets what your
        market cap is quoted in. It is not a claim of backing, affiliation, or
        redeemability — your curve trades in ETH either way.
      </p>
    </div>
  );
}
