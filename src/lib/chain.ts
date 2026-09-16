import { defineChain } from "viem";

/**
 * The only place in this repo that knows a chain id, RPC, or explorer URL.
 *
 * Provenance: adapted from stockpad/packages/shared/src/chains.ts, where every
 * value was read off the live networks rather than copied from docs — chain
 * 4663 answers eth_chainId with 0x1237, chain 46630 with 0xb626. A wrong value
 * here is a launch broadcast to a chain nobody is watching, so an unrecognised
 * environment resolves to testnet instead of guessing.
 *
 * What is deliberately NOT here: the EIP-1967 Stock Token beacon. StockPad
 * needs it to prove a coin's claimed stock pairing is authentic. JapanPad makes
 * no stock claim at all (see lib/pons/tag.ts), so it has nothing to verify and
 * carrying the constant would only invite someone to build a claim on it.
 */

export type ChainEnv = "mainnet" | "testnet" | "local" | "arc" | "arc-testnet";

interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

interface ChainPreset {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  /** The chain's own faucet, for topping up a testnet wallet. */
  faucetUrl: string | null;
  /** Multicall3, verified by calling getChainId() and comparing the answer. */
  multicall3: `0x${string}` | null;
  /**
   * The gas token. Not every chain here pays in ether, so no surface may
   * hardcode "ETH" — see NATIVE_SYMBOL.
   */
  nativeCurrency: NativeCurrency;
  /** Real money. Testnets and local carry play money and must say so. */
  valuesAreReal: boolean;
  /** Arbitrum Orbit rollups report the parent chain's height in `block.number`. */
  isArbitrumOrbit: boolean;
  /**
   * The widest `eth_getLogs` range this chain's public RPC will serve.
   *
   * Every endpoint caps this and they do not agree, so it belongs with the
   * chain rather than in the indexer. A range above the cap is refused, the
   * scanner skips it, and a scan that skips every range renders exactly like a
   * chain nobody has launched on — which is the failure mode worth avoiding.
   */
  logsChunkLimit: bigint;
}

const ETHER: NativeCurrency = { name: "Ether", symbol: "ETH", decimals: 18 };

/**
 * Arc pays gas in USDC, and the denomination is the trap.
 *
 * Arc exposes USDC through two interfaces that differ by a factor of 10^12:
 * the native one — gas, `msg.value`, plain sends — carries 18 decimals, while
 * the ERC-20 one carries the usual 6. This is the native side, so 18 is right
 * and `formatEth`'s 18-decimal maths needs no special case. Verified by
 * magnitude as well as by docs: `eth_gasPrice` on 5042 answers 20 gwei, which
 * over a 21,000-gas send is 4.2e14 base units. At 18 decimals that is $0.00042;
 * at 6 it would be $420 million.
 */
const ARC_USDC: NativeCurrency = { name: "USDC", symbol: "USDC", decimals: 18 };

const PRESETS: Record<ChainEnv, ChainPreset> = {
  mainnet: {
    id: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood Chain",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    faucetUrl: null,
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeCurrency: ETHER,
    valuesAreReal: true,
    isArbitrumOrbit: true,
    logsChunkLimit: 9_000n,
  },
  testnet: {
    id: 46630,
    name: "Robinhood Chain Testnet",
    shortName: "Robinhood Chain Testnet",
    rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    explorerUrl: "https://explorer.testnet.chain.robinhood.com",
    faucetUrl: "https://faucet.testnet.chain.robinhood.com",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeCurrency: ETHER,
    valuesAreReal: false,
    isArbitrumOrbit: true,
    logsChunkLimit: 9_000n,
  },
  /**
   * Arc, Circle's L1, whose mainnet opened on 2026-09-16.
   *
   * Every value read off the live network on 2026-09-17, to the same standard
   * as the Robinhood entries above: `eth_chainId` answered 0x13b2 (5042) on
   * mainnet and 0x4cef52 (5042002) on testnet, and Multicall3 at the canonical
   * address answered `getChainId()` with those same ids on both.
   *
   * Not an Orbit rollup, so `block.number` means what it says here.
   */
  arc: {
    id: 5042,
    name: "Arc",
    shortName: "Arc",
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    faucetUrl: null,
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeCurrency: ARC_USDC,
    valuesAreReal: true,
    isArbitrumOrbit: false,
    // Measured on 5042: a 10,000-block range answers "Request exceeds defined
    // limit"; 5,000 is served.
    logsChunkLimit: 5_000n,
  },
  "arc-testnet": {
    id: 5042002,
    name: "Arc Testnet",
    shortName: "Arc Testnet",
    rpcUrl: "https://rpc.testnet.arc.io",
    explorerUrl: "https://explorer.testnet.arc.io",
    // Arc runs one, but this has not been confirmed against a live URL, and a
    // faucet link that 404s is worse than no faucet link.
    faucetUrl: null,
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    nativeCurrency: ARC_USDC,
    valuesAreReal: false,
    isArbitrumOrbit: false,
    logsChunkLimit: 5_000n,
  },
  local: {
    id: 31337,
    name: "Anvil",
    shortName: "Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "",
    faucetUrl: null,
    multicall3: parseAddress(process.env.NEXT_PUBLIC_MULTICALL3),
    nativeCurrency: ETHER,
    valuesAreReal: false,
    isArbitrumOrbit: false,
    logsChunkLimit: 9_000n,
  },
};

