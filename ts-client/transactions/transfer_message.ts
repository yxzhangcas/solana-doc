import { systemProgram } from "@solana-program/system";
import {
  appendTransactionMessageInstructions,
  createClient,
  createTransactionMessage,
  generateKeyPairSigner,
  getCompiledTransactionMessageDecoder,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners
} from "@solana/kit";
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

  const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send();

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

  // Create transaction message
  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(sender, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([transferInstruction], tx)
  );

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage);

  // Decode the messageBytes
  const compiledTransactionMessage =
    getCompiledTransactionMessageDecoder().decode(signedTransaction.messageBytes);

  console.log(JSON.stringify(compiledTransactionMessage, null, 2));
}

main();