import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createFreezeAccountInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createThawAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
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
  // Setup: create a mint, fund the payer's ATA, and freeze the token account first.
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
  const tokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    feePayer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

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
      ),
      createAssociatedTokenAccountInstruction(
        feePayer.publicKey,
        tokenAccount,
        feePayer.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToCheckedInstruction(
        mint.publicKey,
        tokenAccount,
        feePayer.publicKey,
        100,
        2,
        [],
        TOKEN_PROGRAM_ID
      ),
      createFreezeAccountInstruction(
        tokenAccount,
        mint.publicKey,
        feePayer.publicKey,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, mint]
  );

  const thawBlockhash = await connection.getLatestBlockhash();
  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: thawBlockhash.blockhash,
      lastValidBlockHeight: thawBlockhash.lastValidBlockHeight
    }).add(
      createThawAccountInstruction(
        tokenAccount, // Token account to thaw.
        mint.publicKey, // Mint for the token account being thawed.
        feePayer.publicKey, // Freeze authority approving this change.
        [], // Additional multisig signers.
        TOKEN_PROGRAM_ID // Token program to invoke.
      )
    ),
    [feePayer]
  );

  const tokenAccountData = await getAccount(
    connection,
    tokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log("\nToken Account Address:", tokenAccount.toBase58());
  console.log("Token Account:", tokenAccountData);
  console.log("\nTransaction Signature:", result);
}

main();