import { getTransferSolInstruction } from "@solana-program/system";
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
    .use(airdropPayer(lamports(1_000_000_000n)));

  const receiver = await generateKeyPairSigner();

  const transferInstruction = getTransferSolInstruction({
    source: client.payer,
    destination: receiver.address,
    amount: lamports(10_000_000n)
  });

  const result = await client.sendTransaction([transferInstruction]);

  console.log("Transaction Signature:", result.context.signature);

  const { value: senderBalance } = await client.rpc
    .getBalance(client.payer.address)
    .send();
  const { value: receiverBalance } = await client.rpc
    .getBalance(receiver.address)
    .send();

  console.log("Sender Balance:", senderBalance);
  console.log("Receiver Balance:", receiverBalance);
}

main();