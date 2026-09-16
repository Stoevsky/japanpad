import { describe, expect, test } from "vitest";
import {
  ContractFunctionZeroDataError,
  HttpRequestError,
  TimeoutError,
} from "viem";
import { classifyReadFailure, isMissingContract } from "./client";

/**
 * Telling "there is no such token" apart from "the chain did not answer".
 *
 * The token page used to collapse both into `notFound()`, so an RPC blip told a
 * holder mid-sell that their token does not exist. That is a fabricated claim
 * about the chain, which is the one thing this codebase is not allowed to make
 * — the listing pages already refuse it via their `complete: false` path.
 *
 * The distinction is real and readable off the error. A contract call that came
 * back with no data, or reverted, is the chain answering: there is nothing of
 * that shape at that address. A timeout or a socket failure is the chain not
 * answering at all, and nothing can be concluded from it.
 */

describe("isMissingContract", () => {
  test("treats an empty return as the chain saying there is nothing there", () => {
    const error = new ContractFunctionZeroDataError({ functionName: "curve" });
    expect(isMissingContract(error)).toBe(true);
  });

  test("treats a nested empty return the same way", () => {
    // viem wraps the underlying cause, which is how it actually arrives.
    const inner = new ContractFunctionZeroDataError({ functionName: "curve" });
    const outer = new HttpRequestError({ url: "https://rpc.example", cause: inner });
    expect(isMissingContract(outer)).toBe(true);
  });

  test("refuses to conclude anything from a timeout", () => {
    const error = new TimeoutError({ body: {}, url: "https://rpc.example" });
    expect(isMissingContract(error)).toBe(false);
  });

  test("refuses to conclude anything from a transport failure", () => {
    const error = new HttpRequestError({ url: "https://rpc.example" });
    expect(isMissingContract(error)).toBe(false);
  });

  test("refuses to conclude anything from an unrecognised error", () => {
    expect(isMissingContract(new Error("socket hang up"))).toBe(false);
    expect(isMissingContract(null)).toBe(false);
    expect(isMissingContract("nope")).toBe(false);
  });
});

/**
 * Saying which of the two failures happened, not just that one did.
 *
 * A deploy pointed NEXT_PUBLIC_PONS_V2_FACTORY at an address that is not Pons,
 * and every page reported "Pons could not be read right now" — the same words
 * it uses when the RPC blinks. The message was true and useless: it named a
 * symptom common to a misconfiguration the operator can fix in a minute and an
 * outage they can do nothing about, and gave no way to tell which they had.
 *
 * The classification is the same one isMissingContract already draws. What is
 * new is carrying it as far as the screen instead of discarding it at the catch.
 */
describe("classifyReadFailure", () => {
  test("names a configured address that holds no Pons", () => {
    const error = new ContractFunctionZeroDataError({ functionName: "launchFee" });
    expect(classifyReadFailure(error)).toBe("wrong-address");
  });

  test("names an unreachable chain when the RPC times out", () => {
    const error = new TimeoutError({ body: {}, url: "https://rpc.example" });
    expect(classifyReadFailure(error)).toBe("unreachable");
  });

  test("blames the chain, not the address, when the error is unrecognised", () => {
    // The safe default. Telling an operator their address is wrong when it is
    // not sends them to change the one thing that was correct.
    expect(classifyReadFailure(new Error("socket hang up"))).toBe("unreachable");
  });
});
