import type { Address, Hex } from "viem";
import { isThemeId } from "../themes";

/**
 * The JapanPad theme, carried through a launchpad that has no idea about themes.
 *
 * JapanPad does not run a launchpad. A coin is created by
 * `PonsV2LaunchFactory.launchToken`, trades on a Pons bonding curve, and
 * graduates into a Uniswap v4 pool governed by Pons's hook. What JapanPad
 * contributes is the theme, the curation, and the reading of it all back —
 * none of which Pons has a concept of.
 *
 * Pons's token carries a name, a symbol, a logo, a description and five social
 * fields, and nothing else. There is no `theme` to write to, so the theme
 * travels inside the free-text description, in a shape we can find again.
 *
 * ---------------------------------------------------------------------------
 * THIS TAG IS FORGEABLE, AND THAT IS ACCEPTABLE HERE
 * ---------------------------------------------------------------------------
 * Anyone launching straight at Pons can type "[JapanPad] theme:gaming" into
 * their own description and appear in our Explore. We accept that, because the
 * tag asserts nothing of value: no company, no stock, no financial linkage, no
 * endorsement. It says "this coin filed itself under Gaming", and the worst a
 * forgery achieves is an unwanted coin in a category.
 *
 * If JapanPad ever attaches a claim worth forging — a verified badge, a fee
 * share, a partnership — this mechanism is not strong enough and must be
 * replaced by launching through a JapanPad contract, so that the factory's
 * `deployer` field is ours and cannot be typed by hand.
 *
 * Everything here is pure: no RPC, no secrets, no request context. The launch
 * form writes these strings, the indexer reads them back, and verify-pons.ts
 * encodes a launch from them against the live factory. All three have to agree,
 * so all three call this.
 */

const TAG_RE = /^\[JapanPad\] theme:([a-z-]{2,24})$/m;

/** Where a coin's page lives on JapanPad. Doubles as the discovery marker. */
export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

export function themePageUrl(themeId: string): string {
  const origin = siteOrigin();
  return origin ? `${origin}/themes/${themeId}` : "";
}

/**
 * Appends the theme tag to a creator's description.
 *
 * It goes last and on its own line so that a reader — or Pons's own site, which
 * renders this field verbatim — sees the creator's words first and the
 * machine-readable part as a footnote rather than a header.
 */
export function withThemeTag(description: string, themeId: string): string {
  const body = description.trim();
  const tag = `[JapanPad] theme:${themeId}`;
  return body ? `${body}\n\n${tag}` : tag;
}

/**
 * Recovers the theme from a Pons description. Null when there is no tag, or
 * when the tag names a theme we do not have — an unknown id is treated as
 * absent rather than rendered, so a coin cannot invent a category by typing one.
 */
export function parseThemeTag(description: string): string | null {
  const match = TAG_RE.exec(description);
  if (!match) return null;
  const id = match[1];
  if (!id || !isThemeId(id)) return null;
  return id;
}

/** The creator's own text, with our tag taken back off. */
export function withoutThemeTag(description: string): string {
  return description.replace(TAG_RE, "").trim();
}

// ---------------------------------------------------------------------------
// Building the transaction
// ---------------------------------------------------------------------------

/**
 * Pons reads a zero `creatorFeeRecipient` as "whoever sent the transaction":
 *
 *   creatorFeeRecipient =
 *       params.creatorFeeRecipient == address(0) ? originalDeployer : ...
 *   — PonsV2LaunchFactory:813
 *
 * Written out here rather than reusing the quote-asset zero address, which is
 * also zero but names an unrelated thing. The two being equal is a fact about
 * the number, not about the fields.
 */
const SIGNER: Address = "0x0000000000000000000000000000000000000000";

/** Pons's `TokenParams`, in the order the ABI expects. */
export interface PonsTokenParams {
  name: string;
  symbol: string;
  logo: string;
  description: string;
  socials: {
    twitter: string;
    telegram: string;
    discord: string;
    website: string;
    farcaster: string;
  };
  creatorFeeRecipient: Address;
  creatorTaxBps: number;
  buybackEnabled: boolean;
  expectedEconomics: Hex;
  salt: Hex;
}

export interface BuildParamsInput {
  name: string;
  symbol: string;
  /** Image URI — ipfs:// or https://. Pons stores it as an opaque string. */
  logo: string;
  description: string;
  /** X handle without the @, or "". */
  x: string;
  /** The creator's own link, or "". */
  link: string;
  themeId: string;
  economics: Hex;
  salt: Hex;
}

export function buildTokenParams(input: BuildParamsInput): PonsTokenParams {
  return {
    name: input.name,
    symbol: input.symbol,
    logo: input.logo,
    description: withThemeTag(input.description, input.themeId),
    socials: {
      twitter: input.x,
      telegram: "",
      discord: "",
      // The creator's link if they gave one, else the theme's page here. This
      // field is also how a JapanPad launch is recognised again later, so it is
      // never left empty when we have an origin to point at.
      website: input.link || themePageUrl(input.themeId),
      farcaster: "",
    },
    // The creator, signing in their own wallet. JapanPad takes no cut of their
    // fees: Pons has exactly one creator recipient slot per launch, and
    // pointing it at a JapanPad treasury would mean the person who made the
    // coin earns nothing from it.
    creatorFeeRecipient: SIGNER,
    // No surcharge on top of Pons's own trade fee. A creator tax is the
    // creator's to ask for, not a default we impose on every JapanPad coin.
    creatorTaxBps: 0,
    // Route the buyback slice into PonsV2BuybackVault's five-year vest rather
    // than paying it out. This is Pons's own mechanism and its default.
    buybackEnabled: true,
    expectedEconomics: input.economics,
    salt: input.salt,
  };
}

/**
 * A fresh CREATE2 salt.
 *
 * Pons namespaces salts per launching account, so this only has to be unique
 * among one creator's own launches and 256 bits of randomness is far more than
 * that needs. Reusing one on otherwise identical terms reverts, because the
 * pair already exists at the address it derives.
 */
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