export const CHAIN_ENVS = Object.keys(PRESETS) as ChainEnv[];

/** Exposed so the invariants below can be tested without booting a network. */
export const CHAIN_PRESETS: Readonly<Record<ChainEnv, Readonly<ChainPreset>>> = PRESETS;

function parseEnv(raw: string | undefined): ChainEnv | null {
  const value = raw?.trim();
  return value && value in PRESETS ? (value as ChainEnv) : null;
}

function parseAddress(raw: string | undefined): `0x${string}` | null {
  const value = raw?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as `0x${string}`) : null;
}

/**
 * Mainnet is opt-in and nothing else. A misconfigured deploy that silently
 * picks mainnet spends real ETH and mints a token nobody meant to create.
 *
 * The NEXT_PUBLIC_ mirror exists because the browser cannot read a private
 * variable; assertChainConfig() refuses to boot when the two disagree, so a
 * server that believes it is on testnet can never serve a mainnet bundle.
 */
const serverEnv = parseEnv(process.env.JAPANPAD_NETWORK);
const clientEnv = parseEnv(process.env.NEXT_PUBLIC_JAPANPAD_NETWORK);

export const CHAIN_ENV: ChainEnv = clientEnv ?? serverEnv ?? "testnet";

const preset = PRESETS[CHAIN_ENV];

export const IS_MAINNET = CHAIN_ENV === "mainnet";
export const IS_TESTNET = CHAIN_ENV === "testnet";
export const IS_LOCAL = CHAIN_ENV === "local";
export const IS_ARC = CHAIN_ENV === "arc" || CHAIN_ENV === "arc-testnet";

/** Testnets and local carry play money. Every surface that shows a price says so. */
export const VALUES_ARE_REAL = preset.valuesAreReal;

export const CHAIN_ID = preset.id;
export const CHAIN_NAME = preset.name;
export const CHAIN_SHORT_NAME = preset.shortName;
export const EXPLORER_URL = preset.explorerUrl;
export const FAUCET_URL = preset.faucetUrl;
export const MULTICALL3 = preset.multicall3;

/** The widest getLogs range this chain's RPC serves. See ChainPreset. */
export const LOGS_CHUNK_LIMIT = preset.logsChunkLimit;

/**
 * The gas token's ticker — "ETH" on Robinhood Chain, "USDC" on Arc.
 *
 * Every price, balance and fee in the UI reads this instead of writing "ETH",
 * because on Arc that label would name the wrong asset.
 */
export const NATIVE_CURRENCY = preset.nativeCurrency;
export const NATIVE_SYMBOL = preset.nativeCurrency.symbol;

/** An endpoint, or null if the value is not one. Half-edited `.env` lines happen. */
function parseRpcUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && /^https?:\/\//.test(value) ? value : null;
}

/**
 * Picks the endpoint a given chain's reads go to.
 *
 * The rule that earns its own function is the scope of the un-suffixed override.
 * `JAPANPAD_RPC_URL` names one endpoint, and an endpoint serves one chain — so
 * applying it to whichever chain happens to be selected is how Arc reads get
 * sent to a Robinhood node. That failure is quiet: the node answers, it just
 * answers about a different chain, so balances and launches come back wrong
 * rather than missing, which is the shape of bug that survives a demo.
 *
 * So the global override belongs to the chain the build targets and nothing
 * else. Every other chain uses its own variable or its public endpoint.
 */
export function resolveRpcUrl(args: {
  perChain: string | undefined;
  global: string | undefined;
  isDefaultChain: boolean;
  fallback: string;
}): string {
  const perChain = parseRpcUrl(args.perChain);
  if (perChain) return perChain;
  const global = args.isDefaultChain ? parseRpcUrl(args.global) : null;
  return global ?? args.fallback;
}

/**
 * Per-chain endpoints, spelled out rather than built from a computed key.
 *
 * Same constraint as the factory addresses in pons/deployment.ts: Next inlines
 * `NEXT_PUBLIC_` variables by textually substituting `process.env.NEXT_PUBLIC_FOO`
 * during the build, so a computed access matches no literal and is undefined in
 * the browser while working fine on the server. Adding a chain means adding a
 * line to both records.
 */
const PRIVATE_RPC: Record<ChainEnv, string | undefined> = {
  mainnet: process.env.JAPANPAD_RPC_URL_MAINNET,
  testnet: process.env.JAPANPAD_RPC_URL_TESTNET,
  arc: process.env.JAPANPAD_RPC_URL_ARC,
  "arc-testnet": process.env.JAPANPAD_RPC_URL_ARC_TESTNET,
  local: process.env.JAPANPAD_RPC_URL_LOCAL,
};

