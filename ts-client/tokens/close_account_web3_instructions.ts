import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createInitializeMintInstruction,
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

  const mint = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  const associatedTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    feePayer.publicKey,
    false, // allowOwnerOffCurve
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
        associatedTokenAccount,
        feePayer.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, mint]
  );

  const destination = feePayer.publicKey;
  const closeBlockhash = await connection.getLatestBlockhash();

  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: closeBlockhash.blockhash,
      lastValidBlockHeight: closeBlockhash.lastValidBlockHeight
    }).add(
      createCloseAccountInstruction(
        associatedTokenAccount, // Token account to close.
        destination, // Account receiving the reclaimed SOL.
        feePayer.publicKey, // Owner approving the account closure.
        [], // Additional multisig signers.
        TOKEN_PROGRAM_ID // Token program to invoke.
      )
    ),
    [feePayer]
  );

  const tokenAccountData = await connection.getAccountInfo(
    associatedTokenAccount,
    "confirmed"
  );

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log(
    "\nAssociated Token Account Address:",
    associatedTokenAccount.toBase58()
  );
  console.log("Associated Token Account:", tokenAccountData);
  console.log("\nDestination Address:", destination.toBase58());
  console.log("\nTransaction Signature:", result);
}

main();