/**
 * Finding the wallets a browser offers, and telling them apart.
 *
 * Pure and free of React so the interesting rules can be tested without a DOM.
 * WalletProvider owns the event listening; this owns the decision about what
 * the resulting list should contain.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

/** What an extension puts on the EIP-6963 announcement event. */
export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface Eip6963Announcement {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
}

export interface DiscoveredWallet {
  /** Stable across reloads, so a choice can be remembered. */
  id: string;
  name: string;
  /** Data URI from the wallet itself. Null for a legacy slot, which has none. */
  icon: string | null;
  provider: Eip1193Provider;
}

/** Phantom's EVM provider also hangs off its own namespace. */
export const PHANTOM_RDNS = "app.phantom";

/**
 * Merges EIP-6963 announcements with the legacy injection points.
 *
 * Announcements are authoritative: they carry a name, an icon and a stable
 * `rdns` that the extension vouches for. The legacy slots carry none of that,
 * so they may only ever add a wallet nobody announced — never replace one.
 *
 * `window.phantom.ethereum` is read by name because reaching Phantom directly
 * is what makes it connectable on a browser where a different extension has
 * taken `window.ethereum`. `window.ethereum` itself is the last resort and is
 * used only when nothing else turned up, since it is almost always one of the
 * wallets already listed and offering it twice under two names helps nobody.
 */
export function mergeWallets(
  announced: readonly Eip6963Announcement[],
  legacy: { phantom?: Eip1193Provider | null; injected?: Eip1193Provider | null },
): DiscoveredWallet[] {
  const found = new Map<string, DiscoveredWallet>();

  for (const { info, provider } of announced) {
    // A wallet with no rdns cannot be remembered across reloads and a wallet
    // with no name cannot be chosen, so an incomplete announcement is dropped
    // rather than listed as a blank row.
    if (!info?.rdns || !info.name || !provider) continue;
    found.set(info.rdns, {
      id: info.rdns,
      name: info.name,
      icon: info.icon || null,
      provider,
    });
  }

  if (legacy.phantom && !found.has(PHANTOM_RDNS)) {
    found.set(PHANTOM_RDNS, {
      id: PHANTOM_RDNS,
      name: "Phantom",
      icon: null,
      provider: legacy.phantom,
    });
  }

  if (legacy.injected && found.size === 0) {
    found.set("injected", {
      id: "injected",
      name: "Browser wallet",
      icon: null,
      provider: legacy.injected,
    });
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
