"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addressUrl } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/**
 * The JapanPad token's own contract address.
 *
 * Shown rather than linked-to-only because a contract address is something
 * people paste into a wallet, so copying it has to be one click. The same
 * string is also linked to the explorer, which is the only way a visitor can
 * check it against the chain rather than taking this page's word for it.
 */
export const JAPANPAD_CA = "0x8734f2f2f38647933761f003f166ab0b853c020c";

type Status = "idle" | "copied" | "failed";

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * `variant` only changes colour. "header" sits on paper, "hero" sits on the
 * photograph, where anything but a translucent light treatment disappears.
 */
export function ContractAddress({
  variant = "header",
  className = "",
}: {
  variant?: "header" | "hero";
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    // writeText rejects on an insecure origin or a denied permission. Saying
    // "Copied" when nothing reached the clipboard would send someone off to
    // paste an empty buffer into a wallet, so failure is reported as failure.
    let ok = false;
    try {
      await navigator.clipboard.writeText(JAPANPAD_CA);
      ok = true;
    } catch {
      ok = false;
    }
    setStatus(ok ? "copied" : "failed");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 1600);
  }, []);

  const hero = variant === "hero";
  const explorer = addressUrl(JAPANPAD_CA);

  const shell = hero
    ? "border-ivory/25 bg-ivory/10 text-ivory backdrop-blur-sm hover:border-ivory/50"
    : "border-rule bg-paper text-sumi hover:border-vermilion/50";
  const labelTone = hero ? "text-ivory/55" : "text-muted";
  const divider = hero ? "bg-ivory/20" : "bg-rule";

  return (
    <div
      className={`inline-flex items-center rounded-full border transition-colors ${shell} ${className}`}
    >
      <button
        type="button"
        onClick={copy}
        title={`Copy ${JAPANPAD_CA}`}
        className="flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-l-full cursor-pointer"
      >
        <span className={`text-[10px] uppercase tracking-[0.18em] ${labelTone}`}>CA</span>
        <span className={`font-mono ${hero ? "text-[13px]" : "text-[11px]"}`}>
          {shortAddress(JAPANPAD_CA)}
        </span>
        <span className={status === "copied" ? "text-gold" : undefined}>
          {status === "copied" ? <CheckIcon /> : <CopyIcon />}
        </span>
        {/* Announced to screen readers only; sighted users get the tick. */}
        <span className="sr-only" role="status">
          {status === "copied"
            ? "Contract address copied"
            : status === "failed"
              ? "Copy failed"
              : ""}
        </span>
      </button>

      {explorer ? (
        <>
          <span className={`w-px self-stretch my-1.5 ${divider}`} aria-hidden />
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer noopener"
            title="View the contract on the explorer"
            className="px-2.5 py-1.5 rounded-r-full"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
              <path
                d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="sr-only">View contract on explorer</span>
          </a>
        </>
      ) : null}

      {status === "failed" ? (
        <span className="pr-3 text-[10px] text-vermilion">Copy failed</span>
      ) : null}
    </div>
  );
}
