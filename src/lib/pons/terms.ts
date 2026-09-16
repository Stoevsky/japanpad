import "server-only";
import type { Hex } from "viem";
import { MULTICALL3 } from "../chain";
import { ponsV2FactoryAbi } from "./abi";
import { LAUNCH_CONFIG_ID, NATIVE_QUOTE, PONS_FACTORY } from "./deployment";
import { logRpcFailure, publicClient } from "./client";

/**
 * What it currently costs, and on what terms, to launch through Pons.
 *
 * Every value here belongs to Pons and every one of them is owner-mutable: the
 * launch fee, whether launching is enabled at all, the supply, the curve's fee,
 * the phantom reserve, the graduation threshold, the pool's fee tier and tick
 * spacing. JapanPad sets none of them and cannot promise any of them.
 *
 * Which is why `economics` exists. `previewLaunchEconomics` returns a digest of
 * those terms as they stand right now, and Pons refuses the launch with
 * `LaunchEconomicsMismatch` if any of them moved between the read and the
 * signature. So this is read immediately before a wallet dialog opens, never
 * cached and never carried over from page render — a digest read when the page
 * loaded and signed twenty minutes later is a launch that fails for no visible
 * reason.
 */

export interface LaunchTerms {
  /** Exact wei to send. Pons reverts unless msg.value equals this, to the wei. */
  launchFeeWei: bigint;
  /** False when Pons has paused launching. Say so instead of reverting. */
  launchEnabled: boolean;
  /** Digest pinning the terms below into the launch transaction. */
  economics: Hex;
  supply: bigint;
  curveFeeBps: number;
  graduationThresholdWei: bigint;
  /** Held back from the curve to seed the Uniswap pool at graduation. */
  phantomQuoteWei: bigint;
  /** False when this config id has been disabled by Pons's owner. */
  configEnabled: boolean;
}

export async function readLaunchTerms(): Promise<LaunchTerms | null> {
  if (!PONS_FACTORY) return null;
  const multicall = MULTICALL3 ? { multicallAddress: MULTICALL3 } : {};

  try {
    const [fee, enabled, economics, config] = await publicClient.multicall({
      ...multicall,
      allowFailure: false,
      contracts: [
        { address: PONS_FACTORY, abi: ponsV2FactoryAbi, functionName: "launchFee" } as const,
        { address: PONS_FACTORY, abi: ponsV2FactoryAbi, functionName: "launchEnabled" } as const,
        {
          address: PONS_FACTORY,
          abi: ponsV2FactoryAbi,
          functionName: "previewLaunchEconomics",
          args: [LAUNCH_CONFIG_ID, NATIVE_QUOTE],
        } as const,
        {
          address: PONS_FACTORY,
          abi: ponsV2FactoryAbi,
          functionName: "getLaunchConfig",
          args: [LAUNCH_CONFIG_ID],
        } as const,
      ],
    });

    return {
      launchFeeWei: fee,
      launchEnabled: enabled,
      economics,
      supply: config.supply,
      curveFeeBps: Number(config.curveFeeBps),
      graduationThresholdWei: config.graduationThreshold,
      phantomQuoteWei: config.phantomQuote,
      configEnabled: config.enabled,
    };
  } catch (e) {
    // Null, not defaults. A launch form that guessed the fee would send the
    // wrong msg.value and be rejected by Pons at the user's expense.
    logRpcFailure("readLaunchTerms", e);
    return null;
  }
}
