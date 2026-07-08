import { SolTransferCard } from "./components/sol-transfer-card";
import { WalletConnectButton } from "./components/wallet-connect-button";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          @solana/react-hooks + Next.js
        </p>
        <h1 className="text-3xl font-bold text-slate-900">
          Solana wallet + SOL transfer
        </h1>
        <p className="max-w-3xl text-base text-slate-700">
          Connect a Wallet Standard wallet and send a SOL transfer using the
          connected signer.
        </p>
      </header>
      <section className="space-y-3 rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Wallet
            </p>
            <p className="text-sm text-slate-700">
              Pick a Wallet Standard connector.
            </p>
          </div>
          <div className="sm:min-w-[240px]">
            <WalletConnectButton />
          </div>
        </div>
      </section>
      <SolTransferCard />
    </main>
  );
}