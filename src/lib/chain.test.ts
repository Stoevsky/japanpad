import { describe, expect, test } from "vitest";
import { CHAIN_ENVS, CHAIN_PRESETS, chainConfigError, resolveRpcUrl } from "./chain";

/**
 * The failure this guards against is not a mismatch between two set values —
 * that case was always caught. It is the one-sided config.
 *
 * `JAPANPAD_NETWORK` is not a `NEXT_PUBLIC_` variable, so Next never inlines it
 * into the browser bundle; the built chunk contains the un-inlined property
 * access `c(a.env.JAPANPAD_NETWORK)`, which evaluates to undefined client-side.
 * Set it alone to `mainnet` and the server renders mainnet addresses while the
 * browser resolves the testnet default, silently, because the old check only
 * fired when both values were present and disagreed.
 *
 * So the rule is: if the server value is set at all, the public mirror has to be
 * set too, and to the same thing. "It happens to agree with the default" is not
 * a configuration anyone should be relying on.
 */

describe("chainConfigError", () => {
  test("accepts no configuration at all", () => {
    expect(chainConfigError(null, null)).toBeNull();
  });

  test("accepts a matching pair", () => {
    expect(chainConfigError("mainnet", "mainnet")).toBeNull();
    expect(chainConfigError("testnet", "testnet")).toBeNull();
  });

  test("accepts the public mirror on its own, which both sides can read", () => {
    expect(chainConfigError(null, "mainnet")).toBeNull();
  });

  test("rejects a pair that disagrees", () => {
    const error = chainConfigError("mainnet", "testnet");
    expect(error).toContain("mainnet");
    expect(error).toContain("testnet");
  });

  test("rejects a server-only setting, which the browser cannot see", () => {
    const error = chainConfigError("mainnet", null);
    expect(error).not.toBeNull();
    expect(error).toContain("NEXT_PUBLIC_JAPANPAD_NETWORK");
  });

  test("rejects a server-only setting even when it matches the default", () => {
    // testnet is what the browser would fall back to anyway, so this one
    // happens to work. Relying on that coincidence is how the mainnet case
    // ships unnoticed.
    expect(chainConfigError("testnet", null)).not.toBeNull();
  });
});

/**
 * Which endpoint a given chain's reads go to.
 *
 * The rule that matters is the scope of the un-suffixed override. JAPANPAD_RPC_URL
 * names one endpoint, and one endpoint serves one chain — so applying it to
 * whichever chain happens to be selected is how Arc reads get sent to a
 * Robinhood node. That failure is quiet and nasty: the endpoint answers, it just
 * answers about a different chain, so balances and launches come back wrong
 * rather than missing.
 *
 * So the global override belongs to the chain the build targets, and every other
 * chain uses its own variable or its public endpoint.
 */
describe("resolveRpcUrl", () => {
  const fallback = "https://public.example";

  test("a chain's own endpoint wins over everything", () => {
    expect(
      resolveRpcUrl({
        perChain: "https://arc.private",
        global: "https://robinhood.private",
        isDefaultChain: true,
        fallback,
      }),
    ).toBe("https://arc.private");
  });

  test("the global override applies to the chain the build targets", () => {
    expect(
      resolveRpcUrl({
        perChain: undefined,
        global: "https://robinhood.private",
        isDefaultChain: true,
        fallback,
      }),
    ).toBe("https://robinhood.private");
  });

  test("the global override does NOT leak to other chains", () => {
    // The whole point. Switching to Arc with only JAPANPAD_RPC_URL set must not
    // send Arc's reads to the Robinhood node it names.
    expect(
      resolveRpcUrl({
        perChain: undefined,
        global: "https://robinhood.private",
        isDefaultChain: false,
        fallback,
      }),
    ).toBe(fallback);
  });

  test("falls back to the public endpoint when nothing is configured", () => {
    expect(
      resolveRpcUrl({ perChain: undefined, global: undefined, isDefaultChain: true, fallback }),
    ).toBe(fallback);
  });

  test("ignores a value that is not an http(s) URL", () => {
    // A half-edited .env line should not become the endpoint every read goes to.
    for (const junk of ["", "   ", "rpc.example.com", "wss://arc.example", "ws://x"]) {
      expect(
        resolveRpcUrl({ perChain: junk, global: undefined, isDefaultChain: true, fallback }),
      ).toBe(fallback);
    }
  });

  test("tolerates surrounding whitespace", () => {
    expect(
      resolveRpcUrl({
        perChain: "  https://arc.private  ",
        global: undefined,
        isDefaultChain: false,
        fallback,
      }),
    ).toBe("https://arc.private");
  });
});

