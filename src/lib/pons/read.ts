import "server-only";
import { parseAbiItem, type Address } from "viem";
import { MULTICALL3 } from "../chain";
import { ponsV2CurveAbi, ponsV2TokenAbi } from "./abi";
import { isMissingContract, logRpcFailure, publicClient } from "./client";
import { NATIVE_QUOTE, PONS_FACTORY } from "./deployment";
import { parseThemeTag, withoutThemeTag } from "./tag";

/**
 * Reading JapanPad's launches back out of Pons.
 *
 * There is no database. A JapanPad coin is a Pons coin whose description
 * carries our theme tag, so the listing is built by scanning Pons's
 * `TokenLaunched` events, reading each token's description, and keeping the
 * ones tagged for us. That is slower than an indexer table but it has no second
 * source of truth to disagree with the chain, and at current launch volume the
 * scan is a handful of batched calls.
 *
 * When volume makes this too slow the fix is a cache in front of these
 * functions, not a mirror of the data — the chain stays authoritative.
 */

export { publicClient };

const TOKEN_LAUNCHED = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
);

/**
 * How far back to scan.
 *
 * Robinhood Chain is an Arbitrum Orbit rollup, so heights that came from an RPC
 * are this chain's and are what eth_getLogs wants. NEXT_PUBLIC_SCAN_FROM_BLOCK
 * should be an L2 height — the block Pons's factory was deployed at, or any
 * later point you are willing to start history from.
 */
const SCAN_FROM_BLOCK = process.env.NEXT_PUBLIC_SCAN_FROM_BLOCK?.trim();
/** Public RPCs cap getLogs ranges; 10k is comfortably inside every one we hit. */
const CHUNK = 9_000n;
/** Absent an explicit start, look back this far rather than scanning genesis. */
const DEFAULT_LOOKBACK = 400_000n;

export interface LaunchSummary {
  token: Address;
  curve: Address;
  deployer: Address;
  themeId: string;
  name: string;
  symbol: string;
  logo: string;
  /** Creator's text with our tag stripped. */
  description: string;
  blockNumber: bigint;
  /** Milliseconds. Null when the block timestamp was not fetched. */
  launchedAt: number | null;
  /** Real quote paid in, excluding the phantom leg. */
  raised: bigint;
  graduationThreshold: bigint;
  graduated: boolean;
  /** 0..1, clamped. */
  progress: number;
}

export interface LaunchDetail extends LaunchSummary {
  totalSupply: bigint;
  quoteReserve: bigint;
  tokenReserve: bigint;
  sellableTokens: bigint;
  feeBps: bigint;
  creatorTaxBps: bigint;
  readyToGraduate: boolean;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
  /** Spot price in wei of quote per whole token. */
  spotPrice: bigint;
}

interface RawLaunch {
  token: Address;
  curve: Address;
  deployer: Address;
  graduationThreshold: bigint;
  blockNumber: bigint;
}

/** Pons's TokenLaunched logs, newest first, over the configured window. */
async function fetchLaunchLogs(limit: number): Promise<RawLaunch[]> {
  if (!PONS_FACTORY) return [];

  const head = await publicClient.getBlockNumber();
  const floor = SCAN_FROM_BLOCK
    ? BigInt(SCAN_FROM_BLOCK)
    : head > DEFAULT_LOOKBACK
      ? head - DEFAULT_LOOKBACK
      : 0n;

  const out: RawLaunch[] = [];
  let to = head;

  // Walk backwards so the newest launches are found first and a large history
  // does not have to be read before anything can be rendered.
  while (to >= floor && out.length < limit * 4) {
    const from = to > floor + CHUNK ? to - CHUNK : floor;
    let logs;
    try {
      logs = await publicClient.getLogs({
        address: PONS_FACTORY,
        event: TOKEN_LAUNCHED,
        fromBlock: from,
        toBlock: to,
      });
    } catch {
      // A range the node refuses is skipped rather than failing the page. The
      // listing is then incomplete, which the caller surfaces as a partial
      // result — never as an empty one that looks like "no launches yet".
      if (from === floor) break;
      to = from - 1n;
      continue;
    }

    for (const log of logs.reverse()) {
      const a = log.args;
      if (!a.token || !a.curve || !a.deployer) continue;
      out.push({
        token: a.token,
        curve: a.curve,
        deployer: a.deployer,
        graduationThreshold: a.graduationThreshold ?? 0n,
        blockNumber: log.blockNumber ?? 0n,
      });
    }

    if (from === floor) break;
    to = from - 1n;
  }

  return out.sort((x, y) => (y.blockNumber > x.blockNumber ? 1 : -1));
}

/**
 * Hydrates raw logs into summaries, keeping only JapanPad-tagged launches.
 *
 * Every read is batched through Multicall3 where the chain has one, so a page
 * of twenty coins costs a few round trips rather than a hundred.
 */
