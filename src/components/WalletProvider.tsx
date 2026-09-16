"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

/**
 * Wallet access, with no custody anywhere in it.
 *
 * JapanPad never holds a key, never signs on a server, and never asks for a
 * recovery phrase — the user's own injected wallet signs every launch and every
 * trade. This module's entire job is to find that wallet, make sure it is
 * pointed at Robinhood Chain, and hand back a viem WalletClient.
 */

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

interface WalletState {
  address: Address | null;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
  hasWallet: boolean;
  /** True only when connected AND on the chain this build targets. */
  ready: boolean;
  connect: () => Promise<void>;
  switchChain: () => Promise<void>;
  getWalletClient: () => WalletClient | null;
}

const Ctx = createContext<WalletState | null>(null);

function provider(): Eip1193Provider | null {
  return typeof window !== "undefined" && window.ethereum ? window.ethereum : null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const p = provider();
    setHasWallet(Boolean(p));
    if (!p) return;

    // Re-attach to an already-authorised account without prompting. eth_accounts
    // returns [] when the user has not connected, so this never forces a popup.
    void p
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.length) setAddress(list[0] as Address);
      })
      .catch(() => {});

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
  }, []);

  const connect = useCallback(async () => {
    const p = provider();
    if (!p) {
      setError("No wallet detected. Install MetaMask or another EVM wallet.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      if (accounts?.length) setAddress(accounts[0] as Address);
      const id = (await p.request({ method: "eth_chainId" })) as string;
      setChainId(Number(id));
    } catch (e) {
      // 4001 is the user closing the prompt. That is a choice, not a failure,
      // and it should not leave a red error sitting on screen.
      const code = (e as { code?: number })?.code;
      setError(code === 4001 ? null : "Could not connect to the wallet.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchChain = useCallback(async () => {
    const p = provider();
    if (!p) return;
    setError(null);
    const hexId = numberToHex(CHAIN_ID);
    try {
      await p.request({
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
        await p.request({
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
        setError(`Could not add ${CHAIN_NAME} to the wallet.`);
      }
    }
  }, []);

  const getWalletClient = useCallback((): WalletClient | null => {
    const p = provider();
    if (!p || !address) return null;
    return createWalletClient({
      account: address,
      chain: japanpadChain,
      transport: custom(p),
    });
  }, [address]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      connecting,
      error,
      hasWallet,
      ready: Boolean(address) && chainId === CHAIN_ID,
      connect,
      switchChain,
      getWalletClient,
    }),
    [address, chainId, connecting, error, hasWallet, connect, switchChain, getWalletClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
