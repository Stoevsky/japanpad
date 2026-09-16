import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";
import { NATIVE_SYMBOL } from "@/lib/chain";

/**
 * Turning a chain refusal into a sentence.
 *
 * Shared by the quoter and the sender, because they fail the same ways: a
 * simulated `buy` that reverts with `CurveGraduated` and a submitted one that
 * does are the same fact, and a user should not get two different explanations
 * depending on which side of the button they are on.
 *
 * The order matters. A rejection is checked first because it is not a failure
 * and should leave no red text behind; a named revert is checked before the
 * generic message because "CurveGraduated" is information and "execution
 * reverted" is not.
 */

/** Null means the user dismissed their wallet — a choice, not an error. */
export function describeTxError(e: unknown): string | null {
  if (e instanceof BaseError) {
    const rejected = e.walk((err) => err instanceof UserRejectedRequestError);
    if (rejected) return null;

    const reverted = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name) return revertSentence(name);
      if (reverted.reason) return reverted.reason;
    }

    return e.shortMessage || "The transaction failed.";
  }

  const code = (e as { code?: number })?.code;
  if (code === 4001) return null;
  return "The transaction failed.";
}

/**
 * Pons's revert names, in words.
 *
 * An unrecognised name is shown rather than swallowed. These contracts are not
 * ours and can add errors we have never seen; printing the name is worse than a
 * written sentence but far better than "something went wrong".
 */
export function revertSentence(name: string): string {
  switch (name) {
    case "LaunchFeeNotPaid":
      return "Pons rejected the launch fee. It must match its current fee exactly — reload and try again.";
    case "LaunchEconomicsMismatch":
      return "Pons changed its launch terms while you were signing. Reload to pick up the new ones.";
    case "LaunchConfigDisabled":
    case "InvalidLaunchConfigId":
      return "Pons has disabled the launch config this site uses.";
    case "InvalidTokenParams":
      return "Pons rejected the token details. A name and symbol are both required.";
    case "NotWhitelisted":
      return "Pons is not accepting launches from this address.";
    case "PairTokenNotApproved":
      return "Pons does not accept this quote asset.";
    case "SlippageExceeded":
      return "The price moved past your slippage limit. Re-quote and try again.";
    case "CurveGraduated":
      return "This curve has finished. Its liquidity has moved to a Uniswap pool, so it no longer trades here.";
    case "NativeValueMismatch":
      return "The amount sent did not match the amount quoted. Re-quote and try again.";
    case "UnexpectedNativeValue":
      // Seen on a live Pons curve quoted in an ERC-20 rather than ETH. JapanPad
      // only lists ETH-quoted curves, so reaching this means the curve is not
      // one of ours — worth saying plainly rather than blaming the trade.
      return `This curve does not trade against ${NATIVE_SYMBOL}, so it cannot be traded here.`;
    case "ZeroAmount":
      return "That amount rounds to nothing on this curve.";
    case "ZeroAddress":
      return "That recipient address is not valid.";
    case "TransferFailed":
      return `The ${NATIVE_SYMBOL} transfer failed.`;
    default:
      return `Pons refused this: ${name}.`;
  }
}
