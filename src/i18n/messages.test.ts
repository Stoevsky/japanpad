import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";

/**
 * Guards the two message catalogues against drifting apart.
 *
 * A missing translation does not fail a build and does not fail a typecheck. It
 * surfaces as a raw key like `trade.slippageWarning` rendered to a user on a
 * page where they are about to spend money, or — worse, because it is silent —
 * as an English sentence in the middle of a Japanese page.
 *
 * The catalogues are split one file per namespace so that pages can be worked
 * on independently, which makes divergence easy: adding a key to en/token.json
 * and forgetting ja/token.json is a two-second mistake with no feedback. This is
 * the feedback.
 */

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), "../../messages");

function read(locale: string, namespace: string): unknown {
  return JSON.parse(readFileSync(join(MESSAGES, locale, `${namespace}.json`), "utf8"));
}

function namespacesFor(locale: string): string[] {
  return readdirSync(join(MESSAGES, locale))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/** Every leaf key, dotted, so two catalogues can be compared as flat sets. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

function leafAt(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined,
      value,
    );
}

/**
 * The ICU arguments a message interpolates.
 *
 * Matches the name in `{chain}` and in `{count, plural, ...}` alike, which is
 * the whole set that matters here: if English says "Test network — {chain}" and
 * the Japanese drops `{chain}`, the page renders a sentence with the network
 * silently missing. A set, because order differs legitimately between languages
 * — Japanese frequently needs the argument somewhere else in the sentence.
 */
function icuArgs(message: string): Set<string> {
  return new Set(
    [...message.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}]/g)].map((m) => m[1]),
  );
}

const [reference, ...others] = LOCALES;

describe("message catalogues", () => {
  it("ships the same namespaces in every language", () => {
    const expected = namespacesFor(reference);
    expect(expected.length).toBeGreaterThan(0);
    for (const locale of others) {
      expect(namespacesFor(locale), `namespaces for ${locale}`).toEqual(expected);
    }
  });

  describe.each(namespacesFor(reference))("%s", (namespace) => {
    const base = read(reference, namespace);
    const basePaths = keyPaths(base).sort();

    it.each(others)("has every %s key translated", (locale) => {
      // Compared both ways on purpose. Missing keys leave a raw key on screen;
      // extra ones are dead weight that reads as coverage the site does not have.
      expect(keyPaths(read(locale, namespace)).sort()).toEqual(basePaths);
    });

    it.each(others)("keeps every interpolation in %s", (locale) => {
      const translated = read(locale, namespace);
      for (const path of basePaths) {
        const from = leafAt(base, path);
        const to = leafAt(translated, path);
        if (typeof from !== "string" || typeof to !== "string") continue;
        expect([...icuArgs(to)].sort(), `${namespace}.${path} in ${locale}`).toEqual(
          [...icuArgs(from)].sort(),
        );
      }
    });

    it.each(others)("leaves nothing empty in %s", (locale) => {
      const translated = read(locale, namespace);
      for (const path of basePaths) {
        const to = leafAt(translated, path);
        if (typeof to !== "string") continue;
        expect(to.trim(), `${namespace}.${path} in ${locale}`).not.toBe("");
      }
    });
  });
});
