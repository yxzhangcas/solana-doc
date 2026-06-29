import {
  closeAccount,
  createAssociatedTokenAccount,
  createMint,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
  // Setup: create a mint and the payer's ATA before closing the token account.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();

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

  const associatedTokenAccount = await createAssociatedTokenAccount(
    connection,
    feePayer,
    mintPubkey,
    feePayer.publicKey,
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );
  const destination = feePayer.publicKey;

  const result = await closeAccount(
    connection, // Connection to the local validator.
    feePayer, // Account paying transaction fees.
    associatedTokenAccount, // Token account to close.
    destination, // Account receiving the reclaimed SOL.
    feePayer, // Owner approving the account closure.
    [], // Additional multisig signers.
    {
      commitment: "confirmed" // Confirmation options for the transaction.
    },
    TOKEN_PROGRAM_ID // Token program to invoke.
  );

  const tokenAccountData = await connection.getAccountInfo(
    associatedTokenAccount,
    "confirmed"
  );

  console.log("Mint Address:", mintPubkey.toBase58());
  console.log(
    "\nAssociated Token Account Address:",
    associatedTokenAccount.toBase58()
  );
  console.log("Associated Token Account:", tokenAccountData);
  console.log("\nDestination Address:", destination.toBase58());
  console.log("\nTransaction Signature:", result);
}

main();