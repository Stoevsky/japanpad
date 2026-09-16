import { describe, expect, test } from "vitest";
import { parseConfigId } from "./deployment";

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