async function hydrate(raw: RawLaunch[], limit: number): Promise<LaunchSummary[]> {
  if (raw.length === 0) return [];

  const multicall = MULTICALL3 ? { multicallAddress: MULTICALL3 } : {};

  const meta = await publicClient.multicall({
    ...multicall,
    allowFailure: true,
    contracts: raw.flatMap((r) => [
      { address: r.token, abi: ponsV2TokenAbi, functionName: "description" } as const,
      { address: r.token, abi: ponsV2TokenAbi, functionName: "name" } as const,
      { address: r.token, abi: ponsV2TokenAbi, functionName: "symbol" } as const,
      { address: r.token, abi: ponsV2TokenAbi, functionName: "logo" } as const,
    ]),
  });

  const tagged: Array<{ raw: RawLaunch; themeId: string; name: string; symbol: string; logo: string; description: string }> = [];

  for (let i = 0; i < raw.length; i++) {
    const description = meta[i * 4];
    if (description?.status !== "success") continue;
    const themeId = parseThemeTag(String(description.result));
    if (!themeId) continue; // Not a JapanPad launch.

    const name = meta[i * 4 + 1];
    const symbol = meta[i * 4 + 2];
    const logo = meta[i * 4 + 3];
    const r = raw[i];
    if (!r) continue;

    tagged.push({
      raw: r,
      themeId,
      name: name?.status === "success" ? String(name.result) : "",
      symbol: symbol?.status === "success" ? String(symbol.result) : "",
      logo: logo?.status === "success" ? String(logo.result) : "",
      description: withoutThemeTag(String(description.result)),
    });

    if (tagged.length >= limit) break;
  }

  if (tagged.length === 0) return [];

  const FIELDS = 4;
  const state = await publicClient.multicall({
    ...multicall,
    allowFailure: true,
    contracts: tagged.flatMap((t) => [
      { address: t.raw.curve, abi: ponsV2CurveAbi, functionName: "realQuoteReserve" } as const,
      { address: t.raw.curve, abi: ponsV2CurveAbi, functionName: "graduated" } as const,
      { address: t.raw.curve, abi: ponsV2CurveAbi, functionName: "graduationThreshold" } as const,
      { address: t.raw.curve, abi: ponsV2CurveAbi, functionName: "pairToken" } as const,
    ]),
  });

  return tagged.flatMap((t, i) => {
    const raised = state[i * FIELDS]?.status === "success" ? (state[i * FIELDS]!.result as bigint) : 0n;
    const graduated =
      state[i * FIELDS + 1]?.status === "success" ? Boolean(state[i * FIELDS + 1]!.result) : false;
    const thresholdRead = state[i * FIELDS + 2];
    const threshold =
      thresholdRead?.status === "success" && (thresholdRead.result as bigint) > 0n
        ? (thresholdRead.result as bigint)
        : t.raw.graduationThreshold;

    // Only ETH-quoted curves are listed. Pons also supports ERC-20 quote assets,
    // and every figure this site prints beside a curve — raised, threshold,
    // price — is labelled ETH. On a curve quoting in some ERC-20 those labels
    // would be wrong, and the trade panel's buys would revert with
    // UnexpectedNativeValue for sending ETH to a curve that does not take it.
    //
    // This excludes nothing JapanPad made: the launch flow always passes
    // NATIVE_QUOTE. It excludes a foreign curve whose description was written to
    // carry our tag, which is possible because the tag is just text.
    const pair = state[i * FIELDS + 3];
    if (pair?.status !== "success" || pair.result !== NATIVE_QUOTE) return [];

    return [{
      token: t.raw.token,
      curve: t.raw.curve,
      deployer: t.raw.deployer,
      themeId: t.themeId,
      name: t.name,
      symbol: t.symbol,
      logo: t.logo,
      description: t.description,
      blockNumber: t.raw.blockNumber,
      launchedAt: null,
      raised,
      graduationThreshold: threshold,
      graduated,
      progress: graduated ? 1 : threshold > 0n ? clamp(Number(raised) / Number(threshold)) : 0,
    }];
  });
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export interface ListResult {
  launches: LaunchSummary[];
  /** False when a getLogs range was refused and history may be incomplete. */
  complete: boolean;
  /** When this read happened, so a stale page can say so. */
  readAt: number;
}

/** Newest JapanPad launches. Optionally narrowed to one theme. */
export async function listLaunches(
  opts: { limit?: number; themeId?: string } = {},
): Promise<ListResult> {
  const limit = opts.limit ?? 24;
  const readAt = Date.now();

  if (!PONS_FACTORY) {
    return { launches: [], complete: false, readAt };
  }

  try {
    const raw = await fetchLaunchLogs(limit);
    const all = await hydrate(raw, opts.themeId ? limit * 3 : limit);
    const launches = opts.themeId ? all.filter((l) => l.themeId === opts.themeId) : all;
    return { launches: launches.slice(0, limit), complete: true, readAt };
  } catch (e) {
    // The chain is the only source of truth here, so an RPC failure is reported
    // as unavailable rather than smoothed over with an empty list.
    logRpcFailure("listLaunches", e);
    return { launches: [], complete: false, readAt };
  }
}

/**
 * The three things a token-address lookup can honestly conclude.
 *
 * "missing" and "unavailable" used to be the same `null`, which the detail page
 * turned into a 404 — so a flaky RPC told a holder their token did not exist.
 * They are different claims and only one of them is ever safe to make on the
 * strength of a failed network call.
 */
export type LaunchLookup =
  | { status: "ok"; launch: LaunchDetail }
  | { status: "missing" }
  | { status: "unavailable" };

const MISSING = { status: "missing" } as const;
const UNAVAILABLE = { status: "unavailable" } as const;

/** One launch, with everything the detail page renders. */
export async function getLaunch(token: Address): Promise<LaunchLookup> {
  // No factory configured means nothing can be evaluated, which is a statement
  // about this deployment rather than about the token.
  if (!PONS_FACTORY) return UNAVAILABLE;
  const multicall = MULTICALL3 ? { multicallAddress: MULTICALL3 } : {};

  let curve: Address;
  try {
    curve = (await publicClient.readContract({
      address: token,
      abi: ponsV2TokenAbi,
      functionName: "curve",
    })) as Address;
  } catch (e) {
    // An address with no contract on it answers this call with no data, which
    // is a real answer. A timeout is not.
    if (isMissingContract(e)) return MISSING;
    logRpcFailure(`getLaunch(${token})`, e);
    return UNAVAILABLE;
  }
  if (!curve || curve === "0x0000000000000000000000000000000000000000") return MISSING;

  try {

    const r = await publicClient.multicall({
      ...multicall,
      allowFailure: true,
      contracts: [
        { address: token, abi: ponsV2TokenAbi, functionName: "name" } as const,
        { address: token, abi: ponsV2TokenAbi, functionName: "symbol" } as const,
        { address: token, abi: ponsV2TokenAbi, functionName: "logo" } as const,
        { address: token, abi: ponsV2TokenAbi, functionName: "description" } as const,
        { address: token, abi: ponsV2TokenAbi, functionName: "totalSupply" } as const,
        { address: token, abi: ponsV2TokenAbi, functionName: "deployer" } as const,
        { address: token, abi: ponsV2TokenAbi, functionName: "socials" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "getReserves" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "realQuoteReserve" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "graduationThreshold" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "graduated" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "readyToGraduate" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "sellableTokens" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "feeBps" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "creatorTaxBps" } as const,
        { address: curve, abi: ponsV2CurveAbi, functionName: "pairToken" } as const,
      ],
    });

    const ok = <T>(i: number, fallback: T): T =>
      r[i]?.status === "success" ? (r[i]!.result as T) : fallback;

    const rawDescription = ok<string>(3, "");
    const themeId = parseThemeTag(rawDescription);
    // Not a JapanPad launch; do not render it as one. Distinct from a failed
    // read: the chain answered and the answer carried no theme tag.
    if (!themeId) return MISSING;

    // ETH-quoted only, for the same reason as the listing above: every figure on
    // the detail page is labelled ETH, and the trade panel sends native value.
    // A curve quoting in an ERC-20 would have both of those wrong. Verified
    // against a live example — an ERC-20-quoted Pons curve rejects an ETH buy
    // with UnexpectedNativeValue.
    if (ok<Address>(15, NATIVE_QUOTE) !== NATIVE_QUOTE) return MISSING;

    const reserves = ok<readonly [bigint, bigint]>(7, [0n, 0n]);
    const quoteReserve = reserves[0] ?? 0n;
    const tokenReserve = reserves[1] ?? 0n;
    const raised = ok<bigint>(8, 0n);
    const threshold = ok<bigint>(9, 0n);
    const graduated = ok<boolean>(10, false);
    const socials = ok<readonly [string, string, string, string, string]>(6, ["", "", "", "", ""]);

    const launch: LaunchDetail = {
      token,
      curve,
      deployer: ok<Address>(5, "0x0000000000000000000000000000000000000000"),
      themeId,
      name: ok<string>(0, ""),
      symbol: ok<string>(1, ""),
      logo: ok<string>(2, ""),
      description: withoutThemeTag(rawDescription),
      blockNumber: 0n,
      launchedAt: null,
      raised,
      graduationThreshold: threshold,
      graduated,
      progress: graduated ? 1 : threshold > 0n ? clamp(Number(raised) / Number(threshold)) : 0,
      totalSupply: ok<bigint>(4, 0n),
      quoteReserve,
      tokenReserve,
      sellableTokens: ok<bigint>(12, 0n),
      feeBps: ok<bigint>(13, 0n),
      creatorTaxBps: ok<bigint>(14, 0n),
      readyToGraduate: ok<boolean>(11, false),
      socials: {
        twitter: socials[0] ?? "",
        telegram: socials[1] ?? "",
        discord: socials[2] ?? "",
        website: socials[3] ?? "",
        farcaster: socials[4] ?? "",
      },
      // Both legs include the phantom reserve, which is what makes this the
      // curve's actual marginal price rather than a ratio of real balances.
      spotPrice: tokenReserve > 0n ? (quoteReserve * 10n ** 18n) / tokenReserve : 0n,
    };
    return { status: "ok", launch };
  } catch (e) {
    // Reaching here means the multicall itself failed rather than any single
    // read — nothing is known about the token, so nothing is claimed about it.
    logRpcFailure(`getLaunch(${token})`, e);
    return UNAVAILABLE;
  }
}
