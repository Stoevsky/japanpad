/**
 * Throwaway probe. Two questions:
 *   1. What getLogs range does Arc's public RPC actually allow? (read.ts
 *      assumes 10k is "comfortably inside every one we hit" — not true here.)
 *   2. Is the Pons-ABI factory on Arc in use, or just deployed?
 *
 * Deleted once it has answered.
 */
import { createPublicClient, http, defineChain } from "viem";
import { ponsV2FactoryAbi, ponsV2CurveAbi, ponsV2TokenAbi } from "./src/lib/pons/abi";

const FACTORY = "0xd6b86b9B1bB64b941b21AaA6a0e3A673e8405A3b" as const;
const arc = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
});
const client = createPublicClient({ chain: arc, transport: http("https://rpc.mainnet.arc.io") });
const ev = ponsV2FactoryAbi.find((x) => x.type === "event" && x.name === "TokenLaunched") as any;

const head = await client.getBlockNumber();

// 1. Find the getLogs cap.
let cap = 0;
for (const size of [10_000, 5_000, 2_000, 1_000, 500, 100]) {
  try {
    await client.getLogs({ address: FACTORY, event: ev, fromBlock: head - BigInt(size), toBlock: head });
    cap = size;
    console.log(`getLogs range ${size} OK`);
    break;
  } catch (e) {
    console.log(`getLogs range ${size} -> ${(e as Error).message.split("\n").find((l) => l.trim() && !l.startsWith("URL")) ?? "?"}`);
  }
}
if (!cap) { console.log("no workable range found"); process.exit(0); }

// 2. Bisect for the deployment block — cheaper than scanning 21M blocks.
//    Requires archive-state getCode; if the node prunes, this bails out.
let lo = 0n, hi = head, deployed = -1n;
try {
  const atHead = await client.getCode({ address: FACTORY, blockNumber: head });
  const atZero = await client.getCode({ address: FACTORY, blockNumber: 1n });
  if (!atHead || atHead === "0x") throw new Error("no code at head");
  if (atZero && atZero !== "0x") { deployed = 0n; }
  else {
    while (lo < hi) {
      const mid = (lo + hi) / 2n;
      const code = await client.getCode({ address: FACTORY, blockNumber: mid });
      if (code && code !== "0x") hi = mid; else lo = mid + 1n;
    }
    deployed = lo;
  }
  console.log(`\nfactory first has code at block ${deployed} (${((Number(head - deployed) * 0.506) / 86400).toFixed(1)} days ago)`);
} catch (e) {
  console.log(`\nbisect failed (likely a pruned node): ${(e as Error).message.split("\n")[0]}`);
}

// 3. Scan forward from deployment for launches.
let found: any[] = [];
const start = deployed >= 0n ? deployed : head - BigInt(cap) * 40n;
let total = 0;
for (let from = start; from <= head && found.length < 5; from += BigInt(cap)) {
  const to = from + BigInt(cap) > head ? head : from + BigInt(cap);
  try {
    const logs = await client.getLogs({ address: FACTORY, event: ev, fromBlock: from, toBlock: to });
    if (logs.length) { found.push(...logs); total += logs.length; console.log(`  ${logs.length} launches in ${from}..${to}`); }
  } catch { /* skip refused range */ }
}

console.log(`\n${total} TokenLaunched events found.`);
if (found.length) {
  const last = found[found.length - 1];
  console.log("sample:", JSON.stringify(last.args, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  const token = last.args.token as `0x${string}`;
  const curve = last.args.curve as `0x${string}`;
  for (const fn of ["name", "symbol", "totalSupply"] as const) {
    try { console.log(`  token.${fn}() = ${await client.readContract({ address: token, abi: ponsV2TokenAbi, functionName: fn })}`); }
    catch (e) { console.log(`  token.${fn}() FAILED: ${(e as Error).message.split("\n")[0]}`); }
  }
  for (const fn of ["realQuoteReserve", "graduated", "graduationThreshold", "pairToken"] as const) {
    try { console.log(`  curve.${fn}() = ${await client.readContract({ address: curve, abi: ponsV2CurveAbi, functionName: fn })}`); }
    catch (e) { console.log(`  curve.${fn}() FAILED: ${(e as Error).message.split("\n")[0]}`); }
  }
}
