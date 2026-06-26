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

  const sender = client.payer;
  const recipient = await generateKeyPairSigner();

  const LAMPORTS_PER_SOL = 1_000_000_000n;
  const transferAmount = lamports(LAMPORTS_PER_SOL / 100n); // 0.01 SOL

  // Check balance before transfer
  const { value: preBalance1 } = await client.rpc
    .getBalance(sender.address)
    .send();
  const { value: preBalance2 } = await client.rpc
    .getBalance(recipient.address)
    .send();

  // Create a transfer instruction for transferring SOL from sender to recipient
  const transferInstruction = client.system.instructions.transferSol({
    source: sender,
    destination: recipient.address,
    amount: transferAmount // 0.01 SOL in lamports
  });

  const transactionSignature = await client.sendTransaction([
    transferInstruction
  ]);

  // Check balance after transfer
  const { value: postBalance1 } = await client.rpc
    .getBalance(sender.address)
    .send();
  const { value: postBalance2 } = await client.rpc
    .getBalance(recipient.address)
    .send();

  console.log(
    "Sender prebalance:",
    Number(preBalance1) / Number(LAMPORTS_PER_SOL)
  );
  console.log(
    "Recipient prebalance:",
    Number(preBalance2) / Number(LAMPORTS_PER_SOL)
  );
  console.log(
    "Sender postbalance:",
    Number(postBalance1) / Number(LAMPORTS_PER_SOL)
  );
  console.log(
    "Recipient postbalance:",
    Number(postBalance2) / Number(LAMPORTS_PER_SOL)
  );
  console.log("Transaction Signature:", transactionSignature.context.signature);
}

main();