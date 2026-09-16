import { describe, expect, test } from "vitest";
import { MAINNET_FACTORY, parseConfigId, resolveFactory } from "./deployment";
import { CHAIN_ENVS } from "../chain";

/**
 * This value used to go through a bare `BigInt(...)` at module scope, in a
 * module that a client component imports. `BigInt` throws a SyntaxError on
 * anything that is not a clean integer, and a throw at module scope during
 * evaluation takes down SSR and hydration together — on every page, not just
 * the launch page.
 *
 * The trigger is ordinary: dotenv does not strip trailing comments, so
 * `NEXT_PUBLIC_PONS_LAUNCH_CONFIG_ID=0 # standard curve` is enough to do it.
 * Every sibling env var in this file is validated and falls back; this one was
 * the exception.
 */

describe("parseConfigId", () => {
  test("reads a plain integer", () => {
    expect(parseConfigId("3")).toBe(3n);
  });

  test("tolerates surrounding whitespace", () => {
    expect(parseConfigId("  2  ")).toBe(2n);
  });

  test("falls back to config 0 when unset or empty", () => {
    expect(parseConfigId(undefined)).toBe(0n);
    expect(parseConfigId("")).toBe(0n);
    expect(parseConfigId("   ")).toBe(0n);
  });

  test("survives a trailing comment instead of throwing", () => {
    expect(() => parseConfigId("0 # standard curve")).not.toThrow();
    expect(parseConfigId("0 # standard curve")).toBe(0n);
  });

  test("refuses junk rather than guessing a config id", () => {
    // A wrong config id launches on terms nobody chose, so anything
    // unparseable has to land on the documented default.
    expect(parseConfigId("abc")).toBe(0n);
    expect(parseConfigId("1.5")).toBe(0n);
    expect(parseConfigId("-1")).toBe(0n);
    expect(parseConfigId("0x02")).toBe(0n);
  });
});

/**
 * Which chains may build a launch transaction without being told where to send
 * it.
 *
 * Exactly one: Robinhood mainnet, whose factory this repo read off chain 4663.
 * Everything else must be configured, and that includes Arc — even though a
 * Pons-ABI-compatible factory demonstrably is live there.
 *
 * The Arc case is the one worth spelling out, because "we found one" reads like
 * a reason to ship it as a default. Measured on 5042 on 2026-09-17:
 * 0xd6b86b9B1bB64b941b21AaA6a0e3A673e8405A3b holds 24,121 bytes, answers
 * getLaunchConfig(0) and previewLaunchEconomics, and its config 0 is Pons's
 * curve redenominated — 1B supply, 100 bps fee, graduation at 10,000 USDC.
 *
 * It is also roughly fourteen hours old, carries a single token launched by its
 * own deployer, and has been audited by nobody. Arc gas is USDC, so a default
 * there spends real money on an unreviewed contract that the user never chose.
 * The repo's existing rule already covers this: a real-money network is opt-in
 * and nothing else.
 */
const ARC_SOLONPAD = "0xd6b86b9B1bB64b941b21AaA6a0e3A673e8405A3b" as const;

describe("resolveFactory", () => {
  test("a configured address wins on every chain, including mainnet", () => {
    for (const env of CHAIN_ENVS) {
      expect(resolveFactory(env, ARC_SOLONPAD)).toBe(ARC_SOLONPAD);
    }
  });

  test("mainnet falls back to the factory verified on chain 4663", () => {
    expect(resolveFactory("mainnet", null)).toBe(MAINNET_FACTORY);
  });

  test("every other chain refuses to guess", () => {
    const guessing = CHAIN_ENVS.filter(
      (env) => env !== "mainnet" && resolveFactory(env, null) !== null,
    );
    expect(guessing).toEqual([]);
  });

  test("Arc has no default, despite a live Pons-compatible factory", () => {
    // See the note above. Finding one is not the same as vouching for it.
    expect(resolveFactory("arc", null)).toBeNull();
    expect(resolveFactory("arc-testnet", null)).toBeNull();
  });
});
