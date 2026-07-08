"use client";

import type { SolanaClientConfig } from "@solana/client";
import { SolanaProvider } from "@solana/react-hooks";

const defaultConfig: SolanaClientConfig = {
  cluster: "devnet",
  rpc: "https://api.devnet.solana.com",
  websocket: "wss://api.devnet.solana.com"
};

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaProvider config={defaultConfig}>{children}</SolanaProvider>;
}