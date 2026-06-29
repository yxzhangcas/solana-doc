import {
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  getMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";

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

  const mint = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);

  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }).add(
      SystemProgram.createAccount({
        fromPubkey: feePayer.publicKey, // Account funding account creation.
        newAccountPubkey: mint.publicKey, // New mint account to create.
        space: MINT_SIZE, // Account size in bytes.
        lamports: mintRent, // Lamports funding the new account rent.
        programId: TOKEN_PROGRAM_ID // Program that owns the new account.
      }),
      createInitializeMintInstruction(
        mint.publicKey, // Mint account to initialize.
        9, // Decimals to define on the mint account.
        feePayer.publicKey, // Authority allowed to mint new tokens.
        feePayer.publicKey, // Authority allowed to freeze token accounts.
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, mint]
  );

  const mintAccount = await getMint(
    connection,
    mint.publicKey,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log("Mint Account:", mintAccount);
  console.log("\nTransaction Signature:", result);
}

main();