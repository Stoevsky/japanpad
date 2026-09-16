import type { Address } from "viem";
import { CHAIN_ENV } from "../chain";

/**
 * Where Pons lives, per network.
 *
 * The mainnet factory was read off chain 4663 on 2026-09-15, not copied from a
 * doc: `eth_getCode` returns 48,357 bytes at this address, `launchEnabled()`
 * answers true, and `launchFee()` answers 5e14 wei. `npm run verify:pons`
 * re-checks all of that against the live chain.
 *
 * Testnet and local are env-supplied because Pons's testnet deployment is not
 * something we have verified; a hardcoded guess there would be a launch sent
 * into a contract that may not exist. Absent config, the launch surface
 * disables itself rather than encoding a transaction to nowhere.
 */

const MAINNET_FACTORY: Address = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";

function envFactory(): Address | null {
  const raw = process.env.NEXT_PUBLIC_PONS_V2_FACTORY?.trim();
  return raw && /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as Address) : null;
}

export const PONS_FACTORY: Address | null =
  CHAIN_ENV === "mainnet" ? (envFactory() ?? MAINNET_FACTORY) : envFactory();

/**
 * Reads the launch config id out of an environment string.
 *
 * Separate from the constant below, and validated rather than passed straight
 * to `BigInt`, because `BigInt` throws on anything that is not a clean integer
 * and this runs at module scope in a module that a client component imports —
 * so a throw here takes SSR and hydration down together, on every page. A
 * trailing comment in a `.env` file is enough to trigger it, since dotenv does
 * not strip those.
 *
 * Anything unparseable falls back to config 0, the documented default, rather
 * than to a guess: a wrong config id launches on terms nobody chose.
 */
export function parseConfigId(raw: string | undefined): bigint {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return 0n;
  return BigInt(value);
}

/**
 * Pons's launch config id. Config 0 is the standard curve: ~1B supply, 1%
 * curve fee, 4.2 ETH graduation threshold. Overridable because Pons's owner can
 * add configs, and pinning a stale id would silently launch on other terms.
 */
export const LAUNCH_CONFIG_ID = parseConfigId(
  process.env.NEXT_PUBLIC_PONS_LAUNCH_CONFIG_ID,
);

/**
 * The quote asset every JapanPad launch trades against: native ETH.
 *
 * Pons does support ERC-20 quote assets — `approvedPairTokens()` returns true
 * for 63 of the 194 Robinhood Stock Tokens, so a curve genuinely can be
 * denominated in NVDA or TSM. JapanPad does not use that, for one reason: there
 * is no Japanese Stock Token to denominate in. The live registry at
 * /rhj/assets carries 194 active assets and zero with a JP ISIN, so a
 * stock-quoted JapanPad curve would have to quote in something that is not
 * Japanese, which is exactly the claim this product refuses to make.
 *
 * ETH-quoted also keeps buying to one transaction instead of approve-then-buy.
 */
export const NATIVE_QUOTE: Address = "0x0000000000000000000000000000000000000000";

/** Whether the launch surface can build a transaction at all. */
export const LAUNCH_AVAILABLE = PONS_FACTORY !== null;
