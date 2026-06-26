import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  Keypair,
  Connection,
  ComputeBudgetProgram,
  sendAndConfirmTransaction
} from "@solana/web3.js";

async function main() {
const connection = new Connection("http://localhost:8899", "confirmed");

const sender = Keypair.generate();
const recipient = new Keypair();

const airdropSignature = await connection.requestAirdrop(
  sender.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction(airdropSignature, "confirmed");

// Create compute budget instructions
const limitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
  units: 300_000
});
const priceInstruction = ComputeBudgetProgram.setComputeUnitPrice({
  microLamports: 1
});

const transferInstruction = SystemProgram.transfer({
  fromPubkey: sender.publicKey,
  toPubkey: recipient.publicKey,
  lamports: 0.01 * LAMPORTS_PER_SOL
});

// Add the compute budget and transfer instructions to a new transaction
const transaction = new Transaction()
  .add(limitInstruction)
  .add(priceInstruction)
  .add(transferInstruction);

const signature = await sendAndConfirmTransaction(connection, transaction, [
  sender
]);

console.log("Transaction Signature:", signature);
}

main();