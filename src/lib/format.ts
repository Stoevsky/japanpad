import { formatUnits } from "viem";

/** Trims a trailing ".000" without touching significant digits. */
function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * ETH with a sensible number of places for the magnitude.
 *
 * The floor is derived from `maxDp` rather than pinned at 0.0001. It used to be
 * pinned, which quietly made the argument dead: a bonding-curve spot price runs
 * around 1.7e-9 ETH per token, so every price on the site rendered as the same
 * "<0.0001" whatever precision the caller asked for, and a fresh curve looked
 * identical to one about to graduate. A caller that asks to see small numbers
 * has to be able to see them.
 */
export function formatEth(wei: bigint, maxDp = 4): string {
  const n = Number(formatUnits(wei, 18));
  if (n === 0) return "0";
  const floor = 10 ** -maxDp;
  if (n < floor) return `<${floor.toFixed(maxDp)}`;
  const dp = n < 1 ? maxDp : n < 1000 ? 3 : 2;
  return trimZeros(n.toFixed(dp));
}

/**
 * A curve's spot price, quoted per million tokens instead of per token.
 *
 * Pons mints about a billion tokens against a 4.2 ETH graduation threshold, so
 * one token costs somewhere around a billionth of an ETH for the whole of its
 * life on the curve. Rendered per token that is eight leading zeros, which is a
 * number nobody can read and nobody can compare against another one.
 *
 * A million tokens — a tenth of a percent of supply — lands the same fact in
 * ordinary decimals. The unit is stated wherever this is rendered, because a
 * price with an unstated denominator is worse than an unreadable one.
 *
 * Null when the curve has no price to give, so callers say "unavailable"
 * instead of printing a confident zero.
 */
export function formatPricePerMillion(spotPriceWei: bigint): string | null {
  if (spotPriceWei <= 0n) return null;
  return formatEth(spotPriceWei * 1_000_000n, 6);
}

/** Token amounts, which run to ten figures and should not print in full. */
export function formatTokens(raw: bigint, decimals = 18): string {
  const n = Number(formatUnits(raw, decimals));
  if (n === 0) return "0";
  if (n >= 1_000_000_000) return `${trimZeros((n / 1_000_000_000).toFixed(2))}B`;
  if (n >= 1_000_000) return `${trimZeros((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${trimZeros((n / 1_000).toFixed(2))}K`;
  if (n < 0.0001) return "<0.0001";
  return trimZeros(n.toFixed(4));
}

/**
 * Reads a typed amount into wei, or null if it is not one.
 *
 * `parseEther` throws on junk and, worse, silently truncates more than 18
 * decimal places — so the string is checked first and anything that is not a
 * plain decimal is refused. Null means "not a number yet", which is the normal
 * state of a field someone is still typing into, not an error to shout about.
 */
export function parseAmount(input: string, decimals = 18): bigint | null {
  const raw = input.trim();
  if (!raw || !/^\d*\.?\d*$/.test(raw) || raw === ".") return null;

  const [whole = "", fraction = ""] = raw.split(".");
  if (fraction.length > decimals) return null;

  const padded = fraction.padEnd(decimals, "0");
  try {
    return BigInt(`${whole || "0"}${padded}`);
  } catch {
    return null;
  }
}

export function formatPercent(fraction: number, dp = 1): string {
  if (!Number.isFinite(fraction)) return "0%";
  return `${(fraction * 100).toFixed(dp)}%`;
}

export function shortAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** "3m", "5h", "2d" — compact enough for a card corner. */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

/**
 * A creator-supplied image URI, made safe to put in a src attribute.
 *
 * Anything that is not plain http(s) or ipfs is dropped rather than rendered —
 * a `javascript:` or `data:` logo string is stored by Pons as happily as any
 * other, and it reaches us straight from a stranger's launch transaction.
 */
export function safeImageUrl(uri: string): string | null {
  const raw = uri?.trim();
  if (!raw) return null;
  if (raw.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${raw.slice("ipfs://".length).replace(/^ipfs\//, "")}`;
  }
  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}

/** Same rule for links we render as anchors. */
export function safeLinkUrl(uri: string): string | null {
  const raw = uri?.trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}
