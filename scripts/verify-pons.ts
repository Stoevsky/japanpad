/**
 * Checks this repo's assumptions about Pons against the live chain.
 *
 * Every constant in src/lib/pons and src/lib/chain was read off a real network
 * once. That is worth exactly as much as the day it was done: Pons's owner can
 * change the launch fee, disable a launch config, or pause launching, and none
 * of it produces an error here until somebody signs a transaction that reverts.
 *
 * So this script re-reads all of it and reports drift. It writes nothing, signs
 * nothing, and needs no key — it is `eth_call` and `eth_getCode` from end to
 * end. Run it before a deploy and after any change to the deployment constants:
 *
 *   npm run verify:pons              # whatever JAPANPAD_NETWORK says
 *   JAPANPAD_NETWORK=mainnet npm run verify:pons
 *
 * Exit code 1 means something this repo believes is no longer true. A failure
 * here is not a reason to hardcode around the difference; it is a reason to find
 * out what Pons changed.
 */

import { createPublicClient, formatEther, http, type Address } from "viem";

/**
 * The chain table comes from src/lib/chain.ts rather than a copy.
 *
 * It used to be a copy, on the reasoning that the script must not import
 * `server-only` modules. That reasoning was right and the copy was still wrong:
 * chain.ts is not server-only — client components import it — and the duplicate
 * promptly drifted. When Arc was added to src/, this script still declared
 * `"mainnet" | "testnet" | "local"`, so `JAPANPAD_NETWORK=arc` fell through to
 * the testnet branch and cheerfully verified the wrong network.
 *
 * A verification script that silently checks a different chain than the one you
 * asked for is worse than no script.
 */
import { CHAIN_PRESETS, type ChainEnv } from "../src/lib/chain.ts";

const ENV: ChainEnv = (() => {
  const raw = (process.env.JAPANPAD_NETWORK ?? process.env.NEXT_PUBLIC_JAPANPAD_NETWORK)?.trim();
  return raw && raw in CHAIN_PRESETS ? (raw as ChainEnv) : "testnet";
})();

/** Mirrors src/lib/pons/deployment.ts — see the note there on literal keys. */
const MAINNET_FACTORY: Address = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const NATIVE_QUOTE: Address = "0x0000000000000000000000000000000000000000";
const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

const CONFIGURED: Record<ChainEnv, string | undefined> = {
  mainnet: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_MAINNET,
  testnet: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_TESTNET,
  arc: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_ARC,
  "arc-testnet": process.env.NEXT_PUBLIC_PONS_V2_FACTORY_ARC_TESTNET,
  local: process.env.NEXT_PUBLIC_PONS_V2_FACTORY_LOCAL,
};

function parseAddress(raw: string | undefined): Address | null {
  const value = raw?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : null;
}

const FACTORY: Address | null =
  parseAddress(process.env.NEXT_PUBLIC_PONS_V2_FACTORY) ??
  parseAddress(CONFIGURED[ENV]) ??
  (ENV === "mainnet" ? MAINNET_FACTORY : null);

const LAUNCH_CONFIG_ID = BigInt(process.env.NEXT_PUBLIC_PONS_LAUNCH_CONFIG_ID?.trim() || "0");

/**
 * What the code in src/ believes, per chain, as of the last verification.
 *
 * Per chain because these are denominated values and the chains do not share a
 * denomination: Robinhood graduates at 4.2 ETH, and a fork on Arc graduates at
 * 10,000 USDC. Asserting Robinhood's numbers against Arc would report drift on
 * every run and train whoever reads it to ignore the output.
 *
 * A chain with no entry is reported rather than asserted. That is the honest
 * state for a third-party deployment this repo has not adopted: the script can
 * tell you what the contract says, but it has no prior belief to compare it to.
 */
const EXPECTED: Partial<
  Record<ChainEnv, { launchFeeWei: bigint; curveFeeBps: bigint; graduationThresholdWei: bigint }>
> = {
  mainnet: {
    launchFeeWei: 500_000_000_000_000n, // 5e14 = 0.0005 ETH
    curveFeeBps: 100n, // 1%, corroborated by a round-trip trade
    graduationThresholdWei: 4_200_000_000_000_000_000n, // 4.2 ETH
  },
};

