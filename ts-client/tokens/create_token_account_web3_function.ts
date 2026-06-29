import {
  createAccount,
  createMint,
  getAccount,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
  // Setup: create a mint before creating the token account.
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

  const tokenAccount = await createAccount(
    connection, // Connection to the local validator.
    feePayer, // Account paying transaction fees.
    mintPubkey, // Mint for the token this account holds.
    feePayer.publicKey, // Account that owns the token account.
    Keypair.generate(), // New token account to create.
    {
      commitment: "confirmed" // Confirmation options for the transaction.
    },
    TOKEN_PROGRAM_ID // Token program to invoke.
  );

  const tokenAccountData = await getAccount(
    connection,
    tokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mintPubkey.toBase58());
  console.log("\nToken Account Address:", tokenAccount.toBase58());
  console.log("Token Account:", tokenAccountData);
}

main();