const PUBLIC_RPC: Record<ChainEnv, string | undefined> = {
  mainnet: process.env.NEXT_PUBLIC_RPC_URL_MAINNET,
  testnet: process.env.NEXT_PUBLIC_RPC_URL_TESTNET,
  arc: process.env.NEXT_PUBLIC_RPC_URL_ARC,
  "arc-testnet": process.env.NEXT_PUBLIC_RPC_URL_ARC_TESTNET,
  local: process.env.NEXT_PUBLIC_RPC_URL_LOCAL,
};

/**
 * The endpoint reads for `env` go to.
 *
 * Layered, private over public: an authenticated endpoint wins where it is
 * readable, falling through to whatever the browser would use, and finally to
 * the chain's own public RPC. In the browser the private names are never
 * inlined and so are always undefined, which is the point — the key stays on
 * the server and the page still resolves an endpoint.
 */
export function rpcUrlFor(env: ChainEnv): string {
  const isDefaultChain = env === CHAIN_ENV;
  const published = resolveRpcUrl({
    perChain: PUBLIC_RPC[env],
    global: process.env.NEXT_PUBLIC_RPC_URL,
    isDefaultChain,
    fallback: PRESETS[env].rpcUrl,
  });
  return resolveRpcUrl({
    perChain: PRIVATE_RPC[env],
    global: process.env.JAPANPAD_RPC_URL,
    isDefaultChain,
    fallback: published,
  });
}

export const RPC_URL = rpcUrlFor(CHAIN_ENV);

export const japanpadChain = defineChain({
  id: preset.id,
  name: preset.name,
  nativeCurrency: preset.nativeCurrency,
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: preset.explorerUrl
    ? { default: { name: "Explorer", url: preset.explorerUrl } }
    : undefined,
  contracts: preset.multicall3
    ? { multicall3: { address: preset.multicall3 } }
    : undefined,
  testnet: !preset.valuesAreReal,
});

/**
 * Robinhood Chain is an Arbitrum Orbit rollup, and that leaks in one place.
 *
 * Inside the EVM, `block.number` is the *parent* chain's height, not this
 * chain's. Measured on 4663: `block.number` read 25,969,669 while
 * `eth_blockNumber` read 62,093,579 — 36 million blocks apart. `block.timestamp`
 * is fine; it matched wall clock to within three seconds.
 *
 * So: a block height that came from an RPC (`eth_blockNumber`, a log's
 * `blockNumber`, a receipt) is this chain's and is what `eth_getLogs` wants. A
 * block height that came from inside a contract is the parent's and is
 * meaningless here.
 */
export const IS_ARBITRUM_ORBIT = preset.isArbitrumOrbit;

export function txUrl(hash: string): string {
  return preset.explorerUrl ? `${preset.explorerUrl}/tx/${hash}` : "";
}

export function addressUrl(address: string): string {
  return preset.explorerUrl ? `${preset.explorerUrl}/address/${address}` : "";
}

/**
 * Decides whether a network configuration is coherent across both sides.
 *
 * Pure, and separate from the assertion, so the interesting cases can be tested
 * without a process to set variables on.
 *
 * The case that matters is the one-sided config. `JAPANPAD_NETWORK` has no
 * `NEXT_PUBLIC_` prefix, so Next never inlines it into the browser bundle —
 * the built chunk carries the un-inlined access `c(a.env.JAPANPAD_NETWORK)`,
 * which is undefined client-side. Setting it alone therefore gives a server
 * rendering mainnet addresses and a browser resolving the testnet default, with
 * nothing to say so. Requiring the mirror whenever the server value is set
 * closes that, and refusing even the case where the default coincidentally
 * agrees keeps the rule one a reader can hold in their head.
 */
export function chainConfigError(
  server: ChainEnv | null,
  client: ChainEnv | null,
): string | null {
  if (!server) return null;
  if (!client) {
    return (
      `JAPANPAD_NETWORK=${server} is set but NEXT_PUBLIC_JAPANPAD_NETWORK is not. ` +
      `The browser cannot read a non-public variable, so it would fall back to ` +
      `${PRESETS.testnet.name} while the server used ${PRESETS[server].name}. ` +
      `Set NEXT_PUBLIC_JAPANPAD_NETWORK=${server} as well.`
    );
  }
  if (server !== client) {
    return (
      `Network mismatch: JAPANPAD_NETWORK=${server} but ` +
      `NEXT_PUBLIC_JAPANPAD_NETWORK=${client}. Set both to the same value.`
    );
  }
  return null;
}

/**
 * Fails fast when the server and client disagree about the network, which is
 * the one misconfiguration that would otherwise surface as a signature request
 * on the wrong chain.
 */
export function assertChainConfig(): void {
  const error = chainConfigError(serverEnv, clientEnv);
  if (error) throw new Error(error);
}
