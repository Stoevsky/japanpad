/**
 * Where a client-side crash goes.
 *
 * Today that is the browser console and nowhere else, which is a deliberate
 * placeholder rather than an oversight: this site has no analytics, no session
 * recording and no third-party script, and adding a reporting endpoint is a
 * decision with privacy consequences that should be made on purpose.
 *
 * It exists as a named function anyway so there is exactly one place to change
 * when that decision is made, instead of a `console.error` in every boundary.
 * If you wire this to a collector, note that the error text can carry a wallet
 * address — strip it rather than shipping it somewhere.
 */
export function logClientError(context: string, error: unknown): void {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[japanpad] ${context} boundary caught: ${message}`);
}
