import {
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintToChecked,
  TOKEN_PROGRAM_ID,
  transferChecked
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
  // Setup: create a mint, fund the payer's ATA, and create the recipient's ATA.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();
  const recipient = Keypair.generate();

  const airdropSignature = await connection.requestAirdrop(
    feePayer.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature: airdropSignature
  });

  const mintPubkey = await createMint(
    connection,
    feePayer,
    feePayer.publicKey,
    feePayer.publicKey,
    2,
    Keypair.generate(),
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const feePayerATA = await createAssociatedTokenAccount(
    connection,
    feePayer,
    mintPubkey,
    feePayer.publicKey,
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const recipientATA = await createAssociatedTokenAccount(
    connection,
    feePayer,
    mintPubkey,
    recipient.publicKey,
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  await mintToChecked(
    connection,
    feePayer,
    mintPubkey,
    feePayerATA,
    feePayer,
    100,
    2,
    [],
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const result = await transferChecked(
    connection, // Connection to the local validator.
    feePayer, // Account paying transaction fees.
    feePayerATA, // Token account sending the tokens.
    mintPubkey, // Mint for the token being transferred.
    recipientATA, // Token account receiving the tokens.
    feePayer, // Owner or delegate approving the transfer.
    25, // Token amount in base units.
    2, // Decimals defined on the mint account.
    [], // Additional multisig signers.
    {
      commitment: "confirmed" // Confirmation options for the transaction.
    },
    TOKEN_PROGRAM_ID // Token program to invoke.
  );

  const senderTokenAccount = await getAccount(
    connection,
    feePayerATA,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  const recipientTokenAccount = await getAccount(
    connection,
    recipientATA,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mintPubkey.toBase58());
  console.log("\nSource Token Account Address:", feePayerATA.toBase58());
  console.log("Source Token Account:", senderTokenAccount);
  console.log("\nDestination Token Account Address:", recipientATA.toBase58());
  console.log("Destination Token Account:", recipientTokenAccount);
  console.log("\nTransaction Signature:", result);
}

main();