import { systemProgram } from "@solana-program/system";
import { createClient, generateKeyPairSigner, lamports } from "@solana/kit";
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
    .use(systemProgram());

  // Generate sender and recipient keypairs
  const sender = client.payer;
  const recipient = await generateKeyPairSigner();

  // Define the amount to transfer
  const LAMPORTS_PER_SOL = 1_000_000_000n;
  const transferAmount = lamports(LAMPORTS_PER_SOL / 100n); // 0.01 SOL

  // Create a transfer instruction for transferring SOL from sender to recipient
  const transferInstruction = client.system.instructions.transferSol({
    source: sender,
    destination: recipient.address,
    amount: transferAmount
  });

  console.log(JSON.stringify(transferInstruction, null, 2));
}

main();