import {
  ACCOUNT_SIZE,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  getAccount,
  getMinimumBalanceForRentExemptAccount,
  getMinimumBalanceForRentExemptMint,
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

  const mint = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }).add(
      SystemProgram.createAccount({
        fromPubkey: feePayer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        2,
        feePayer.publicKey,
        feePayer.publicKey,
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, mint]
  );

  const tokenAccount = Keypair.generate();
  const tokenAccountRent =
    await getMinimumBalanceForRentExemptAccount(connection);

  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }).add(
      SystemProgram.createAccount({
        fromPubkey: feePayer.publicKey, // Account funding account creation.
        newAccountPubkey: tokenAccount.publicKey, // New token account to create.
        space: ACCOUNT_SIZE, // Account size in bytes.
        lamports: tokenAccountRent, // Lamports funding the new account rent.
        programId: TOKEN_PROGRAM_ID // Program that owns the new account.
      }),
      createInitializeAccountInstruction(
        tokenAccount.publicKey, // Token account to initialize.
        mint.publicKey, // Mint for the token this account holds.
        feePayer.publicKey, // Account that owns the token account.
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, tokenAccount]
  );

  const tokenAccountData = await getAccount(
    connection,
    tokenAccount.publicKey,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log("\nToken Account Address:", tokenAccount.publicKey.toBase58());
  console.log("Token Account:", tokenAccountData);
  console.log("\nTransaction Signature:", result);
}

main();