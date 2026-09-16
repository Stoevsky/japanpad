import { describe, expect, test } from "vitest";
import { mergeWallets, type Eip1193Provider } from "./wallets";

/**
 * Picking a wallet when more than one is installed.
 *
 * `window.ethereum` is a single slot and every extension overwrites it, so with
 * Phantom and MetaMask both present the page sees whichever won the race. The
 * user asks for Phantom and MetaMask opens. EIP-6963 fixed that by having each
 * extension announce itself with a stable `rdns`, and this is the merge of
 * those announcements with the legacy slots that still have to be read for
 * anything that predates the standard.
 *
 * The rule that matters: a legacy slot may only ever ADD a wallet, never shadow
 * an announced one. A provider reached through `window.ethereum` has no
 * identity attached, so trusting it over an announcement is how "Phantom" ends
 * up labelling whatever extension loaded last.
 */

const provider = (tag: string): Eip1193Provider =>
  ({ request: async () => tag }) as unknown as Eip1193Provider;

const announce = (name: string, rdns: string) => ({
  info: { uuid: `${rdns}-uuid`, name, rdns, icon: "data:image/svg+xml;base64,PHN2Zy8+" },
  provider: provider(rdns),
});

describe("mergeWallets", () => {
  test("keeps every wallet that announced itself", () => {
    const merged = mergeWallets(
      [announce("MetaMask", "io.metamask"), announce("Phantom", "app.phantom")],
      {},
    );
    expect(merged.map((w) => w.name)).toEqual(["MetaMask", "Phantom"]);
  });

  test("orders by name so the menu does not reshuffle between renders", () => {
    // Announcement order is a race between extensions; display order must not be.
    const merged = mergeWallets(
      [announce("Rabby", "io.rabby"), announce("Phantom", "app.phantom")],
      {},
    );
    expect(merged.map((w) => w.name)).toEqual(["Phantom", "Rabby"]);
  });

  test("finds Phantom at its own path when it did not announce", () => {
    // This is the case that makes Phantom reachable on a browser where another
    // extension owns window.ethereum.
    const merged = mergeWallets([], { phantom: provider("phantom") });
    expect(merged.map((w) => w.name)).toEqual(["Phantom"]);
  });

  test("lets an announced Phantom win over the legacy Phantom slot", () => {
    const merged = mergeWallets([announce("Phantom", "app.phantom")], {
      phantom: provider("legacy"),
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.icon).not.toBeNull();
  });

  test("falls back to the bare injected slot only when nothing else exists", () => {
    expect(mergeWallets([], { injected: provider("injected") }).map((w) => w.name)).toEqual([
      "Browser wallet",
    ]);
  });

  test("ignores the injected slot once any real wallet is known", () => {
    // window.ethereum is almost certainly one of the wallets already listed, and
    // adding it again offers the user the same extension twice under two names.
    const merged = mergeWallets([announce("MetaMask", "io.metamask")], {
      injected: provider("injected"),
    });
    expect(merged.map((w) => w.name)).toEqual(["MetaMask"]);
  });

  test("reports nothing when no wallet is installed", () => {
    expect(mergeWallets([], {})).toEqual([]);
  });

  test("skips a malformed announcement rather than listing a nameless wallet", () => {
    const broken = { info: { uuid: "x", name: "", rdns: "", icon: "" }, provider: provider("x") };
    expect(mergeWallets([broken], {})).toEqual([]);
  });
});
