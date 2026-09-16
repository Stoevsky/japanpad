"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createWalletClient,
  custom,
  numberToHex,
  type Address,
  type WalletClient,
} from "viem";
import { CHAIN_ID, CHAIN_NAME, EXPLORER_URL, RPC_URL, japanpadChain } from "@/lib/chain";
import {
  mergeWallets,
  type DiscoveredWallet,
  type Eip1193Provider,
  type Eip6963Announcement,
} from "@/lib/wallets";

export type { DiscoveredWallet } from "@/lib/wallets";

/**
 * Wallet access, with no custody anywhere in it.
 *
 * JapanPad never holds a key, never signs on a server, and never asks for a
 * recovery phrase — the user's own wallet signs every launch and every trade.
 * This module's entire job is to find that wallet, make sure it is pointed at
 * Robinhood Chain, and hand back a viem WalletClient.
 */

/**
 * EIP-6963 discovery, which is how more than one wallet can coexist.
 *
 * `window.ethereum` is a single slot that every extension overwrites, so with
 * Phantom and MetaMask both installed it holds whichever won the race — the
 * user picks a wallet and the other one opens. EIP-6963 replaced that: each
 * extension announces itself on an event with a stable `rdns`, and the page
 * keeps them all. Phantom, MetaMask and Rabby all implement it.
 *
 * The legacy slots are still read, as a wallet that predates the standard would
 * otherwise be invisible. `mergeWallets` owns the rule that they may only ever
 * add a wallet, never shadow one that announced itself.
 */
interface Eip6963AnnounceEvent extends CustomEvent {
  detail: Eip6963Announcement;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
  }
}

/** Remembers which wallet was chosen, so a reload does not silently switch. */
const STORAGE_KEY = "japanpad:wallet";

interface WalletState {
  address: Address | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  /** Every wallet this browser offers. Empty when none is installed. */
  wallets: DiscoveredWallet[];
  /** The one currently connected, for naming it in the UI. */
  selected: DiscoveredWallet | null;
  /** True only when connected AND on the chain this build targets. */
  ready: boolean;
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  getWalletClient: () => WalletClient | null;
}

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => wallets.find((w) => w.id === selectedId) ?? null,
    [wallets, selectedId],
  );

  // Held in a ref as well so getWalletClient can read it without being
  // re-created on every render, which would re-run its consumers' effects.
  const selectedRef = useRef<DiscoveredWallet | null>(null);
  selectedRef.current = selected;

  useEffect(() => {
    const announced: Eip6963Announcement[] = [];
    // Legacy slots are only consulted after the announcement window closes, so
    // that a wallet which is about to announce is never listed twice.
    let readLegacy = false;

    const publish = () => {
      setWallets(
        mergeWallets(
          announced,
          readLegacy
            ? { phantom: window.phantom?.ethereum, injected: window.ethereum }
            : {},
        ),
      );
    };

    const onAnnounce = (event: Event) => {
      const detail = (event as Eip6963AnnounceEvent).detail;
      if (!detail?.info || !detail.provider) return;
      announced.push(detail);
      publish();
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const timer = window.setTimeout(() => {
      readLegacy = true;
      publish();
    }, 300);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      window.clearTimeout(timer);
    };
  }, []);

  // Re-attach to whichever wallet was last used, without prompting.
  useEffect(() => {
    if (wallets.length === 0 || selectedId) return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const wallet = saved ? wallets.find((w) => w.id === saved) : null;
    if (!wallet) return;

    // eth_accounts returns [] when the user has not authorised this site, so
    // this reconnects a returning user without ever forcing a popup.
    void wallet.provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.length) {
          setSelectedId(wallet.id);
          setAddress(list[0] as Address);
        }
      })
      .catch(() => {});
  }, [wallets, selectedId]);

  // Track accounts and chain on the selected wallet only. Listening to every
  // discovered provider would let an idle extension overwrite the address of
  // the one actually in use.
  useEffect(() => {
    const p = selected?.provider;
    if (!p) return;

    void p
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(Number(id as string)))
      .catch(() => {});

    const onAccounts = (...args: never[]) => {
      const list = args[0] as unknown as string[];
      setAddress(list?.length ? (list[0] as Address) : null);
    };
    const onChain = (...args: never[]) => {
      setChainId(Number(args[0] as unknown as string));
    };

    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, [selected]);

  const connect = useCallback(
    async (walletId?: string) => {
      const wallet = walletId
        ? wallets.find((w) => w.id === walletId)
        : (wallets.find((w) => w.id === selectedId) ?? wallets[0]);

      if (!wallet) {
        setError("No wallet detected. Install Phantom, MetaMask, or another EVM wallet.");
        return;
      }

      setConnecting(true);
      setError(null);
      try {
        const accounts = (await wallet.provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (accounts?.length) {
          setSelectedId(wallet.id);
          setAddress(accounts[0] as Address);
          window.localStorage.setItem(STORAGE_KEY, wallet.id);
        }
        const id = (await wallet.provider.request({ method: "eth_chainId" })) as string;
        setChainId(Number(id));
      } catch (e) {
        // 4001 is the user closing the prompt. That is a choice, not a failure,
        // and it should not leave a red error sitting on screen.
        const code = (e as { code?: number })?.code;
        setError(code === 4001 ? null : `Could not connect to ${wallet.name}.`);
      } finally {
        setConnecting(false);
      }
    },
    [wallets, selectedId],
  );

  /**
   * Forgets the wallet locally. It cannot revoke the site's authorisation —
   * only the wallet itself can do that — so it says "disconnect" and means
   * "stop using it here", which is what the button can honestly promise.
   */
  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setSelectedId(null);
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const switchChain = useCallback(async () => {
    const wallet = selectedRef.current;
    if (!wallet) return;
    setError(null);
    const hexId = numberToHex(CHAIN_ID);
    try {
      await wallet.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexId }],
      });
    } catch (e) {
      // 4902 means the wallet has never heard of this chain, so offer to add it.
      const code = (e as { code?: number })?.code;
      if (code !== 4902) {
        setError("Could not switch network.");
        return;
      }
      try {
        await wallet.provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexId,
              chainName: CHAIN_NAME,
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: EXPLORER_URL ? [EXPLORER_URL] : undefined,
            },
          ],
        });
      } catch {
        // Some wallets refuse custom EVM chains outright rather than failing
        // the add. Naming the wallet is the difference between a user retrying
        // forever and a user reaching for a different one.
        setError(
          `${wallet.name} would not add ${CHAIN_NAME}. It may not support custom networks.`,
        );
      }
    }
  }, []);

  const getWalletClient = useCallback((): WalletClient | null => {
    const wallet = selectedRef.current;
    if (!wallet || !address) return null;
    return createWalletClient({
      account: address,
      chain: japanpadChain,
      transport: custom(wallet.provider),
    });
  }, [address]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      connecting,
      error,
      hasWallet: wallets.length > 0,
      wallets,
      selected,
      ready: Boolean(address) && chainId === CHAIN_ID,
      connect,
      disconnect,
      switchChain,
      getWalletClient,
    }),
    [
      address,
      chainId,
      connecting,
      error,
      wallets,
      selected,
      connect,
      disconnect,
      switchChain,
      getWalletClient,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
