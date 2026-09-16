"use client";

import { CHAIN_NAME } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";

export function WalletButton() {
  const { address, connecting, hasWallet, ready, connect, switchChain } = useWallet();

  if (address && !ready) {
    return (
      <button
        onClick={switchChain}
        className="text-sm px-4 py-2 rounded-full border border-vermilion text-vermilion hover:bg-vermilion hover:text-paper transition-colors"
      >
        Switch to {CHAIN_NAME}
      </button>
    );
  }

  if (address) {
    return (
      <span className="text-sm px-4 py-2 rounded-full border border-rule bg-paper font-mono text-xs">
        {shortAddress(address)}
      </span>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="text-sm px-4 py-2 rounded-full border border-sumi/25 hover:border-vermilion hover:text-vermilion transition-colors disabled:opacity-50"
    >
      {connecting ? "Connecting…" : hasWallet ? "Connect" : "Get a wallet"}
    </button>
  );
}
