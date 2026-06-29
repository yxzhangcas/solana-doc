import { systemProgram } from "@solana-program/system";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
  tokenProgram
} from "@solana-program/token";
import { address, createClient, lamports } from "@solana/kit";
import { rpcAirdrop, solanaRpc } from "@solana/kit-plugin-rpc";
import { airdropPayer, generatedPayer } from "@solana/kit-plugin-signer";

async function main() {
  const client = await createClient()
    .use(generatedPayer())
    .use(
      solanaRpc({
        rpcUrl: "http://localhost:8899",
        rpcSubscriptionsUrl: "ws://localhost:8900"
      })
    )
    .use(rpcAirdrop())
    .use(airdropPayer(lamports(1_000_000_000n)))
    .use(systemProgram())
    .use(tokenProgram());

  const NATIVE_MINT = address("So11111111111111111111111111111111111111112");

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: NATIVE_MINT,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  // Setup: create a WSOL ATA before wrapping and syncing SOL.
  await client.sendTransaction([
    await getCreateAssociatedTokenInstructionAsync({
      payer: client.payer,
      mint: NATIVE_MINT,
      owner: client.payer.address
    })
  ]);

  const result = await client.sendTransaction([
    client.system.instructions.transferSol({
      source: client.payer, // Account sending the SOL to wrap.
      destination: tokenAccount, // WSOL token account receiving the SOL.
      amount: 1_000_000n // SOL amount in lamports.
    }),
    client.token.instructions.syncNative({
      account: tokenAccount // WSOL token account to synchronize.
    })
  ]);

  const tokenAccountData = await client.token.accounts.token.fetch(tokenAccount);

  console.log("WSOL Token Account Address:", tokenAccount);
  console.log("WSOL Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();