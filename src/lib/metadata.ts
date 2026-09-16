/**
 * Cleaning up what a creator typed, before it goes on chain forever.
 *
 * Pons stores `name`, `symbol`, `logo`, `description` and five social fields as
 * plain strings on the token contract, and offers no way to edit any of them
 * afterwards. So this is the last point at which a mistake can be caught, and
 * the rule throughout is to *reject* rather than to quietly drop: a link that
 * silently vanished during launch is a link the creator can never put back.
 *
 * These caps are JapanPad's, not Pons's. Pons validates exactly one thing about
 * a name or symbol — that it is not empty. A coin launched straight at Pons can
 * therefore carry a 400-character name, and every surface here that renders
 * someone else's coin has to survive that. See lib/format.ts, which is the
 * other half of that defence.
 */

export const MAX_NAME = 64;
export const MAX_SYMBOL = 16;
export const MAX_DESCRIPTION = 500;

/** X caps handles at 15 characters, letters/digits/underscore. */
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export const IMAGE_HINT = "Images must be an https:// or ipfs:// address.";

export interface RawLinks {
  description: string;
  image: string;
  link: string;
  x: string;
}

export interface CleanLinks {
  description: string;
  image: string;
  link: string;
  /** Bare handle, no @ and no URL — Pons's field is read as a handle. */
  x: string;
}

/**
 * Accepts an image reference only if it is a scheme a browser can safely load.
 *
 * `data:` is excluded deliberately: it would let a creator inline an arbitrary
 * payload into token metadata that every visitor's browser then renders.
 */
function cleanImage(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  if (/^ipfs:\/\/[A-Za-z0-9./-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Takes "@handle", "handle", or an x.com URL, and returns the bare handle. */
function cleanX(raw: string): string | null {
  let value = raw.trim();
  if (!value) return "";
  const asUrl = value.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i);
  if (asUrl?.[1]) value = asUrl[1];
  value = value.replace(/^@/, "");
  return X_HANDLE.test(value) ? value : null;
}

export type CleanResult =
  | { ok: true; links: CleanLinks }
  | { ok: false; field: "image" | "link" | "x" | "description"; error: string };

export function cleanLinks(raw: RawLinks): CleanResult {
  const description = raw.description.trim();
  if (description.length > MAX_DESCRIPTION) {
    return {
      ok: false,
      field: "description",
      error: `Descriptions are at most ${MAX_DESCRIPTION} characters.`,
    };
  }

  const image = cleanImage(raw.image);
  if (image === null) return { ok: false, field: "image", error: IMAGE_HINT };

  const link = cleanLink(raw.link);
  if (link === null) {
    return { ok: false, field: "link", error: "Links must start with https://" };
  }

  const x = cleanX(raw.x);
  if (x === null) {
    return {
      ok: false,
      field: "x",
      error: "That is not an X handle. Use up to 15 letters, digits or underscores.",
    };
  }

  return { ok: true, links: { description, image, link, x } };
}