const factoryAbi = [
  { type: "function", name: "launchFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "launchEnabled", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "launchForwarder", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "getLaunchConfig",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "supply", type: "uint256" },
          { name: "curveFeeBps", type: "uint16" },
          { name: "phantomQuote", type: "uint256" },
          { name: "graduationThreshold", type: "uint256" },
          { name: "poolFee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "enabled", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "previewLaunchEconomics",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "approvedPairTokens",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const multicallAbi = [
  { type: "function", name: "getChainId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

let failures = 0;
let warnings = 0;

function pass(label: string, detail = "") {
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`);
}

function fail(label: string, detail: string) {
  failures += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${label}\n      \x1b[31m${detail}\x1b[0m`);
}

function warn(label: string, detail: string) {
  warnings += 1;
  console.log(`  \x1b[33m!\x1b[0m ${label}\n      \x1b[33m${detail}\x1b[0m`);
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function main() {
  const preset = CHAIN_PRESETS[ENV];
  const symbol = preset.nativeCurrency.symbol;
  const rpc =
    process.env.JAPANPAD_RPC_URL?.trim() || process.env.NEXT_PUBLIC_RPC_URL?.trim() || preset.rpcUrl;

  console.log(`\n\x1b[1mVerifying Pons against ${preset.name}\x1b[0m`);
  console.log(`\x1b[2m${rpc}\x1b[0m`);

  const client = createPublicClient({ transport: http(rpc) });

  section("Chain");
  let chainId: number;
  try {
    chainId = await client.getChainId();
  } catch (e) {
    fail("RPC unreachable", String((e as Error).message).split("\n")[0] ?? "");
    return finish();
  }

  if (chainId === preset.id) {
    pass(`eth_chainId is ${chainId}`);
  } else {
    fail("Wrong chain", `Expected ${preset.id} for ${ENV}, the RPC answered ${chainId}.`);
    return finish();
  }

  const head = await client.getBlockNumber();
  pass("Head block", `${head}`);

  // Multicall3 is used to batch every listing read. A wrong address there is a
  // silent failure that degrades to one call per token.
  try {
    const mcChain = await client.readContract({
      address: MULTICALL3,
      abi: multicallAbi,
      functionName: "getChainId",
    });
    if (Number(mcChain) === chainId) pass("Multicall3 answers for this chain", MULTICALL3);
    else fail("Multicall3 mismatch", `getChainId() returned ${mcChain}, expected ${chainId}.`);
  } catch {
    warn("Multicall3 not found", `No contract answering at ${MULTICALL3}. Reads will not batch.`);
  }

  section("Pons factory");
  if (!FACTORY) {
    warn(
      "No factory configured",
      `${ENV} has no factory configured, so the launch surface disables itself. ` +
        `Set NEXT_PUBLIC_PONS_V2_FACTORY_${ENV.toUpperCase().replace("-", "_")} to verify further.`,
    );
    return finish();
  }

  const code = await client.getCode({ address: FACTORY });
  if (!code || code === "0x") {
    fail("Nothing deployed at the factory address", `${FACTORY} has no code on chain ${chainId}.`);
    return finish();
  }
  pass("Factory has code", `${FACTORY} · ${(code.length - 2) / 2} bytes`);

  let fee: bigint;
  let enabled: boolean;
  let config: {
    supply: bigint;
    curveFeeBps: number;
    phantomQuote: bigint;
    graduationThreshold: bigint;
    poolFee: number;
    tickSpacing: number;
    enabled: boolean;
  };

  try {
    [fee, enabled, config] = await Promise.all([
      client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchFee" }),
      client.readContract({ address: FACTORY, abi: factoryAbi, functionName: "launchEnabled" }),
      client.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: "getLaunchConfig",
        args: [LAUNCH_CONFIG_ID],
      }),
    ]);
  } catch (e) {
    fail(
      "Factory did not answer",
      `The address has code but does not respond to Pons's launch ABI. ${String((e as Error).message).split("\n")[0]}`,
    );
    return finish();
  }

  compare("Launch fee", fee, EXPECTED[ENV]?.launchFeeWei, `${formatEther(fee)} ${symbol}`);

  if (enabled) pass("Launching is enabled");
  else warn("Launching is disabled", "Pons has paused launchToken. The launch form will say so.");

  section(`Launch config ${LAUNCH_CONFIG_ID}`);
  if (config.enabled) pass("Config is enabled");
  else
    fail(
      "Config is disabled",
      `Pons has disabled config ${LAUNCH_CONFIG_ID}. Every launch through it reverts with LaunchConfigDisabled.`,
    );

  compare("Curve fee", BigInt(config.curveFeeBps), EXPECTED[ENV]?.curveFeeBps, `${config.curveFeeBps / 100}%`);
  compare(
    "Graduation threshold",
    config.graduationThreshold,
    EXPECTED[ENV]?.graduationThresholdWei,
    `${formatEther(config.graduationThreshold)} ${symbol}`,
  );
  pass("Supply", `${formatEther(config.supply)} tokens`);
  pass("Phantom quote", `${formatEther(config.phantomQuote)} ${symbol}`);
  // Uniswap v4 fees are hundredths of a bip, and 0x800000 is the dynamic-fee
  // flag rather than a rate — so the raw value is printed alongside, and a
  // dynamic pool is named instead of being rendered as "0%".
  const DYNAMIC_FEE_FLAG = 0x800000;
  pass(
    "Pool",
    `fee ${
      config.poolFee === DYNAMIC_FEE_FLAG
        ? "dynamic"
        : `${config.poolFee / 10_000}% (raw ${config.poolFee})`
    } · tick spacing ${config.tickSpacing}`,
  );

  section("Launch terms digest");
  try {
    const digest = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "previewLaunchEconomics",
      args: [LAUNCH_CONFIG_ID, NATIVE_QUOTE],
    });
    pass("previewLaunchEconomics answers", digest);
  } catch (e) {
    fail(
      "previewLaunchEconomics failed",
      `Without it a launch cannot pin Pons's terms and will revert with LaunchEconomicsMismatch on any drift. ${String((e as Error).message).split("\n")[0]}`,
    );
  }

  section("Quoting");
  // Pons has no quoter, so every price on the site comes from eth_simulateV1
  // with a state override. If this RPC does not support it, the trade panel
  // cannot show a number — and must not invent one.
  try {
    const probe: Address = `0x${"0".repeat(35)}beef1`;
    await client.simulateCalls({
      account: probe,
      stateOverrides: [{ address: probe, balance: 10n ** 18n }],
      calls: [{ to: probe, value: 0n }],
    });
    pass("RPC supports eth_simulateV1 with state overrides");
  } catch (e) {
    fail(
      "RPC does not support simulated calls",
      `Trade quotes are produced by simulating the real buy/sell against the live curve — this RPC cannot do that, so the trade panel will show an error instead of a price. ${String((e as Error).message).split("\n")[0]}`,
    );
  }

  section("Quote asset");
  try {
    const approved = await client.readContract({
      address: FACTORY,
      abi: factoryAbi,
      functionName: "approvedPairTokens",
      args: [NATIVE_QUOTE],
    });
    // The native asset is address(0) and Pons treats it specially rather than
    // through the pair-token allowlist, so `false` here is expected and not a
    // problem. On Arc that native asset is USDC, not ether.
    pass(
      `Native ${symbol} quote`,
      approved ? "explicitly approved" : "address(0), handled natively by Pons",
    );
  } catch {
    warn(
      "approvedPairTokens unavailable",
      `Could not check, which is not fatal for a ${symbol}-quoted launch.`,
    );
  }

  finish();
}

