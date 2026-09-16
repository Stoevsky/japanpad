"use client";

import { useCallback, useState } from "react";
import type { Abi, Address, Hash, TransactionReceipt } from "viem";
import { japanpadChain } from "@/lib/chain";
import { describeTxError } from "@/lib/errors";
import { publicClient } from "@/lib/pons/client";
import { useWallet } from "@/components/WalletProvider";

/**
 * Sending one transaction, and saying honestly what happened to it.
 *
 * Three states matter to a user and they are genuinely different: the wallet is
 * open and waiting for a signature, the transaction is broadcast and waiting for
 * a block, and it is mined. Collapsing them into a single spinner means a user
 * who already signed cannot tell whether anything is happening.
 *
 * The receipt is kept rather than discarded because it is the only trustworthy
 * account of what a transaction did. A launch's token address is read out of its
 * receipt's logs, never out of the simulation that preceded it.
 */

export type TxPhase = "idle" | "signing" | "pending" | "success" | "error";

export interface TxState {
  phase: TxPhase;
  hash: Hash | null;
  receipt: TransactionReceipt | null;
  error: string | null;
  busy: boolean;
  send: (args: SendArgs) => Promise<Hash | null>;
  reset: () => void;
}

export interface SendArgs {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export function txPhaseLabel(phase: TxPhase): string {
  switch (phase) {
    case "signing":
      return "Check your wallet…";
    case "pending":
      return "Confirming…";
    case "success":
      return "Done";
    default:
      return "";
  }
}

export function useTx(): TxState {
  const { getWalletClient, address } = useWallet();
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [hash, setHash] = useState<Hash | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setHash(null);
    setReceipt(null);
    setError(null);
  }, []);

  const send = useCallback(
    async (args: SendArgs): Promise<Hash | null> => {
      const wallet = getWalletClient();
      if (!wallet || !address) {
        setError("Connect a wallet first.");
        setPhase("error");
        return null;
      }

      setError(null);
      setReceipt(null);
      setPhase("signing");

      try {
        // Simulated first, against the chain as it stands. A revert caught here
        // costs nothing; the same revert caught after signing costs gas and
        // arrives as a failed transaction in the user's history.
        const { request } = await publicClient.simulateContract({
          account: address,
          address: args.address,
          abi: args.abi as Abi,
          functionName: args.functionName,
          args: args.args as never,
          value: args.value,
        });

        const sent = await wallet.writeContract({
          ...request,
          account: address,
          chain: japanpadChain,
        });
        setHash(sent);
        setPhase("pending");

        const mined = await publicClient.waitForTransactionReceipt({ hash: sent });
        setReceipt(mined);

        // A mined transaction is not a successful one. `status` is the chain's
        // own verdict and it is the only thing worth believing here.
        if (mined.status !== "success") {
          setError("The transaction was mined but reverted. Nothing changed on chain.");
          setPhase("error");
          return null;
        }

        setPhase("success");
        return sent;
      } catch (e) {
        const described = describeTxError(e);
        if (described === null) {
          // The user closed the wallet. That is a choice, not a failure.
          setPhase("idle");
          return null;
        }
        setError(described);
        setPhase("error");
        return null;
      }
    },
    [address, getWalletClient],
  );

  return {
    phase,
    hash,
    receipt,
    error,
    busy: phase === "signing" || phase === "pending",
    send,
    reset,
  };
}
