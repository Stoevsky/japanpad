import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  createPublicClient,
  http,
} from "viem";
import { japanpadChain, RPC_URL } from "../chain";

/**
 * The read-only chain client, usable from both sides.
 *
 * Split out of read.ts, which is `server-only` because it holds the indexer.
 * The browser genuinely needs to read the chain — a quote is only true for the
 * block it was read at, so quoting has to happen in the browser as the user
 * types rather than on a server whose answer is already stale by the time it
 * arrives.
 *
 * Nothing secret goes through here. RPC_URL falls back to a private endpoint
 * when one is configured, and that is the one thing worth watching: a private
 * RPC set through JAPANPAD_RPC_URL stays server-side, while NEXT_PUBLIC_RPC_URL
 * is compiled into the bundle by definition. See lib/chain.ts.
 */
export const publicClient = createPublicClient({
  chain: japanpadChain,
  transport: http(RPC_URL, {
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
  }),
});

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

export function logRpcFailure(context: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.error(`[japanpad] ${context} failed: ${message}`);
}
