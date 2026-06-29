import { createMint, getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
  // Setup: create and fund the fee payer before creating the mint.
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
    feePayer.publicKey, // Authority allowed to mint new tokens.
    feePayer.publicKey, // Authority allowed to freeze token accounts.
    9, // Decimals to define on the mint account.
    Keypair.generate(), // New mint account to create.
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const mintAccount = await getMint(
    connection,
    mintPubkey,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mintPubkey.toBase58());
  console.log("Mint Account:", mintAccount);
}

main();