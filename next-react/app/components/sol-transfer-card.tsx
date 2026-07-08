"use client";

import { address } from "@solana/kit";
import { useState } from "react";
import { useSolTransfer, useWallet } from "@solana/react-hooks";

const LAMPORTS_PER_SOL = 1_000_000_000n;

function parseLamports(input: string) {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return null;
  const lamports = BigInt(Math.floor(value * Number(LAMPORTS_PER_SOL)));
  return lamports > 0 ? lamports : null;
}

export function SolTransferCard() {
  const wallet = useWallet();
  const { send, isSending, signature } = useSolTransfer();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("0.001");
  const [error, setError] = useState<string | null>(null);

  const statusText =
    wallet.status === "connected" ? "Wallet connected" : "Wallet disconnected";

  async function sendSol() {
    if (wallet.status !== "connected") {
      setError("Connect a wallet first.");
      return;
    }
    const lamports = parseLamports(amount);
    if (!lamports) {
      setError("Enter an amount greater than 0.");
      return;
    }
    const dest = destination.trim();
    if (!dest) {
      setError("Enter a destination address.");
      return;
    }
    setError(null);
    try {
      await send({
        destination: address(dest),
        amount: lamports
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send SOL");
      return;
    }
    setAmount("0.001");
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          SOL Transfer
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          Send SOL with the connected wallet
        </h2>
        <p className="text-sm text-slate-600">
          Uses the connected signer as the fee payer and authorizes the
          transfer.
        </p>
      </div>
      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="destination"
        >
          Destination address
        </label>
        <input
          id="destination"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="Destination wallet address"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
      <div className="space-y-2">
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="amount"
        >
          Amount (SOL)
        </label>
        <input
          id="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          min="0"
          step="0.001"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Status: {statusText}</p>
        <button
          type="button"
          onClick={() => void sendSol()}
          disabled={wallet.status !== "connected" || isSending}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "Sending…" : "Send SOL"}
        </button>
      </div>
      {signature ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">Transfer sent</p>
          <a
            className="text-sky-700 underline"
            href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            View on Solana Explorer →
          </a>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-red-600">{error}</p>
      ) : null}
    </section>
  );
}