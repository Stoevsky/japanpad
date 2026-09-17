import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { CHAIN_PRESETS, rpcUrlFor, MULTICALL3 } from "../src/lib/chain.ts";
import { ponsV2TokenAbi } from "../src/lib/pons/abi.ts";

// Inlined rather than imported: deployment.ts and tag.ts reach back into
// extensionless "../chain", which node's ESM loader will not resolve.
const MAINNET_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e" as Address;
const TAG_RE = /\[JapanPad\]\s*theme:([a-z-]+)/i;
const parseThemeTag = (d: string): string | null => TAG_RE.exec(d)?.[1] ?? null;

const ENV = "mainnet" as const;
const preset = CHAIN_PRESETS[ENV];
const rpc = rpcUrlFor(ENV);
const client = createPublicClient({
  chain: {
    id: preset.id,
    name: preset.name,
    nativeCurrency: preset.nativeCurrency,
    rpcUrls: { default: { http: [rpc] } },
    contracts: preset.multicall3 ? { multicall3: { address: preset.multicall3 } } : undefined,
  },
  transport: http(rpc, { batch: true, timeout: 30_000, retryCount: 3 }),
});

const TOKEN_LAUNCHED = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
);

const head = await client.getBlockNumber();
const LOOKBACK = 400_000n;
const floor = head > LOOKBACK ? head - LOOKBACK : 0n;
const CHUNK = 9_000n;

console.log(`chain ${preset.name} (${preset.id})  head=${head}  scanning back to ${floor}`);

type Raw = { token: Address; deployer: Address; block: bigint };
const all: Raw[] = [];
let to = head;
let refused = 0;
while (to >= floor) {
  const from = to > floor + CHUNK ? to - CHUNK : floor;
  try {
    const logs = await client.getLogs({
      address: MAINNET_FACTORY,
      event: TOKEN_LAUNCHED,
      fromBlock: from,
      toBlock: to,
    });
    for (const l of logs) {
      all.push({ token: l.args.token!, deployer: l.args.deployer!, block: l.blockNumber! });
    }
  } catch {
    refused++;
  }
  if (from === floor) break;
  to = from - 1n;
}

all.sort((a, b) => (b.block > a.block ? 1 : -1));
console.log(`raw TokenLaunched in window: ${all.length}   (ranges refused: ${refused})`);
if (all.length === 0) process.exit(0);
console.log(`newest raw launch at block ${all[0]!.block}, oldest at ${all[all.length - 1]!.block}`);

// Descriptions in batches, so we can find every JapanPad-tagged one.
const multicall = MULTICALL3 ? { multicallAddress: MULTICALL3 as Address } : {};
const japanpad: Array<{ i: number; token: Address; name: string; symbol: string; theme: string; block: bigint }> = [];
const BATCH = 60;
for (let s = 0; s < all.length; s += BATCH) {
  const slice = all.slice(s, s + BATCH);
  const res = await client.multicall({
    ...multicall,
    allowFailure: true,
    contracts: slice.flatMap((r) => [
      { address: r.token, abi: ponsV2TokenAbi, functionName: "description" } as const,
      { address: r.token, abi: ponsV2TokenAbi, functionName: "name" } as const,
      { address: r.token, abi: ponsV2TokenAbi, functionName: "symbol" } as const,
    ]),
  });
  for (let k = 0; k < slice.length; k++) {
    const d = res[k * 3];
    if (d?.status !== "success") continue;
    const theme = parseThemeTag(String(d.result));
    if (!theme) continue;
    const n = res[k * 3 + 1];
    const sy = res[k * 3 + 2];
    japanpad.push({
      i: s + k,
      token: slice[k]!.token,
      name: n?.status === "success" ? String(n.result) : "",
      symbol: sy?.status === "success" ? String(sy.result) : "",
      theme,
      block: slice[k]!.block,
    });
  }
}

console.log(`\nJapanPad-tagged launches on chain: ${japanpad.length}`);
for (const j of japanpad) {
  console.log(`  #${j.i.toString().padStart(4)}  $${j.symbol.padEnd(10)} ${j.name.padEnd(22)} ${j.theme.padEnd(12)} block ${j.block}  ${j.token}`);
}

// What the site's scan budget actually reaches. fetchLaunchLogs stops once it
// has collected limit*4 RAW launches, counting non-JapanPad ones.
for (const limit of [24, 48, 200]) {
  const budget = limit * 4;
  const reached = japanpad.filter((j) => j.i < budget).length;
  console.log(
    `\nlimit=${limit} -> budget ${budget} raw launches -> sees ${reached}/${japanpad.length} JapanPad coins` +
      (reached < japanpad.length ? "   <-- TRUNCATED" : ""),
  );
}
