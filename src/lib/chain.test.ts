import { describe, expect, test } from "vitest";
import { chainConfigError } from "./chain";

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