/**
 * Invariants over the preset table itself.
 *
 * Adding a network is the kind of change that looks right in review and is
 * wrong on the chain. The two failures that actually cost something are a
 * testnet left marked as real money — which strips the "play money" warning off
 * every price on the site — and a duplicated or misremembered chain id, which
 * points the whole app at a network nobody is watching. Both are cheap to
 * assert and neither needs a live RPC.
 *
 * The values themselves were read off the live networks, not copied from docs:
 * eth_chainId answered 0x1237 on Robinhood mainnet, 0xb626 on its testnet,
 * 0x13b2 on Arc and 0x4cef52 on Arc testnet.
 */
describe("chain presets", () => {
  test("every chain id is distinct", () => {
    const ids = CHAIN_ENVS.map((env) => CHAIN_PRESETS[env].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("only the two mainnets carry real money", () => {
    const real = CHAIN_ENVS.filter((env) => CHAIN_PRESETS[env].valuesAreReal);
    expect(real.sort()).toEqual(["arc", "mainnet"]);
  });

  test("Arc pays gas in USDC, not ether", () => {
    // The whole reason NATIVE_SYMBOL exists. Labelling an Arc balance "ETH"
    // names an asset the user does not hold.
    expect(CHAIN_PRESETS.arc.nativeCurrency.symbol).toBe("USDC");
    expect(CHAIN_PRESETS["arc-testnet"].nativeCurrency.symbol).toBe("USDC");
    expect(CHAIN_PRESETS.mainnet.nativeCurrency.symbol).toBe("ETH");
  });

  test("native gas is 18-decimal everywhere, including Arc", () => {
    // Arc's USDC has two interfaces a factor of 1e12 apart: 18 decimals native,
    // 6 through the ERC-20. Every figure on this site comes from the native
    // side, so formatEth's 18 is right and must not be "corrected" to 6.
    for (const env of CHAIN_ENVS) {
      expect(CHAIN_PRESETS[env].nativeCurrency.decimals).toBe(18);
    }
  });

  test("only the Robinhood chains are Orbit rollups", () => {
    // block.number means the parent chain's height on Orbit and this chain's
    // height everywhere else. Getting this wrong misreads every log range.
    const orbit = CHAIN_ENVS.filter((env) => CHAIN_PRESETS[env].isArbitrumOrbit);
    expect(orbit.sort()).toEqual(["mainnet", "testnet"]);
  });

  test("every preset declares a getLogs range its own RPC will accept", () => {
    // Not a style preference — a range the node refuses is a range the Garden
    // silently skips, and a listing that skips every range looks exactly like a
    // chain with no launches on it.
    //
    // Measured against the live endpoints: Robinhood's public RPC serves a
    // 9,000-block range, Arc's answers "Request exceeds defined limit" above
    // 5,000. A single hardcoded chunk cannot be right for both.
    for (const env of CHAIN_ENVS) {
      expect(CHAIN_PRESETS[env].logsChunkLimit).toBeGreaterThan(0n);
    }
    expect(CHAIN_PRESETS.arc.logsChunkLimit).toBeLessThanOrEqual(5_000n);
    expect(CHAIN_PRESETS["arc-testnet"].logsChunkLimit).toBeLessThanOrEqual(5_000n);
  });

  test("every non-local preset has an https RPC and an explorer", () => {
    for (const env of CHAIN_ENVS.filter((e) => e !== "local")) {
      expect(CHAIN_PRESETS[env].rpcUrl).toMatch(/^https:\/\//);
      expect(CHAIN_PRESETS[env].explorerUrl).toMatch(/^https:\/\//);
    }
  });
});
