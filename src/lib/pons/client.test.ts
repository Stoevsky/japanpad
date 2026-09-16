import { describe, expect, test } from "vitest";
import {
  ContractFunctionZeroDataError,
  HttpRequestError,
  TimeoutError,
} from "viem";
import { isMissingContract } from "./client";

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
