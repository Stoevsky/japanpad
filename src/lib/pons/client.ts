import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  createPublicClient,
  http,
} from "viem";
import { CHAIN_ENV, chainFor, rpcUrlFor, type ChainEnv } from "../chain";

/**
 * The read-only chain clients, usable from both sides.
 *
 * Split out of read.ts, which is `server-only` because it holds the indexer.
 * The browser genuinely needs to read the chain — a quote is only true for the
 * block it was read at, so quoting has to happen in the browser as the user
 * types rather than on a server whose answer is already stale by the time it
 * arrives.
 *
 * Nothing secret goes through here. The endpoint falls back to a private one
 * when configured, and that is the one thing worth watching: a private RPC set
 * through JAPANPAD_RPC_URL stays server-side, while NEXT_PUBLIC_RPC_URL is
 * compiled into the bundle by definition. See lib/chain.ts.
 */
const TRANSPORT = {
  batch: true,
  // Robinhood's public endpoint drops connections under load — observed
  // mid-build as "Client network socket disconnected before secure TLS
  // connection was established", and once as a failed launch-terms read that
  // succeeded on every one of 36 retries a minute later. Retrying costs a few
  // hundred milliseconds; not retrying costs a page that tells the user Pons
  // is unreachable when it simply blinked.
  //
  // Bounded, though, and that bound is load-bearing. Five attempts at ten
  // seconds is fifty seconds for a single read, and five routes prerender at
  // build time with several reads each — which is how a deploy came to fail
  // outright with "/themes took more than 60 seconds", three times over.
  //
  // A build that cannot survive a slow RPC is a build you cannot ship a
  // hotfix from during an outage. Three attempts at six seconds caps one read
  // near twenty seconds, which leaves the prerender enough room to give up
  // and render the honest "unavailable" state instead of blowing the budget.
  // ISR fills in real data on the first revalidation afterwards.
  retryCount: 2,
  retryDelay: 250,
  timeout: 6_000,
} as const;

/**
 * Split out so the cache can be typed by what this actually returns.
 * `ReturnType<typeof createPublicClient>` resolves with the generic defaults,
 * which is a different and incompatible type from the client built here.
 */
function createClient(env: ChainEnv) {
  return createPublicClient({
    chain: chainFor(env),
    transport: http(rpcUrlFor(env), TRANSPORT),
  });
}

const CLIENTS = new Map<ChainEnv, ReturnType<typeof createClient>>();

/**
 * The client for one chain, built once.
 *
 * Memoised because a fresh client is a fresh batch scheduler: the token page's
 * sixteen reads would go out as sixteen requests instead of one multicall,
 * against an endpoint that already drops connections under load.
 *
 * The chain and the endpoint have to move together. Endpoints do not reject
 * requests meant for another chain — a Robinhood node handed an Arc address
 * answers, about a Robinhood address — so the failure mode of getting this
 * wrong is wrong data on a page with a trade panel, not a visible error.
 */
export function clientFor(env: ChainEnv): ReturnType<typeof createClient> {
  const existing = CLIENTS.get(env);
  if (existing) return existing;
  const client = createClient(env);
  CLIENTS.set(env, client);
  return client;
}

/** The client for the chain this build targets. */
export const publicClient = clientFor(CHAIN_ENV);

/**
 * Records why a chain read failed, without putting it on screen.
 *
 * Every caller of this module degrades to an honest "unavailable" state rather
 * than to invented data, which is right for the user and useless for whoever
 * has to work out whether the cause was a flaky RPC, a wrong address, or an ABI
 * that has drifted. The reason goes to the server log so that question has an
 * answer; the user still just sees that it could not be read.
 */
/**
 * Whether a failed read means "nothing of that shape lives there".
 *
 * There are two ways a contract read fails and they support opposite
 * conclusions. A call that returns no data, or reverts, is the chain answering
 * the question: the address holds no contract, or not one with this function.
 * A timeout or a dropped socket is the chain declining to answer, and nothing
 * whatsoever follows from it about what lives at the address.
 *
 * Collapsing the two is how a page ends up telling a holder that their token
 * does not exist because an RPC blinked. Anything unrecognised is treated as
 * the second case, so an unfamiliar error can only ever cost an honest
 * "unavailable" and never a false denial.
 */
export function isMissingContract(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  const definitive = error.walk(
    (e) =>
      e instanceof ContractFunctionZeroDataError ||
      e instanceof ContractFunctionRevertedError,
  );
  return definitive !== null;
}

/**
 * Which of the two failures a caller is looking at.
 *
 * `wrong-address` is a configuration mistake: something answered, and what it
 * said was that no contract of this shape lives at the address the deploy was
 * pointed at. An operator fixes that in a minute — but only if told, and the
 * single "could not be read" message this replaces never told them.
 *
 * `unreachable` is everything else, and is deliberately the fallback. Claiming
 * an address is wrong when the truth is a dropped socket sends whoever is on
 * call to change the one thing that was correct.
 */
export type ReadFailureKind = "wrong-address" | "unreachable";

export function classifyReadFailure(error: unknown): ReadFailureKind {
  return isMissingContract(error) ? "wrong-address" : "unreachable";
}

export function logRpcFailure(context: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.error(`[japanpad] ${context} failed: ${message}`);
}
