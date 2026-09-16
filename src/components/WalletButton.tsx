"use client";

import { useEffect, useRef, useState } from "react";
import { CHAIN_NAME } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { useWallet } from "./WalletProvider";

/** Where to send someone who has no wallet at all. */
const PHANTOM_URL = "https://phantom.com/download";

export function WalletButton() {
  const {
    address,
    connecting,
    error,
    hasWallet,
    wallets,
    selected,
    ready,
    connect,
    disconnect,
    switchChain,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A menu that does not close on an outside click or on Escape is a menu that
  // sits over the page until something else happens to re-render.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
      <div ref={root} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-full border border-rule bg-paper hover:border-vermilion/50 transition-colors"
        >
          {selected?.icon ? (
            // A data URI handed over by the extension. next/image would need it
            // whitelisted and cannot optimise it anyway.
            <img src={selected.icon} alt="" className="size-4 rounded-sm" />
          ) : null}
          <span className="font-mono text-xs">{shortAddress(address)}</span>
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 rounded-xl border border-rule bg-paper shadow-lg p-1.5 z-50"
          >
            <p className="px-2.5 py-1.5 text-[11px] text-muted">
              Connected with {selected?.name ?? "your wallet"}
            </p>
            <button
              role="menuitem"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full text-left text-[13px] px-2.5 py-2 rounded-lg hover:bg-sumi/5 hover:text-vermilion transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  // Nothing installed. Sending them to Phantom is more use than a dead button,
  // and this is the one case where the control is a link rather than an action.
  if (!hasWallet) {
    return (
      <a
        href={PHANTOM_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm px-4 py-2 rounded-full border border-sumi/25 hover:border-vermilion hover:text-vermilion transition-colors"
      >
        Get a wallet
      </a>
    );
  }

  // Exactly one wallet is not a choice, so do not render a menu for it.
  if (wallets.length === 1) {
    return (
      <button
        onClick={() => connect(wallets[0]?.id)}
        disabled={connecting}
        title={error ?? undefined}
        className="text-sm px-4 py-2 rounded-full border border-sumi/25 hover:border-vermilion hover:text-vermilion transition-colors disabled:opacity-50"
      >
        {connecting ? "Connecting…" : `Connect ${wallets[0]?.name}`}
      </button>
    );
  }

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={connecting}
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-sm px-4 py-2 rounded-full border border-sumi/25 hover:border-vermilion hover:text-vermilion transition-colors disabled:opacity-50"
      >
        {connecting ? "Connecting…" : "Connect"}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-rule bg-paper shadow-lg p-1.5 z-50"
        >
          {wallets.map((w) => (
            <button
              key={w.id}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void connect(w.id);
              }}
              className="w-full flex items-center gap-2.5 text-left text-[13px] px-2.5 py-2 rounded-lg hover:bg-sumi/5 transition-colors"
            >
              {w.icon ? (
                <img src={w.icon} alt="" className="size-5 rounded-md" />
              ) : (
                <span className="size-5 rounded-md bg-sumi/10" />
              )}
              {w.name}
            </button>
          ))}
          {error ? (
            <p className="px-2.5 py-1.5 text-[11px] text-vermilion">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
