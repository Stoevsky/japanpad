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

export type ChainEnv = "mainnet" | "testnet" | "local";

interface ChainPreset {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  /** Robinhood's own faucet, for topping up a testnet wallet. */
  faucetUrl: string | null;
  /** Multicall3, verified by calling getChainId() and comparing the answer. */
  multicall3: `0x${string}` | null;
}

const PRESETS: Record<ChainEnv, ChainPreset> = {
  mainnet: {
    id: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood Chain",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    faucetUrl: null,
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  testnet: {
    id: 46630,
    name: "Robinhood Chain Testnet",
    shortName: "Robinhood Chain Testnet",
    rpcUrl: "https://rpc.testnet.chain.robinhood.com",
    explorerUrl: "https://explorer.testnet.chain.robinhood.com",
    faucetUrl: "https://faucet.testnet.chain.robinhood.com",
    multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  },
  local: {
    id: 31337,
    name: "Anvil",
    shortName: "Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "",
    faucetUrl: null,
    multicall3: parseAddress(process.env.NEXT_PUBLIC_MULTICALL3),
  },
};

function parseEnv(raw: string | undefined): ChainEnv | null {
  return raw === "mainnet" || raw === "testnet" || raw === "local" ? raw : null;
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

/** Testnet and local carry play money. Every surface that shows a price says so. */
export const VALUES_ARE_REAL = IS_MAINNET;

export const CHAIN_ID = preset.id;
export const CHAIN_NAME = preset.name;
export const CHAIN_SHORT_NAME = preset.shortName;
export const EXPLORER_URL = preset.explorerUrl;
export const FAUCET_URL = preset.faucetUrl;
export const MULTICALL3 = preset.multicall3;

/** A private RPC always wins, so production never leans on the public endpoint. */
const overrideRpc = process.env.JAPANPAD_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;
export const RPC_URL =
  overrideRpc && /^https?:\/\//.test(overrideRpc) ? overrideRpc : preset.rpcUrl;

export const japanpadChain = defineChain({
  id: preset.id,
  name: preset.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: preset.explorerUrl
    ? { default: { name: "Blockscout", url: preset.explorerUrl } }
    : undefined,
  contracts: preset.multicall3
    ? { multicall3: { address: preset.multicall3 } }
    : undefined,
  testnet: !IS_MAINNET,
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
export const IS_ARBITRUM_ORBIT = CHAIN_ENV !== "local";

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
