import type { Address } from "viem";
import { CHAIN_ENV, type ChainEnv } from "../chain";

/**
 * Where Pons lives, per network.
 *
 * The mainnet factory was read off chain 4663 on 2026-09-15, not copied from a
 * doc: `eth_getCode` returns code at this address, `launchEnabled()` answers
 * true, and `launchFee()` answers 5e14 wei. `npm run verify:pons` re-checks all
 * of that against the live chain.
 *
 * Every other network is env-supplied, because a hardcoded guess is a launch
 * sent into a contract that may not exist. Absent config, the launch surface
 * disables itself rather than encoding a transaction to nowhere.
 */

export const MAINNET_FACTORY: Address =
  "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";

export function parseAddress(raw: string | undefined): Address | null {
  const value = raw?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : null;
}

/**
 * The block JapanPad's first launch landed in, per network.
 *
 * This exists because a lookback window cannot work on this chain. Robinhood
 * Chain produces roughly fifteen blocks a second — measured, not assumed: head
 * moved 2,226 blocks in the ~150s between two probes — so the 400,000-block
 * window this replaces covered about seven hours. $TOYOTA was already an hour
 * from falling out of it, and would have disappeared from the site on its own.
 *
 * A launch older than JapanPad's first launch cannot be JapanPad's, so this is
 * a floor rather than a heuristic, and it does not slide. The mainnet value is
 * measured: scanning blocks 64,000,000 to 64,870,000 turned up 11,626 Pons
 * launches and exactly one tagged coin, $TOYOTA at 64,869,238. Nothing of ours
 * exists in the 869,000 blocks before it.
 *
 * Set NEXT_PUBLIC_SCAN_FROM_BLOCK to override. Lower is always safe and only
 * costs scan time; higher hides coins.
 */
const GENESIS: Record<ChainEnv, bigint | null> = {
  mainnet: 64_869_000n,
  testnet: null,
  arc: null,
  "arc-testnet": null,
  local: null,
};

export const GENESIS_BLOCK: bigint | null = GENESIS[CHAIN_ENV];

/**
 * Per-chain factory configuration, read literally rather than by computed key.
 *
 * This shape looks redundant and is not. Next inlines `NEXT_PUBLIC_` variables
 * by *textually* substituting `process.env.NEXT_PUBLIC_FOO` during the build —
 * a computed access like `process.env[`NEXT_PUBLIC_..._${env}`]` matches no
 * literal, is never substituted, and evaluates to undefined in the browser
 * while working fine on the server. That asymmetry would show up as a launch
 * page that renders on the server and disables itself on hydration.
 *
 * So each key is spelled out. Adding a chain means adding a line here.
 */
const CONFIGURED: Record<ChainEnv, string | undefined> = {
  mainnet: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_MAINNET,
  testnet: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_TESTNET,
  arc: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_ARC,
  "arc-testnet": process.env.NEXT_PUBLIC_PONS_V2_FACTORY_ARC_TESTNET,
  local: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_LOCAL,
};

/**
 * Decides where a launch on `env` would be sent, or that it cannot be sent.
 *
 * Pure, so the rule can be tested without a process to set variables on. The
 * rule is the whole point: a configured address always wins, mainnet may fall
 * back to the address this repo verified, and every other chain returns null
 * rather than guessing.
 *
 * Arc is the case that tests the rule. A Pons-ABI-compatible factory is live
 * there — verified, not assumed — and it still gets no default, because it is
 * hours old, unaudited, and Arc gas is real USDC. Discovering a contract is not
 * the same as vouching for it. See deployment.test.ts for the measurements.
 */
export function resolveFactory(
  env: ChainEnv,
  configured: Address | null,
): Address | null {
  if (configured) return configured;
  return env === "mainnet" ? MAINNET_FACTORY : null;
}

/** The factory for a given chain, reading that chain's own configuration. */
export function factoryFor(env: ChainEnv): Address | null {
  return resolveFactory(env, parseAddress(CONFIGURED[env]));
}

/**
 * The factory for the chain this build targets.
 *
 * NEXT_PUBLIC_PONS_V2_FACTORY is the un-suffixed legacy name and still works,
 * applying to whichever chain is active. It is checked first so an existing
 * deployment keeps behaving exactly as it did.
 */
export const PONS_FACTORY: Address | null =
  parseAddress(process.env.NEXT_PUBLIC_PONS_V2_FACTORY) ?? factoryFor(CHAIN_ENV);

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
