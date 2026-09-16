"use server";

import { getTheme } from "@/lib/themes";
import { MAX_NAME, MAX_SYMBOL, cleanLinks } from "@/lib/metadata";
import { readLaunchTerms } from "@/lib/pons/terms";
import { buildTokenParams, randomSalt, type PonsTokenParams } from "@/lib/pons/tag";
import { isCatalogTicker } from "@/lib/stocks/catalog";
import { getStockQuote } from "@/lib/stocks/quotes";

/**
 * The last thing that happens before a wallet dialog opens.
 *
 * Everything Pons will check is checked here first, against the live chain,
 * because the alternative is a user paying gas to learn that launching is
 * paused. The browser never assembles these arguments itself — not because the
 * browser is untrusted with its own launch, but because the economics digest
 * has to be read fresh moments before it is signed, and one place has to own
 * that timing.
 *
 * What comes back is exactly the tuple `launchToken()` takes, plus the exact
 * wei to send with it. The review panel renders this object, so what the user
 * reads is the transaction they are about to send rather than a hopeful
 * restatement of it.
 */

export interface LaunchPlan {
  params: PonsTokenParams;
  /** Exact wei. Pons reverts unless msg.value equals this, to the wei. */
  launchFeeWei: string;
  themeId: string;
  themeName: string;
  supply: string;
  graduationThresholdWei: string;
  curveFeeBps: number;
  /**
   * The denomination, re-read here rather than taken from the browser.
   *
   * The client sends a ticker; the price on the review screen is fetched on the
   * server moments before it is shown. A price posted from a form is a number
   * the user could have edited, and this one is displayed next to a transaction.
   * Null when no stock was chosen or when the feed did not answer — in which
   * case the review screen shows no denomination rather than an unpriced one.
   */
  stock: { ticker: string; name: string; currency: string; price: number } | null;
}

export type PrepareField =
  | "name"
  | "symbol"
  | "description"
  | "image"
  | "link"
  | "x"
  | "theme"
  | "stock"
  | "chain";

export type PrepareResult =
  | { ok: true; plan: LaunchPlan }
  | { ok: false; error: string; field: PrepareField };

export interface LaunchDraft {
  themeId: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  link: string;
  x: string;
  /** TSE ticker to measure this launch against, or "" for ETH alone. */
  stockTicker: string;
}

export async function prepareLaunch(draft: LaunchDraft): Promise<PrepareResult> {
  const theme = getTheme(draft.themeId);
  if (!theme) {
    return { ok: false, error: "Pick a theme for this launch.", field: "theme" };
  }

  const name = draft.name.trim();
  if (name.length === 0) {
    return { ok: false, error: "Give the token a name.", field: "name" };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, error: `Names are at most ${MAX_NAME} characters.`, field: "name" };
  }

  const symbol = draft.symbol.trim().toUpperCase();
  if (symbol.length === 0) {
    return { ok: false, error: "Give the token a symbol.", field: "symbol" };
  }
  if (symbol.length > MAX_SYMBOL) {
    return { ok: false, error: `Symbols are at most ${MAX_SYMBOL} characters.`, field: "symbol" };
  }
  if (!/^[A-Z0-9]+$/.test(symbol)) {
    return { ok: false, error: "Symbols can only use letters and digits.", field: "symbol" };
  }

  const cleaned = cleanLinks({
    description: draft.description,
    image: draft.image,
    link: draft.link,
    x: draft.x,
  });
  if (!cleaned.ok) {
    return { ok: false, error: cleaned.error, field: cleaned.field };
  }

  // A ticker outside the catalog is refused rather than quietly dropped. The
  // creator picked something; silently launching without it would put a coin on
  // chain measured differently from what the form showed.
  const ticker = draft.stockTicker.trim();
  if (ticker && !isCatalogTicker(ticker)) {
    return { ok: false, error: "That is not a listing this site can quote.", field: "stock" };
  }
  const stock = ticker ? await getStockQuote(ticker) : null;
  if (ticker && !stock) {
    return {
      ok: false,
      error:
        "The Tokyo price feed did not answer for that listing, so it cannot be " +
        "quoted right now. Pick another, or launch measured in ETH alone.",
      field: "stock",
    };
  }

  const terms = await readLaunchTerms();
  if (!terms) {
    return {
      ok: false,
      error: "Could not read the launch terms from Pons. Check the connection and try again.",
      field: "chain",
    };
  }
  if (!terms.launchEnabled) {
    return {
      ok: false,
      error: "Pons has launching paused. No token can be created until it is re-enabled.",
      field: "chain",
    };
  }
  if (!terms.configEnabled) {
    return {
      ok: false,
      error: "Pons has disabled the launch config this site uses. Nothing can be launched on it.",
      field: "chain",
    };
  }

  return {
    ok: true,
    plan: {
      params: buildTokenParams({
        name,
        symbol,
        logo: cleaned.links.image,
        description: cleaned.links.description,
        x: cleaned.links.x,
        link: cleaned.links.link,
        themeId: theme.id,
        stockTicker: stock?.ticker ?? null,
        economics: terms.economics,
        salt: randomSalt(),
      }),
      launchFeeWei: terms.launchFeeWei.toString(),
      themeId: theme.id,
      themeName: theme.name,
      supply: terms.supply.toString(),
      graduationThresholdWei: terms.graduationThresholdWei.toString(),
      curveFeeBps: terms.curveFeeBps,
      stock: stock
        ? {
            ticker: stock.ticker,
            name: stock.name,
            currency: stock.currency,
            price: stock.price,
          }
        : null,
    },
  };
}