function compare(label: string, actual: bigint, expected: bigint | undefined, pretty: string) {
  // No recorded expectation means this repo has never adopted this chain's
  // deployment. Reporting the live value is the most that can honestly be said;
  // inventing a baseline to compare against would manufacture a false all-clear.
  if (expected === undefined) {
    pass(label, `${pretty}  \x1b[2m(nothing recorded for ${ENV} — reported, not checked)\x1b[0m`);
    return;
  }
  if (actual === expected) {
    pass(label, pretty);
  } else {
    warn(
      `${label} has changed`,
      `Code expects ${expected}, the chain says ${actual} (${pretty}). ` +
        `The app reads this live so it will still work — but update the comments in src/lib/pons so they stop claiming otherwise.`,
    );
  }
}

function finish(): never {
  console.log("");
  if (failures > 0) {
    console.log(
      `\x1b[31m${failures} failure${failures === 1 ? "" : "s"}\x1b[0m` +
        (warnings > 0 ? `, \x1b[33m${warnings} warning${warnings === 1 ? "" : "s"}\x1b[0m` : ""),
    );
    console.log("Something this repo believes about Pons is no longer true.\n");
    process.exit(1);
  }
  if (warnings > 0) {
    console.log(`\x1b[33m${warnings} warning${warnings === 1 ? "" : "s"}\x1b[0m — nothing broken, but worth reading.\n`);
    process.exit(0);
  }
  console.log("\x1b[32mEverything checks out.\x1b[0m\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(`\n\x1b[31mVerification crashed:\x1b[0m ${(e as Error).message}\n`);
  process.exit(1);
});
